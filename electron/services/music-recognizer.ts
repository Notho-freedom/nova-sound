import { ipcMain, BrowserWindow } from 'electron';
import * as path from 'path';
import type { StoredTrack } from './storage.js';
import { storage } from './storage.js';

/**
 * Interface pour les résultats de reconnaissance
 */
export interface RecognitionResult {
  trackId: string;
  originalArtist: string;
  originalAlbum: string;
  suggestedArtist: string;
  suggestedAlbum: string;
  confidence: number;
  method: 'filename' | 'folder' | 'similarity' | 'pattern';
}

/**
 * Interface pour les groupes détectés
 */
interface DetectedGroup {
  artist: string;
  album: string;
  tracks: StoredTrack[];
  confidence: number;
  pattern: string;
}

/**
 * Normalise une chaîne pour la comparaison (enlève accents, majuscules, etc.)
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Enlève les accents
    .replace(/[^\w\s]/g, '') // Enlève la ponctuation
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calcule la similarité entre deux chaînes (Levenshtein simplifié)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);
  
  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0.0;
  
  // Vérifie si l'une contient l'autre
  if (s1.includes(s2) || s2.includes(s1)) {
    return 0.8;
  }
  
  // Calcul de distance de Levenshtein simplifié
  const maxLen = Math.max(s1.length, s2.length);
  const distance = levenshteinDistance(s1, s2);
  return 1 - (distance / maxLen);
}

/**
 * Distance de Levenshtein
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Extrait les informations depuis le nom de fichier
 * Formats supportés:
 * - "Artiste - Titre.mp3"
 * - "Artiste - Album - Titre.mp3"
 * - "Artiste/Album/Titre.mp3"
 * - "Titre (Artiste).mp3"
 * - "Artiste - [Album] Titre.mp3"
 */
function parseFilename(filePath: string): { artist?: string; album?: string; title?: string } {
  const filename = path.basename(filePath, path.extname(filePath));
  const dirname = path.dirname(filePath);
  const dirnameParts = dirname.split(/[/\\]/).filter(p => p && !p.match(/^[A-Z]:$/));
  
  const result: { artist?: string; album?: string; title?: string } = {};
  
  // Pattern 1: "Artiste - Titre" ou "Artiste - Album - Titre"
  const dashPattern = /^(.+?)\s*-\s*(.+?)(?:\s*-\s*(.+))?$/;
  const dashMatch = filename.match(dashPattern);
  if (dashMatch) {
    if (dashMatch[3]) {
      // Format: "Artiste - Album - Titre"
      result.artist = dashMatch[1].trim();
      result.album = dashMatch[2].trim();
      result.title = dashMatch[3].trim();
    } else {
      // Format: "Artiste - Titre"
      result.artist = dashMatch[1].trim();
      result.title = dashMatch[2].trim();
    }
    return result;
  }
  
  // Pattern 2: "Titre (Artiste)" ou "Titre [Artiste]"
  const parenPattern = /^(.+?)\s*[\(\[](.+?)[\)\]]$/;
  const parenMatch = filename.match(parenPattern);
  if (parenMatch) {
    result.title = parenMatch[1].trim();
    result.artist = parenMatch[2].trim();
    return result;
  }
  
  // Pattern 3: "Artiste [Album] Titre" ou "Artiste [Album] - Titre"
  const bracketPattern = /^(.+?)\s*\[(.+?)\]\s*(?:-\s*)?(.+)$/;
  const bracketMatch = filename.match(bracketPattern);
  if (bracketMatch) {
    result.artist = bracketMatch[1].trim();
    result.album = bracketMatch[2].trim();
    result.title = bracketMatch[3].trim();
    return result;
  }
  
  // Pattern 4: Utiliser le dossier parent comme album/artiste
  if (dirnameParts.length > 0) {
    const lastDir = dirnameParts[dirnameParts.length - 1];
    const secondLastDir = dirnameParts.length > 1 ? dirnameParts[dirnameParts.length - 2] : null;
    
    // Si structure: "Artiste/Album/Titre.mp3"
    if (secondLastDir) {
      result.artist = secondLastDir;
      result.album = lastDir;
      result.title = filename;
    } else {
      // Si structure: "Album/Titre.mp3" ou "Artiste/Titre.mp3"
      result.album = lastDir;
      result.title = filename;
    }
  } else {
    result.title = filename;
  }
  
  return result;
}

/**
 * Trouve l'artiste le plus similaire dans la bibliothèque
 */
function findSimilarArtist(artist: string, existingTracks: StoredTrack[]): { artist: string; confidence: number } | null {
  if (!artist || artist === 'Artiste inconnu') return null;
  
  const artistSet = new Set<string>();
  existingTracks.forEach(track => {
    if (track.artist && track.artist !== 'Artiste inconnu') {
      artistSet.add(track.artist);
    }
  });
  
  let bestMatch: { artist: string; confidence: number } | null = null;
  const normalizedArtist = normalizeString(artist);
  
  for (const existingArtist of artistSet) {
    const similarity = calculateSimilarity(artist, existingArtist);
    
    // Seuil de similarité: 0.7 (70%)
    if (similarity >= 0.7) {
      if (!bestMatch || similarity > bestMatch.confidence) {
        bestMatch = { artist: existingArtist, confidence: similarity };
      }
    }
  }
  
  return bestMatch;
}

/**
 * Trouve l'album le plus similaire pour un artiste donné
 */
function findSimilarAlbum(
  album: string,
  artist: string,
  existingTracks: StoredTrack[]
): { album: string; confidence: number } | null {
  if (!album || album === 'Album inconnu') return null;
  
  // Filtre les tracks du même artiste (ou similaire)
  const artistTracks = existingTracks.filter(track => {
    if (!track.artist || track.artist === 'Artiste inconnu') return false;
    const similarity = calculateSimilarity(artist, track.artist);
    return similarity >= 0.7;
  });
  
  const albumSet = new Set<string>();
  artistTracks.forEach(track => {
    if (track.album && track.album !== 'Album inconnu') {
      albumSet.add(track.album);
    }
  });
  
  let bestMatch: { album: string; confidence: number } | null = null;
  
  for (const existingAlbum of albumSet) {
    const similarity = calculateSimilarity(album, existingAlbum);
    
    // Seuil de similarité: 0.75 (75%)
    if (similarity >= 0.75) {
      if (!bestMatch || similarity > bestMatch.confidence) {
        bestMatch = { album: existingAlbum, confidence: similarity };
      }
    }
  }
  
  return bestMatch;
}

/**
 * Détecte les groupes répétitifs dans les tracks inconnus
 */
function detectPatterns(unknownTracks: StoredTrack[]): DetectedGroup[] {
  const groups = new Map<string, DetectedGroup>();
  
  for (const track of unknownTracks) {
    const parsed = parseFilename(track.filePath);
    
    if (parsed.artist && parsed.album) {
      const key = `${normalizeString(parsed.artist)}|${normalizeString(parsed.album)}`;
      
      if (!groups.has(key)) {
        groups.set(key, {
          artist: parsed.artist,
          album: parsed.album,
          tracks: [],
          confidence: 0,
          pattern: 'filename'
        });
      }
      
      groups.get(key)!.tracks.push(track);
    } else if (parsed.artist) {
      // Groupe par artiste seulement
      const key = `artist|${normalizeString(parsed.artist)}`;
      
      if (!groups.has(key)) {
        groups.set(key, {
          artist: parsed.artist,
          album: 'Album inconnu',
          tracks: [],
          confidence: 0,
          pattern: 'filename-artist'
        });
      }
      
      groups.get(key)!.tracks.push(track);
    }
  }
  
  // Calcule la confiance basée sur le nombre de tracks
  const detectedGroups: DetectedGroup[] = [];
  for (const group of groups.values()) {
    if (group.tracks.length >= 2) {
      // Plus il y a de tracks, plus la confiance est élevée
      group.confidence = Math.min(0.5 + (group.tracks.length * 0.1), 0.95);
      detectedGroups.push(group);
    }
  }
  
  return detectedGroups.sort((a, b) => b.tracks.length - a.tracks.length);
}

/**
 * Reconnaît automatiquement les métadonnées d'un track
 */
export async function recognizeTrack(
  track: StoredTrack,
  existingTracks: StoredTrack[]
): Promise<RecognitionResult | null> {
  // Ignore si déjà identifié
  if (track.artist !== 'Artiste inconnu' && track.album !== 'Album inconnu') {
    return null;
  }
  
  const parsed = parseFilename(track.filePath);
  let suggestedArtist = track.artist;
  let suggestedAlbum = track.album;
  let confidence = 0;
  let method: RecognitionResult['method'] = 'filename';
  
  // 1. Extraction depuis le nom de fichier
  if (parsed.artist) {
    suggestedArtist = parsed.artist;
    confidence = 0.6;
    method = 'filename';
    
    // Vérifie si un artiste similaire existe
    const similarArtist = findSimilarArtist(parsed.artist, existingTracks);
    if (similarArtist && similarArtist.confidence >= 0.7) {
      suggestedArtist = similarArtist.artist;
      confidence = Math.max(confidence, similarArtist.confidence);
      method = 'similarity';
    }
  }
  
  if (parsed.album) {
    suggestedAlbum = parsed.album;
    if (confidence < 0.6) confidence = 0.6;
    
    // Vérifie si un album similaire existe pour cet artiste
    const similarAlbum = findSimilarAlbum(suggestedArtist, suggestedArtist, existingTracks);
    if (similarAlbum && similarAlbum.confidence >= 0.75) {
      suggestedAlbum = similarAlbum.album;
      confidence = Math.max(confidence, similarAlbum.confidence);
      method = 'similarity';
    }
  }
  
  // 2. Utilisation du dossier parent comme album
  if (suggestedAlbum === 'Album inconnu' && track.filePath) {
    const dirname = path.dirname(track.filePath);
    const dirnameParts = dirname.split(/[/\\]/).filter(p => p && !p.match(/^[A-Z]:$/));
    
    if (dirnameParts.length > 0) {
      const lastDir = dirnameParts[dirnameParts.length - 1];
      
      // Ignore les dossiers génériques
      const genericDirs = ['music', 'musique', 'songs', 'audio', 'mp3', 'downloads', 'téléchargements'];
      if (!genericDirs.includes(normalizeString(lastDir))) {
        suggestedAlbum = lastDir;
        if (confidence < 0.5) confidence = 0.5;
        method = 'folder';
      }
    }
  }
  
  // Ne retourne que si on a une amélioration
  if (suggestedArtist === track.artist && suggestedAlbum === track.album) {
    return null;
  }
  
  return {
    trackId: track.id,
    originalArtist: track.artist,
    originalAlbum: track.album,
    suggestedArtist,
    suggestedAlbum,
    confidence,
    method
  };
}

/**
 * Reconnaît automatiquement tous les tracks inconnus
 */
export async function recognizeAllUnknownTracks(): Promise<RecognitionResult[]> {
  const allTracks = await storage.getLibrary();
  const unknownTracks = allTracks.filter(
    t => t.artist === 'Artiste inconnu' || t.album === 'Album inconnu'
  );
  
  const results: RecognitionResult[] = [];
  
  for (const track of unknownTracks) {
    const result = await recognizeTrack(track, allTracks);
    if (result) {
      results.push(result);
    }
  }
  
  return results;
}

/**
 * Applique les résultats de reconnaissance aux tracks
 */
export async function applyRecognitionResults(results: RecognitionResult[]): Promise<number> {
  let updated = 0;
  
  for (const result of results) {
    const track = await storage.getTrack(result.trackId);
    if (track) {
      track.artist = result.suggestedArtist;
      track.album = result.suggestedAlbum;
      await storage.updateTrack(result.trackId, track);
      updated++;
    }
  }
  
  return updated;
}

/**
 * Détecte et crée automatiquement des groupes pour les patterns répétitifs
 */
export async function detectAndGroupPatterns(): Promise<DetectedGroup[]> {
  const allTracks = await storage.getLibrary();
  const unknownTracks = allTracks.filter(
    t => t.artist === 'Artiste inconnu' || t.album === 'Album inconnu'
  );
  
  return detectPatterns(unknownTracks);
}

/**
 * Applique un groupe détecté aux tracks
 */
export async function applyDetectedGroup(group: DetectedGroup): Promise<number> {
  let updated = 0;
  
  for (const track of group.tracks) {
    const storedTrack = await storage.getTrack(track.id);
    if (storedTrack) {
      storedTrack.artist = group.artist;
      storedTrack.album = group.album;
      await storage.updateTrack(track.id, storedTrack);
      updated++;
    }
  }
  
  return updated;
}

/**
 * Initialise les handlers IPC pour la reconnaissance
 */
export function initMusicRecognizer() {
  // Reconnaître tous les tracks inconnus
  ipcMain.handle('recognize:all', async () => {
    return recognizeAllUnknownTracks();
  });
  
  // Appliquer les résultats de reconnaissance
  ipcMain.handle('recognize:apply', async (_event, results: RecognitionResult[]) => {
    const updated = await applyRecognitionResults(results);
    
    // Notifier le renderer
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(window => {
      window.webContents.send('recognize:updated', updated);
    });
    
    return updated;
  });
  
  // Détecter les patterns
  ipcMain.handle('recognize:detect-patterns', async () => {
    return detectAndGroupPatterns();
  });
  
  // Appliquer un groupe détecté
  ipcMain.handle('recognize:apply-group', async (_event, group: DetectedGroup) => {
    const updated = await applyDetectedGroup(group);
    
    // Notifier le renderer
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(window => {
      window.webContents.send('recognize:updated', updated);
    });
    
    return updated;
  });
  
  // Reconnaître un track spécifique
  ipcMain.handle('recognize:track', async (_event, trackId: string) => {
    const track = await storage.getTrack(trackId);
    if (!track) return null;
    
    const allTracks = await storage.getLibrary();
    return recognizeTrack(track, allTracks);
  });
}

