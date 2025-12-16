import { DEFAULT_COVER } from "@/data/tracks";

// Default hero background images (fallback si album-cover-1.jpg ne charge pas)
const DEFAULT_HERO_IMAGES_FALLBACK = [
  "https://res.cloudinary.com/dsslbg3v3/image/upload/v1763928310/Triple_Curved_1920x1080-4_hixg8h.jpg",
  "https://res.cloudinary.com/dsslbg3v3/image/upload/v1763928311/QD-OLED-5120x1440_MEG_cl2vjd.jpg",
  "https://res.cloudinary.com/dsslbg3v3/image/upload/v1764459419/backgrounds/gk7ksbvokze4dky5peep.jpg",
];

/**
 * Get default hero image - uses album-cover-1.jpg as primary default for home
 */
export function getDefaultHeroImage(): string {
  // Use album-cover-1.jpg as the primary default image for home
  return DEFAULT_COVER;
}

/**
 * Get fallback hero image if default fails to load
 */
export function getFallbackHeroImage(): string {
  return DEFAULT_HERO_IMAGES_FALLBACK[Math.floor(Math.random() * DEFAULT_HERO_IMAGES_FALLBACK.length)];
}

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
 * Check if a cover URL is the default cover
 */
function isDefaultCover(coverUrl: string): boolean {
  if (!coverUrl) return false;
  
  // Check exact match
  if (coverUrl === DEFAULT_COVER) return true;
  
  // Check if it contains the default cover filename (for different paths)
  if (coverUrl.includes('album-cover-1.jpg') || coverUrl.includes('album-cover-1')) {
    return true;
  }
  
  return false;
}

/**
 * Get hero background image with fallback to default hero images
 * If cover is the default cover (album-cover-1.jpg), use Cloudinary images instead
 */
export function getHeroBackgroundUrl(coverUrl?: string): string {
  if (!coverUrl || coverUrl === '') {
    return getFallbackHeroImage();
  }
  
  // If cover is the default cover, use Cloudinary images for hero background
  if (isDefaultCover(coverUrl)) {
    return getFallbackHeroImage();
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
  const encodedPath = encodeURIComponent(normalizedPath);
  
  return `local-audio://${encodedPath}`;
}

/**
 * Get video source URL for playback
 * Handles both local files (Electron) and web URLs
 */
export function getVideoSrc(filePath?: string): string | null {
  if (!filePath) return null;
  
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

