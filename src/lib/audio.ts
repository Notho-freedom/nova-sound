import { DEFAULT_COVER } from "@/data/tracks";
import { isElectron } from "@/lib/electron-detector";

/**
 * Get album cover URL with fallback to default
 */
export function getCoverUrl(coverUrl?: string): string {
  if (!coverUrl || coverUrl === '') {
    return DEFAULT_COVER;
  }
  return coverUrl;
}

/**
 * Format duration in seconds to MM:SS
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get audio source URL for playback
 * Handles both local files (Electron) and web URLs
 */
export function getAudioSrc(filePath?: string): string | null {
  if (!filePath) return null;

  // For PlanetHoster URLs, use secure proxy
  if (filePath.includes('planethoster') || filePath.includes('nexus/')) {
    const { getSecurePlanetHosterUrl } = require('@/lib/planethoster-url');
    return getSecurePlanetHosterUrl(filePath);
  }
  
  // Check if it's already a URL
  if (filePath.startsWith('http://') || filePath.startsWith('https://') || filePath.startsWith('blob:')) {
    return filePath;
  }
  
  // Check if already using local-audio protocol
  if (filePath.startsWith('local-audio://')) {
    return isElectron() ? filePath : null;
  }
  
  // Local file path - convert to local-audio:// URL for Electron
  // This uses our custom protocol registered in main.ts
  if (!isElectron()) {
    return null;
  }
  const normalizedPath = filePath.replace(/\\/g, '/');
  // Encode the path but keep slashes to preserve absolute paths
  const encodedPath = encodeURI(normalizedPath);
  // On Windows, ensure the drive letter stays in the path (not host)
  if (/^[A-Za-z]:/.test(normalizedPath)) {
    return `local-audio:///${encodedPath}`;
  }
  return `local-audio://${encodedPath}`;
}

/**
 * Get video source URL for playback
 * Handles both local files (Electron) and web URLs
 */
export function getVideoSrc(filePath?: string): string | null {
  if (!filePath) return null;

  // For PlanetHoster URLs, use secure proxy
  if (filePath.includes('planethoster') || filePath.includes('nexus/')) {
    const { getSecurePlanetHosterUrl } = require('@/lib/planethoster-url');
    return getSecurePlanetHosterUrl(filePath);
  }
  
  // Check if it's already a URL
  if (filePath.startsWith('http://') || filePath.startsWith('https://') || filePath.startsWith('blob:')) {
    return filePath;
  }
  
  // Check if already using local-video protocol
  if (filePath.startsWith('local-video://')) {
    return isElectron() ? filePath : null;
  }
  
  // Local file path - convert to local-video:// URL for Electron
  // This uses our custom protocol registered in main.ts
  if (!isElectron()) {
    return null;
  }
  const normalizedPath = filePath.replace(/\\/g, '/');
  const encodedPath = encodeURIComponent(normalizedPath);
  
  if (/^[A-Za-z]:/.test(normalizedPath)) {
    return `local-video:///${encodedPath}`;
  }

  return `local-video://${encodedPath}`;
}

