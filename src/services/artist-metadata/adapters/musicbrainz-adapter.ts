/**
 * Adaptateur MusicBrainz API
 * Documentation: https://musicbrainz.org/doc/MusicBrainz_API
 * Note: Nécessite un User-Agent avec email
 */

import type { ArtistMetadata, AlbumMetadata, MetadataSearchOptions, MetadataSearchResult } from '@/types/artist-metadata';

interface MusicBrainzArtist {
  id: string;
  name: string;
  'life-span'?: {
    begin?: string;
    end?: string;
  };
  'area'?: {
    name: string;
  };
  'begin-area'?: {
    name: string;
  };
  disambiguation?: string;
  relations?: Array<{
    type: string;
    url?: {
      resource: string;
    };
  }>;
  tags?: Array<{
    name: string;
    count: number;
  }>;
}

interface MusicBrainzRelease {
  id: string;
  title: string;
  'artist-credit'?: Array<{
    artist: {
      name: string;
    };
  }>;
  date?: string;
  'release-group'?: {
    'primary-type'?: string;
    'secondary-types'?: string[];
  };
  'label-info'?: Array<{
    label: {
      name: string;
    };
  }>;
  'cover-art-archive'?: {
    front?: boolean;
    artwork?: boolean;
  };
  tags?: Array<{
    name: string;
    count: number;
  }>;
}

export class MusicBrainzAdapter {
  private baseUrl = 'https://musicbrainz.org/ws/2';
  private userAgent: string;
  private email?: string;

  constructor(userAgent?: string, email?: string) {
    // User-Agent requis par MusicBrainz
    this.userAgent = userAgent || 'Nexus-Audio-Player/1.0.0';
    this.email = email;
  }

  /**
   * Recherche un artiste sur MusicBrainz
   */
  async searchArtist(artistName: string): Promise<ArtistMetadata | null> {
    try {
      const params = new URLSearchParams({
        query: `artist:"${artistName}"`,
        limit: '1',
        fmt: 'json',
      });

      const headers: HeadersInit = {
        'User-Agent': this.email ? `${this.userAgent} (${this.email})` : this.userAgent,
      };

      const response = await fetch(`${this.baseUrl}/artist?${params.toString()}`, {
        headers,
      });

      if (!response.ok) {
        if (response.status === 503) {
          throw new Error('MusicBrainz API: Service temporairement indisponible');
        }
        return null;
      }

      const data = await response.json();
      const artists = data.artists;

      if (!artists || artists.length === 0) {
        return null;
      }

      const artist: MusicBrainzArtist = artists[0];

      // Récupérer plus de détails avec relations
      const detailResponse = await fetch(`${this.baseUrl}/artist/${artist.id}?inc=tags+relations&fmt=json`, {
        headers,
      });

      let detailedArtist = artist;
      if (detailResponse.ok) {
        const detailData = await detailResponse.json();
        detailedArtist = detailData;
      }

      // Extraire les genres depuis les tags
      const genres = (detailedArtist.tags || [])
        .filter((tag: any) => tag.count > 0)
        .map((tag: any) => tag.name)
        .slice(0, 5);

      // Extraire les relations (sites web, etc.)
      const relations = detailedArtist.relations || [];
      const socialLinks: ArtistMetadata['socialLinks'] = {};

      relations.forEach((rel: any) => {
        if (rel.type === 'official homepage' && rel.url) {
          socialLinks.official = rel.url.resource;
        } else if (rel.type === 'wikipedia' && rel.url) {
          socialLinks.wikipedia = rel.url.resource;
        } else if (rel.type === 'facebook' && rel.url) {
          socialLinks.facebook = rel.url.resource;
        } else if (rel.type === 'twitter' && rel.url) {
          socialLinks.twitter = rel.url.resource;
        } else if (rel.type === 'instagram' && rel.url) {
          socialLinks.instagram = rel.url.resource;
        } else if (rel.type === 'youtube' && rel.url) {
          socialLinks.youtube = rel.url.resource;
        }
      });

      const metadata: ArtistMetadata = {
        id: artist.id,
        name: artist.name,
        birthDate: detailedArtist['life-span']?.begin,
        deathDate: detailedArtist['life-span']?.end,
        origin: detailedArtist['begin-area']?.name || detailedArtist['area']?.name,
        country: detailedArtist['area']?.name,
        genres: genres.length > 0 ? genres : undefined,
        socialLinks: Object.keys(socialLinks).length > 0 ? socialLinks : undefined,
        source: 'musicbrainz',
      };

      return metadata;
    } catch (error) {
      console.error('[MusicBrainzAdapter] Error:', error);
      return null;
    }
  }

  /**
   * Recherche un album sur MusicBrainz
   */
  async searchAlbum(albumName: string, artistName: string): Promise<AlbumMetadata | null> {
    try {
      const query = artistName 
        ? `release:"${albumName}" AND artist:"${artistName}"`
        : `release:"${albumName}"`;

      const params = new URLSearchParams({
        query,
        limit: '1',
        fmt: 'json',
      });

      const headers: HeadersInit = {
        'User-Agent': this.email ? `${this.userAgent} (${this.email})` : this.userAgent,
      };

      const response = await fetch(`${this.baseUrl}/release?${params.toString()}`, {
        headers,
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const releases = data.releases;

      if (!releases || releases.length === 0) {
        return null;
      }

      const release: MusicBrainzRelease = releases[0];

      // Récupérer plus de détails
      const detailResponse = await fetch(`${this.baseUrl}/release/${release.id}?inc=tags+labels&fmt=json`, {
        headers,
      });

      let detailedRelease = release;
      if (detailResponse.ok) {
        const detailData = await detailResponse.json();
        detailedRelease = detailData;
      }

      const artist = detailedRelease['artist-credit']?.[0]?.artist?.name || artistName;
      const date = detailedRelease.date;
      const year = date ? new Date(date).getFullYear() : undefined;

      // Extraire les genres depuis les tags
      const genres = (detailedRelease.tags || [])
        .filter((tag: any) => tag.count > 0)
        .map((tag: any) => tag.name)
        .slice(0, 3);

      // Label
      const label = detailedRelease['label-info']?.[0]?.label?.name;

      // Cover art via Cover Art Archive
      const coverArtUrl = detailedRelease['cover-art-archive']?.artwork
        ? `https://coverartarchive.org/release/${release.id}/front`
        : undefined;

      const metadata: AlbumMetadata = {
        id: release.id,
        name: release.title,
        artist: artist,
        releaseDate: date,
        year: year,
        genre: genres[0],
        genres: genres.length > 0 ? genres : undefined,
        label: label,
        coverUrl: coverArtUrl,
        source: 'musicbrainz',
      };

      return metadata;
    } catch (error) {
      console.error('[MusicBrainzAdapter] Error:', error);
      return null;
    }
  }

  /**
   * Recherche générique
   */
  async search(options: MetadataSearchOptions): Promise<MetadataSearchResult<ArtistMetadata | AlbumMetadata>> {
    if (options.type === 'artist') {
      const artist = await this.searchArtist(options.query);
      return {
        items: artist ? [artist] : [],
        total: artist ? 1 : 0,
        source: 'musicbrainz',
        query: options.query,
        cached: false,
      };
    } else if (options.type === 'album') {
      const album = await this.searchAlbum(options.query, '');
      return {
        items: album ? [album] : [],
        total: album ? 1 : 0,
        source: 'musicbrainz',
        query: options.query,
        cached: false,
      };
    }

    return {
      items: [],
      total: 0,
      source: 'musicbrainz',
      query: options.query,
      cached: false,
    };
  }
}

