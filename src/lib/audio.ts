import { DEFAULT_COVER } from "@/data/tracks";

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
    return filePath;
  }
  
  // Local file path - convert to local-audio:// URL for Electron
  // This uses our custom protocol registered in main.ts
  const normalizedPath = filePath.replace(/\\/g, '/');
  // Encode the path to handle special characters, spaces, plus signs, etc.
  const encodedPath = encodeURIComponent(normalizedPath);
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
    return filePath;
  }
  
  // Local file path - convert to local-video:// URL for Electron
  // This uses our custom protocol registered in main.ts
  const normalizedPath = filePath.replace(/\\/g, '/');
  const encodedPath = encodeURIComponent(normalizedPath);
  
  return `local-video://${encodedPath}`;
}

