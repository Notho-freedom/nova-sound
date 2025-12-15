import axios from 'axios';

// Use environment variables from .env (lines 79-83)
const BUNNY_STORAGE_NAME = process.env.BUNNY_STORAGE_NAME;
const BUNNY_API_KEY = process.env.BUNNY_API_KEY;
const BUNNY_CDN_URL = process.env.BUNNY_CDN_URL;
const BUNNY_TOKEN_KEY = process.env.BUNNY_TOKEN_KEY; // Secret key for signing URLs
const BUNNY_STORAGE_URL = BUNNY_STORAGE_NAME ? `https://storage.bunnycdn.com/${BUNNY_STORAGE_NAME}` : '';

/**
 * Check if Bunny Storage is configured
 */
export function isBunnyConfigured(): boolean {
  return !!(BUNNY_STORAGE_NAME && BUNNY_API_KEY);
}

export interface BunnyUploadResult {
  success: boolean;
  url: string;
  path: string;
  size: number;
}

/**
 * Upload a file to Bunny Storage
 */
export async function uploadToBunny(
  path: string,
  file: Buffer,
  contentType?: string
): Promise<BunnyUploadResult> {
  if (!BUNNY_STORAGE_NAME || !BUNNY_API_KEY) {
    throw new Error('Bunny Storage is not configured. Please set BUNNY_STORAGE_NAME and BUNNY_API_KEY in .env');
  }

  const url = `${BUNNY_STORAGE_URL}/${path}`;

  try {
    const res = await axios.put(url, file, {
      headers: {
        AccessKey: BUNNY_API_KEY,
        'Content-Type': contentType || 'application/octet-stream',
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    const cdnUrl = BUNNY_CDN_URL 
      ? `${BUNNY_CDN_URL}/${path}`
      : `https://${BUNNY_STORAGE_NAME}.b-cdn.net/${path}`;

    return {
      success: true,
      url: cdnUrl,
      path,
      size: file.length,
    };
  } catch (error: any) {
    console.error('Bunny upload error:', error.response?.data || error.message);
    throw new Error(`Failed to upload to Bunny: ${error.response?.data?.Message || error.message}`);
  }
}

/**
 * Delete a file from Bunny Storage
 */
export async function deleteFromBunny(path: string): Promise<void> {
  if (!BUNNY_STORAGE_NAME || !BUNNY_API_KEY) {
    throw new Error('Bunny Storage is not configured');
  }

  const url = `${BUNNY_STORAGE_URL}/${path}`;

  try {
    await axios.delete(url, {
      headers: {
        AccessKey: BUNNY_API_KEY,
      },
    });
  } catch (error: any) {
    console.error('Bunny delete error:', error.response?.data || error.message);
    throw new Error(`Failed to delete from Bunny: ${error.response?.data?.Message || error.message}`);
  }
}

/**
 * Generate a signed URL for private content using Bunny CDN token authentication
 * 
 * Bunny CDN supports token-based URL signing for secure content delivery.
 * The token is generated using HMAC-SHA256 with the following format:
 * - token: HMAC-SHA256(path + expires, secret_key)
 * - expires: Unix timestamp when the URL expires
 * 
 * @param path - The file path on Bunny CDN (e.g., "uploads/user123/file.mp3")
 * @param expiresIn - Time in seconds until the URL expires (default: 1 hour)
 * @returns Signed URL with token parameter
 */
export function generateSignedUrl(path: string, expiresIn: number = 3600): string {
  if (!BUNNY_CDN_URL) {
    console.warn('BUNNY_CDN_URL not configured, returning unsigned URL');
    return path.startsWith('http') ? path : `https://${BUNNY_STORAGE_NAME}.b-cdn.net/${path}`;
  }

  // If no token key is configured, return unsigned URL
  if (!BUNNY_TOKEN_KEY) {
    console.warn('BUNNY_TOKEN_KEY not configured, returning unsigned URL. Set BUNNY_TOKEN_KEY in .env to enable URL signing.');
    return `${BUNNY_CDN_URL}/${path}`;
  }

  try {
    // Import crypto for HMAC (Node.js built-in)
    const crypto = require('crypto');
    
    // Calculate expiration timestamp
    const expires = Math.floor(Date.now() / 1000) + expiresIn;
    
    // Create the string to sign: path + expires
    const stringToSign = `${path}${expires}`;
    
    // Generate HMAC-SHA256 signature
    const token = crypto
      .createHmac('sha256', BUNNY_TOKEN_KEY)
      .update(stringToSign)
      .digest('hex');
    
    // Construct signed URL
    // Format: https://cdn.example.com/path?token=xxx&expires=xxx
    const separator = path.includes('?') ? '&' : '?';
    return `${BUNNY_CDN_URL}/${path}${separator}token=${token}&expires=${expires}`;
  } catch (error) {
    console.error('Error generating signed URL:', error);
    // Fallback to unsigned URL if signing fails
    return `${BUNNY_CDN_URL}/${path}`;
  }
}

