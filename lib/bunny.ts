import axios from 'axios';

const BUNNY_STORAGE_NAME = process.env.BUNNY_STORAGE_NAME;
const BUNNY_API_KEY = process.env.BUNNY_API_KEY;
const BUNNY_CDN_URL = process.env.BUNNY_CDN_URL;
const BUNNY_STORAGE_URL = `https://storage.bunnycdn.com/${BUNNY_STORAGE_NAME}`;

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
 * Generate a signed URL for private content (optional - requires Bunny CDN token)
 */
export function generateSignedUrl(path: string, expiresIn: number = 3600): string {
  if (!BUNNY_CDN_URL) {
    return path;
  }

  // Note: Bunny CDN token signing requires additional configuration
  // This is a placeholder for future implementation
  return `${BUNNY_CDN_URL}/${path}`;
}

