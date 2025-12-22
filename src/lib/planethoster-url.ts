/**
 * Utility functions for generating secure PlanetHoster URLs
 * 
 * These URLs point to the secure proxy endpoint which verifies authentication
 * and file ownership before serving files.
 */

/**
 * Generate a secure proxy URL for a PlanetHoster file
 * 
 * @param filePath - The relative path on PlanetHoster (e.g., "nexus/user123/file.mp3")
 * @returns Secure proxy URL that requires authentication
 */
export function getSecurePlanetHosterUrl(filePath: string): string {
  // If the path already contains the proxy URL, return it as-is
  if (filePath.startsWith('/api/storage/proxy/planethoster')) {
    return filePath;
  }

  // If it's an old public URL, extract the path
  if (filePath.includes('planethoster') || filePath.includes('nexus/')) {
    // Try to extract the path from various URL formats
    const urlMatch = filePath.match(/nexus\/[^/]+\/[^/]+/);
    if (urlMatch) {
      return `/api/storage/proxy/planethoster?path=${encodeURIComponent(urlMatch[0])}`;
    }
  }

  // Default: assume it's already a relative path
  return `/api/storage/proxy/planethoster?path=${encodeURIComponent(filePath)}`;
}

/**
 * Check if a URL is a PlanetHoster URL that needs to be secured
 */
export function isPlanetHosterUrl(url: string): boolean {
  if (!url) return false;
  
  // Check if it's already using the secure proxy
  if (url.includes('/api/storage/proxy/planethoster')) {
    return true;
  }

  // Check if it's an old public PlanetHoster URL
  const config = {
    cdnUrl: process.env.NEXT_PUBLIC_PLANETHOSTER_CDN_URL,
    host: process.env.NEXT_PUBLIC_PLANETHOSTER_SFTP_HOST,
  };

  if (config.cdnUrl && url.includes(config.cdnUrl)) {
    return true;
  }

  if (config.host && url.includes(config.host)) {
    return true;
  }

  // Check if it contains the nexus path pattern
  if (url.includes('nexus/') && (url.includes('planethoster') || url.match(/nexus\/[^/]+\/[^/]+/))) {
    return true;
  }

  return false;
}

/**
 * Convert old public PlanetHoster URLs to secure proxy URLs
 * 
 * @param oldUrl - Old public URL
 * @returns Secure proxy URL
 */
export function convertToSecureUrl(oldUrl: string): string {
  if (!oldUrl) return oldUrl;

  // If already secure, return as-is
  if (oldUrl.includes('/api/storage/proxy/planethoster')) {
    return oldUrl;
  }

  // Extract path from old URL
  const pathMatch = oldUrl.match(/nexus\/[^/]+\/[^/]+/);
  if (pathMatch) {
    return getSecurePlanetHosterUrl(pathMatch[0]);
  }

  // If we can't extract a path, return the original URL
  // (might be a different provider)
  return oldUrl;
}

