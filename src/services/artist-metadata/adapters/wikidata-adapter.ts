/**
 * Adaptateur Wikidata API (SPARQL)
 * Documentation: https://www.wikidata.org/wiki/Wikidata:SPARQL_tutorial
 */

import type { ArtistMetadata, AlbumMetadata } from '@/types/artist-metadata';

interface WikidataEntity {
  id: string;
  labels: Record<string, { value: string; language: string }>;
  descriptions?: Record<string, { value: string; language: string }>;
  claims?: Record<string, any[]>;
  sitelinks?: Record<string, { title: string; url: string }>;
}

export class WikidataAdapter {
  private baseUrl = 'https://query.wikidata.org/sparql';
  private apiUrl = 'https://www.wikidata.org/w/api.php';

  /**
   * Recherche un artiste sur Wikidata
   */
  async searchArtist(artistName: string): Promise<ArtistMetadata | null> {
    try {
      // Rechercher l'entité Wikidata
      const searchParams = new URLSearchParams({
        action: 'wbsearchentities',
        search: artistName,
        language: 'fr',
        format: 'json',
        origin: '*',
      });

      const searchResponse = await fetch(`${this.apiUrl}?${searchParams.toString()}`);
      if (!searchResponse.ok) {
        return null;
      }

      const searchData = await searchResponse.json();
      const results = searchData.search;

      if (!results || results.length === 0) {
        return null;
      }

      const entity = results[0];
      const entityId = entity.id;

      // Récupérer les détails de l'entité
      const entityParams = new URLSearchParams({
        action: 'wbgetentities',
        ids: entityId,
        props: 'labels|descriptions|claims|sitelinks',
        languages: 'fr|en',
        format: 'json',
        origin: '*',
      });

      const entityResponse = await fetch(`${this.apiUrl}?${entityParams.toString()}`);
      if (!entityResponse.ok) {
        return null;
      }

      const entityData = await entityResponse.json();
      const entities = entityData.entities;

      if (!entities || !entities[entityId]) {
        return null;
      }

      const entityInfo = entities[entityId];
      const labels = entityInfo.labels || {};
      const descriptions = entityInfo.descriptions || {};
      const claims = entityInfo.claims || {};
      const sitelinks = entityInfo.sitelinks || {};

      // Extraire les informations
      const name = labels.fr?.value || labels.en?.value || entity.label || artistName;
      const description = descriptions.fr?.value || descriptions.en?.value;

      // Date de naissance (P569)
      const birthDate = this.getClaimValue(claims.P569?.[0]);

      // Date de décès (P570)
      const deathDate = this.getClaimValue(claims.P570?.[0]);

      // Pays d'origine (P27)
      const countryId = this.getClaimValue(claims.P27?.[0]);
      const country = countryId ? await this.getEntityLabel(countryId) : undefined;

      // Genres musicaux (P136)
      const genreIds = claims.P136?.map((claim: any) => this.getClaimValue(claim)) || [];
      const genres = await Promise.all(
        genreIds.map((id: string) => this.getEntityLabel(id))
      ).then(results => results.filter(Boolean) as string[]);

      // Site web officiel (P856)
      const website = this.getClaimValue(claims.P856?.[0]);

      // Image (P18)
      const imageId = this.getClaimValue(claims.P18?.[0]);
      const imageUrl = imageId ? `https://commons.wikimedia.org/wiki/Special:FilePath/${imageId}` : undefined;

      // Lien Wikipedia
      const wikipediaLink = sitelinks.frwiki?.url || sitelinks.enwiki?.url;

      const metadata: ArtistMetadata = {
        id: entityId,
        name: name,
        biography: description,
        biographyShort: description?.substring(0, 200),
        biographyUrl: wikipediaLink,
        birthDate: birthDate,
        deathDate: deathDate,
        country: country,
        genres: genres.length > 0 ? genres : undefined,
        website: website,
        imageUrl: imageUrl,
        socialLinks: {
          wikipedia: wikipediaLink,
          official: website,
        },
        source: 'wikidata',
      };

      return metadata;
    } catch (error) {
      console.error('[WikidataAdapter] Error:', error);
      return null;
    }
  }

  /**
   * Récupère le label d'une entité Wikidata
   */
  private async getEntityLabel(entityId: string): Promise<string | null> {
    try {
      const params = new URLSearchParams({
        action: 'wbgetentities',
        ids: entityId,
        props: 'labels',
        languages: 'fr|en',
        format: 'json',
        origin: '*',
      });

      const response = await fetch(`https://www.wikidata.org/w/api.php?${params.toString()}`);
      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const entity = data.entities?.[entityId];
      const labels = entity?.labels || {};

      return labels.fr?.value || labels.en?.value || null;
    } catch {
      return null;
    }
  }

  /**
   * Extrait la valeur d'une claim Wikidata
   */
  private getClaimValue(claim: any): string | undefined {
    if (!claim) {
      return undefined;
    }

    const mainsnak = claim.mainsnak;
    if (!mainsnak || mainsnak.snaktype !== 'value') {
      return undefined;
    }

    const datavalue = mainsnak.datavalue;
    if (!datavalue) {
      return undefined;
    }

    // Pour les dates (time)
    if (datavalue.type === 'time') {
      return datavalue.value.time;
    }

    // Pour les URLs (string)
    if (datavalue.type === 'string') {
      return datavalue.value;
    }

    // Pour les entités (wikibase-entityid)
    if (datavalue.type === 'wikibase-entityid') {
      return datavalue.value.id;
    }

    return undefined;
  }

  /**
   * Recherche un album (moins supporté par Wikidata)
   */
  async searchAlbum(albumName: string, artistName: string): Promise<AlbumMetadata | null> {
    // Wikidata est moins adapté pour les albums
    // On retourne null et on laisse les autres sources gérer
    return null;
  }
}

