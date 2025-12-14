/**
 * SFTP service for PlanetHoster
 * Uses SSH2-SFTP-Client for secure file transfers
 * 
 * ⚠️ SECURITY: SFTP is 100% encrypted, unlike FTP which sends passwords in plain text
 * 
 * ⚠️ SERVER-ONLY: This module uses Node.js native modules and should only be imported in API routes
 */

// Dynamic import to avoid bundling issues with Next.js
// ssh2 uses native Node.js modules that can't be bundled for the client
// Use require() at runtime to avoid Next.js trying to bundle it
let sftpClientModule: any = null;

async function getSFTPClient() {
  if (!sftpClientModule) {
    // Use dynamic require() to avoid Next.js/Turbopack trying to bundle ssh2
    // ssh2 contains native Node.js modules that cannot be bundled
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    sftpClientModule = require('ssh2-sftp-client');
  }
  // ssh2-sftp-client exports Client as default or named export
  return sftpClientModule.default || sftpClientModule.Client || sftpClientModule;
}

const PLANETHOSTER_SFTP_HOST = process.env.PLANETHOSTER_SFTP_HOST;
const PLANETHOSTER_SFTP_PORT = parseInt(process.env.PLANETHOSTER_SFTP_PORT || '22', 10);
const PLANETHOSTER_SFTP_USER = process.env.PLANETHOSTER_SFTP_USER;
const PLANETHOSTER_SFTP_PASSWORD = process.env.PLANETHOSTER_SFTP_PASSWORD;
const PLANETHOSTER_SFTP_PRIVATE_KEY = process.env.PLANETHOSTER_SFTP_PRIVATE_KEY; // Optional: SSH private key (preferred over password)
const PLANETHOSTER_SFTP_PASSPHRASE = process.env.PLANETHOSTER_SFTP_PASSPHRASE; // Optional: Passphrase for private key
const PLANETHOSTER_SFTP_BASE_PATH = process.env.PLANETHOSTER_SFTP_BASE_PATH || '/';
const PLANETHOSTER_CDN_URL = process.env.PLANETHOSTER_CDN_URL; // Base URL for accessing uploaded files

export interface PlanetHosterUploadResult {
  success: boolean;
  url: string;
  path: string;
  size: number;
}

/**
 * Check if PlanetHoster SFTP is configured
 */
export function isPlanetHosterConfigured(): boolean {
  return !!(
    PLANETHOSTER_SFTP_HOST &&
    PLANETHOSTER_SFTP_USER &&
    (PLANETHOSTER_SFTP_PASSWORD || PLANETHOSTER_SFTP_PRIVATE_KEY)
  );
}

/**
 * Create SFTP client with proper authentication
 */
async function createSFTPClient() {
  const ClientClass = await getSFTPClient();
  const sftp = new ClientClass();
  
  // Configure connection options
  const config: any = {
    host: PLANETHOSTER_SFTP_HOST,
    port: PLANETHOSTER_SFTP_PORT,
    username: PLANETHOSTER_SFTP_USER,
    readyTimeout: 20000, // 20 seconds timeout
    retries: 2,
    retry_factor: 2,
    retry_delay: 2000,
  };

  // Prefer SSH key authentication (more secure) over password
  if (PLANETHOSTER_SFTP_PRIVATE_KEY) {
    config.privateKey = PLANETHOSTER_SFTP_PRIVATE_KEY.replace(/\\n/g, '\n');
    if (PLANETHOSTER_SFTP_PASSPHRASE) {
      config.passphrase = PLANETHOSTER_SFTP_PASSPHRASE;
    }
  } else if (PLANETHOSTER_SFTP_PASSWORD) {
    config.password = PLANETHOSTER_SFTP_PASSWORD;
  } else {
    throw new Error('PlanetHoster SFTP: No authentication method provided. Set PLANETHOSTER_SFTP_PASSWORD or PLANETHOSTER_SFTP_PRIVATE_KEY');
  }

  return sftp;
}

/**
 * Upload a file to PlanetHoster via SFTP
 * 
 * @param remotePath - Path on the server (e.g., "nexus/user123/file.mp3")
 * @param fileBuffer - File content as Buffer
 * @param onProgress - Optional progress callback (0-100)
 * @returns Upload result with URL
 */
export async function uploadToPlanetHoster(
  remotePath: string,
  fileBuffer: Buffer,
  onProgress?: (progress: number) => void
): Promise<PlanetHosterUploadResult> {
  if (!isPlanetHosterConfigured()) {
    throw new Error(
      'PlanetHoster SFTP is not configured. Please set PLANETHOSTER_SFTP_HOST, PLANETHOSTER_SFTP_USER, and PLANETHOSTER_SFTP_PASSWORD or PLANETHOSTER_SFTP_PRIVATE_KEY in .env'
    );
  }

  const sftp = await createSFTPClient();
  const fullRemotePath = `${PLANETHOSTER_SFTP_BASE_PATH}/${remotePath}`.replace(/\/+/g, '/');

  try {
    // Connect to SFTP server
    await sftp.connect({
      host: PLANETHOSTER_SFTP_HOST!,
      port: PLANETHOSTER_SFTP_PORT,
      username: PLANETHOSTER_SFTP_USER!,
      ...(PLANETHOSTER_SFTP_PRIVATE_KEY
        ? {
            privateKey: PLANETHOSTER_SFTP_PRIVATE_KEY.replace(/\\n/g, '\n'),
            passphrase: PLANETHOSTER_SFTP_PASSPHRASE,
          }
        : {
            password: PLANETHOSTER_SFTP_PASSWORD!,
          }),
      readyTimeout: 20000,
    });

    // Ensure directory exists
    const dirPath = fullRemotePath.substring(0, fullRemotePath.lastIndexOf('/'));
    if (dirPath) {
      try {
        await sftp.mkdir(dirPath, true); // recursive: true
      } catch (error: any) {
        // Directory might already exist, ignore error
        if (error.code !== 4) { // SSH2_FX_FAILURE
          throw error;
        }
      }
    }

    // Upload file with progress tracking
    // Note: ssh2-sftp-client doesn't support progress callbacks directly
    // We'll simulate progress for large files
    if (onProgress && fileBuffer.length > 1024 * 1024) { // Only for files > 1MB
      // Simulate progress (SFTP doesn't provide real-time progress)
      onProgress(10);
      await sftp.put(fileBuffer, fullRemotePath);
      onProgress(100);
    } else {
      await sftp.put(fileBuffer, fullRemotePath);
      onProgress?.(100);
    }

    // Construct public URL
    const publicUrl = PLANETHOSTER_CDN_URL
      ? `${PLANETHOSTER_CDN_URL}/${remotePath}`
      : `https://${PLANETHOSTER_SFTP_HOST}/${remotePath}`;

    return {
      success: true,
      url: publicUrl,
      path: remotePath,
      size: fileBuffer.length,
    };
  } catch (error: any) {
    console.error('PlanetHoster SFTP upload error:', error.message);
    throw new Error(`Failed to upload to PlanetHoster: ${error.message}`);
  } finally {
    // Always close the connection
    try {
      await sftp.end();
    } catch (closeError) {
      // Ignore close errors
    }
  }
}

/**
 * Delete a file from PlanetHoster via SFTP
 */
export async function deleteFromPlanetHoster(remotePath: string): Promise<void> {
  if (!isPlanetHosterConfigured()) {
    throw new Error('PlanetHoster SFTP is not configured');
  }

  const sftp = await createSFTPClient();
  const fullRemotePath = `${PLANETHOSTER_SFTP_BASE_PATH}/${remotePath}`.replace(/\/+/g, '/');

  try {
    await sftp.connect({
      host: PLANETHOSTER_SFTP_HOST!,
      port: PLANETHOSTER_SFTP_PORT,
      username: PLANETHOSTER_SFTP_USER!,
      ...(PLANETHOSTER_SFTP_PRIVATE_KEY
        ? {
            privateKey: PLANETHOSTER_SFTP_PRIVATE_KEY.replace(/\\n/g, '\n'),
            passphrase: PLANETHOSTER_SFTP_PASSPHRASE,
          }
        : {
            password: PLANETHOSTER_SFTP_PASSWORD!,
          }),
      readyTimeout: 20000,
    });

    await sftp.delete(fullRemotePath);
  } catch (error: any) {
    console.error('PlanetHoster SFTP delete error:', error.message);
    throw new Error(`Failed to delete from PlanetHoster: ${error.message}`);
  } finally {
    try {
      await sftp.end();
    } catch (closeError) {
      // Ignore close errors
    }
  }
}

/**
 * Check if a file exists on PlanetHoster
 */
export async function fileExistsOnPlanetHoster(remotePath: string): Promise<boolean> {
  if (!isPlanetHosterConfigured()) {
    return false;
  }

  const sftp = await createSFTPClient();
  const fullRemotePath = `${PLANETHOSTER_SFTP_BASE_PATH}/${remotePath}`.replace(/\/+/g, '/');

  try {
    await sftp.connect({
      host: PLANETHOSTER_SFTP_HOST!,
      port: PLANETHOSTER_SFTP_PORT,
      username: PLANETHOSTER_SFTP_USER!,
      ...(PLANETHOSTER_SFTP_PRIVATE_KEY
        ? {
            privateKey: PLANETHOSTER_SFTP_PRIVATE_KEY.replace(/\\n/g, '\n'),
            passphrase: PLANETHOSTER_SFTP_PASSPHRASE,
          }
        : {
            password: PLANETHOSTER_SFTP_PASSWORD!,
          }),
      readyTimeout: 20000,
    });

    const stats = await sftp.stat(fullRemotePath);
    return !!stats;
  } catch (error: any) {
    // File doesn't exist or error accessing it
    return false;
  } finally {
    try {
      await sftp.end();
    } catch (closeError) {
      // Ignore close errors
    }
  }
}

