/**
 * Utilitaires de recherche optimisés avec index inversé
 * Permet des recherches O(1) au lieu de O(n) pour grandes collections
 */

import type { Track } from "@/types/music";
import type { Video } from "@/types/music";

interface InvertedIndex {
  // Index par terme → Set d'IDs de tracks
  titleIndex: Map<string, Set<string>>;
  artistIndex: Map<string, Set<string>>;
  albumIndex: Map<string, Set<string>>;
  // Index complet pour recherche fuzzy
  fullTextIndex: Map<string, Set<string>>;
}

/**
 * Tokenise une chaîne en mots (normalisés)
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprimer accents
    .split(/\s+/)
    .filter(word => word.length > 0);
}

/**
 * Crée un index inversé pour une collection de tracks
 */
export function createTrackIndex(tracks: Track[]): InvertedIndex {
  const titleIndex = new Map<string, Set<string>>();
  const artistIndex = new Map<string, Set<string>>();
  const albumIndex = new Map<string, Set<string>>();
  const fullTextIndex = new Map<string, Set<string>>();

  for (const track of tracks) {
    const trackId = track.id;

    // Indexer le titre
    const titleTokens = tokenize(track.title);
    for (const token of titleTokens) {
      if (!titleIndex.has(token)) {
        titleIndex.set(token, new Set());
      }
      titleIndex.get(token)!.add(trackId);

      if (!fullTextIndex.has(token)) {
        fullTextIndex.set(token, new Set());
      }
      fullTextIndex.get(token)!.add(trackId);
    }

    // Indexer l'artiste
    const artistTokens = tokenize(track.artist);
    for (const token of artistTokens) {
      if (!artistIndex.has(token)) {
        artistIndex.set(token, new Set());
      }
      artistIndex.get(token)!.add(trackId);

      if (!fullTextIndex.has(token)) {
        fullTextIndex.set(token, new Set());
      }
      fullTextIndex.get(token)!.add(trackId);
    }

    // Indexer l'album
    const albumTokens = tokenize(track.album);
    for (const token of albumTokens) {
      if (!albumIndex.has(token)) {
        albumIndex.set(token, new Set());
      }
      albumIndex.get(token)!.add(trackId);

      if (!fullTextIndex.has(token)) {
        fullTextIndex.set(token, new Set());
      }
      fullTextIndex.get(token)!.add(trackId);
    }
  }

  return {
    titleIndex,
    artistIndex,
    albumIndex,
    fullTextIndex,
  };
}

/**
 * Recherche rapide dans un index inversé
 */
export function searchInIndex(
  query: string,
  index: InvertedIndex,
  tracks: Track[]
): Track[] {
  if (!query.trim()) return tracks;

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return tracks;

  // Trouver les IDs correspondants (intersection pour AND, union pour OR)
  const matchingIds = new Set<string>();

  // Pour chaque token, trouver les tracks correspondants
  for (const token of queryTokens) {
    const ids = index.fullTextIndex.get(token);
    if (ids) {
      // Union: ajouter tous les IDs correspondants
      ids.forEach(id => matchingIds.add(id));
    }
  }

  // Si aucun résultat, essayer recherche partielle (fuzzy)
  if (matchingIds.size === 0) {
    for (const [token, ids] of index.fullTextIndex.entries()) {
      // Vérifier si le token contient la query ou vice versa
      for (const queryToken of queryTokens) {
        if (token.includes(queryToken) || queryToken.includes(token)) {
          ids.forEach(id => matchingIds.add(id));
        }
      }
    }
  }

  // Convertir les IDs en tracks
  const tracksMap = new Map(tracks.map(t => [t.id, t]));
  return Array.from(matchingIds)
    .map(id => tracksMap.get(id))
    .filter((track): track is Track => track !== undefined);
}

/**
 * Recherche optimisée avec cache d'index
 */
class SearchCache {
  private indexCache: Map<string, InvertedIndex> = new Map();
  private tracksHash: string = '';
  private tracksLength: number = 0;

  /**
   * Crée ou récupère l'index pour une collection de tracks
   */
  getIndex(tracks: Track[]): InvertedIndex {
    // Calculer un hash plus robuste pour détecter les changements
    const currentLength = tracks.length;
    const currentHash = currentLength > 0 
      ? `${currentLength}-${tracks[0]?.id}-${tracks[currentLength - 1]?.id}`
      : '';
    
    if (this.tracksHash === currentHash && 
        this.tracksLength === currentLength && 
        this.indexCache.has('tracks')) {
      return this.indexCache.get('tracks')!;
    }

    // Créer un nouvel index
    const index = createTrackIndex(tracks);
    this.indexCache.set('tracks', index);
    this.tracksHash = currentHash;
    this.tracksLength = currentLength;

    return index;
  }

  /**
   * Nettoie le cache
   */
  clear(): void {
    this.indexCache.clear();
    this.tracksHash = '';
    this.tracksLength = 0;
  }
}

const searchCache = new SearchCache();

/**
 * Recherche optimisée avec index inversé (cache automatique)
 */
export function searchTracks(tracks: Track[], query: string): Track[] {
  if (!query.trim()) return tracks;
  if (tracks.length === 0) return tracks;

  // Utiliser l'index inversé pour recherche rapide
  const index = searchCache.getIndex(tracks);
  return searchInIndex(query, index, tracks);
}

/**
 * Recherche avec tri optimisé (utilise Intl.Collator)
 */
export function searchAndSortTracks(
  tracks: Track[],
  query: string,
  sortBy: 'title' | 'artist' | 'album' | 'duration' | 'date' = 'title'
): Track[] {
  const filtered = searchTracks(tracks, query);

  // Utiliser Intl.Collator pour tri plus performant
  const collator = new Intl.Collator('fr', {
    sensitivity: 'base',
    numeric: true,
  });

  return [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'title':
        return collator.compare(a.title, b.title);
      case 'artist':
        return collator.compare(a.artist, b.artist);
      case 'album':
        return collator.compare(a.album, b.album);
      case 'duration':
        return b.duration - a.duration;
      case 'date':
        return (b.addedAt || '').localeCompare(a.addedAt || '');
      default:
        return 0;
    }
  });
}
