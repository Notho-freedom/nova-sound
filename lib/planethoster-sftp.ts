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
let sftpClientModule: any = null;

async function getSFTPClient() {
  if (!sftpClientModule) {
    sftpClientModule = await import('ssh2-sftp-client');
  }
  // ssh2-sftp-client exports Client as default or named export
  return sftpClientModule.default || sftpClientModule.Client || sftpClientModule;
}

// Helper functions to read env vars dynamically (avoids module-level caching issues)
function getPlanetHosterConfig() {
  return {
    host: process.env.PLANETHOSTER_SFTP_HOST,
    port: parseInt(process.env.PLANETHOSTER_SFTP_PORT || '22', 10),
    user: process.env.PLANETHOSTER_SFTP_USER,
    password: process.env.PLANETHOSTER_SFTP_PASSWORD,
    privateKey: process.env.PLANETHOSTER_SFTP_PRIVATE_KEY,
    passphrase: process.env.PLANETHOSTER_SFTP_PASSPHRASE,
    basePath: process.env.PLANETHOSTER_SFTP_BASE_PATH || '/',
    cdnUrl: process.env.PLANETHOSTER_CDN_URL,
  };
}

// Keep constants for backward compatibility, but use getPlanetHosterConfig() in functions
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
  const config = getPlanetHosterConfig();
  return !!(
    config.host &&
    config.user &&
    (config.password || config.privateKey)
  );
}

/**
 * Create SFTP client with proper authentication
 */
async function createSFTPClient() {
  const ClientClass = await getSFTPClient();
  const sftp = new ClientClass();
  
  // Note: Connection config is now passed directly to sftp.connect() in uploadToPlanetHoster
  // This function just creates the client instance
  // The actual connection happens in uploadToPlanetHoster with retry logic

  return sftp;
}

/**
 * Upload a file to PlanetHoster via SFTP with retry logic
 * 
 * @param remotePath - Path on the server (e.g., "nexus/user123/file.mp3")
 * @param fileBuffer - File content as Buffer
 * @param onProgress - Optional progress callback (0-100)
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns Upload result with URL
 */
export async function uploadToPlanetHoster(
  remotePath: string,
  fileBuffer: Buffer,
  onProgress?: (progress: number) => void,
  maxRetries: number = 3
): Promise<PlanetHosterUploadResult> {
  const config = getPlanetHosterConfig();
  
  if (!(config.host && config.user && (config.password || config.privateKey))) {
    throw new Error(
      'PlanetHoster SFTP is not configured. Please set PLANETHOSTER_SFTP_HOST, PLANETHOSTER_SFTP_USER, and PLANETHOSTER_SFTP_PASSWORD or PLANETHOSTER_SFTP_PRIVATE_KEY in .env'
    );
  }

  const fullRemotePath = `${config.basePath}/${remotePath}`.replace(/\/+/g, '/');
  let lastError: Error | null = null;

  // Retry logic with exponential backoff
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const sftp = await createSFTPClient();
    let connectionEstablished = false;

    try {
      console.log(`[PlanetHoster] Attempt ${attempt + 1}/${maxRetries} - Connecting to SFTP server...`);
      
      // Connect to SFTP server with increased timeout
      const connectConfig = {
        host: config.host!,
        port: config.port,
        username: config.user!,
        readyTimeout: 30000, // 30 seconds (increased from 20)
        keepaliveInterval: 10000, // Send keepalive every 10 seconds
        keepaliveCountMax: 3, // Max keepalive failures before disconnect
        ...(config.privateKey
          ? {
              privateKey: config.privateKey.replace(/\\n/g, '\n'),
              passphrase: config.passphrase,
            }
          : {
              password: config.password!,
            }),
      };

      // Add connection timeout wrapper
      const connectPromise = sftp.connect(connectConfig);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout after 30 seconds')), 30000);
      });

      await Promise.race([connectPromise, timeoutPromise]);
      connectionEstablished = true;
      console.log(`[PlanetHoster] ✅ Connected successfully on attempt ${attempt + 1}`);

      // Ensure directory exists
      const dirPath = fullRemotePath.substring(0, fullRemotePath.lastIndexOf('/'));
      if (dirPath) {
        try {
          await sftp.mkdir(dirPath, true); // recursive: true
          console.log(`[PlanetHoster] ✅ Directory created/verified: ${dirPath}`);
        } catch (error: any) {
          // Directory might already exist, ignore error
          if (error.code !== 4 && !error.message?.includes('already exists')) { // SSH2_FX_FAILURE
            console.warn(`[PlanetHoster] ⚠️ Directory creation warning: ${error.message}`);
            // Continue anyway - directory might exist
          }
        }
      }

      // Upload file with progress tracking
      console.log(`[PlanetHoster] 📤 Uploading file (${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB)...`);
      if (onProgress && fileBuffer.length > 1024 * 1024) { // Only for files > 1MB
        // Simulate progress (SFTP doesn't provide real-time progress)
        onProgress(10);
        await sftp.put(fileBuffer, fullRemotePath);
        onProgress(100);
      } else {
        await sftp.put(fileBuffer, fullRemotePath);
        onProgress?.(100);
      }

      console.log(`[PlanetHoster] ✅ File uploaded successfully: ${fullRemotePath}`);

      // Construct public URL
      const publicUrl = config.cdnUrl
        ? `${config.cdnUrl}/${remotePath}`
        : `https://${config.host}/${remotePath}`;

      // Close connection before returning
      try {
        await sftp.end();
      } catch (closeError) {
        // Ignore close errors
      }

      return {
        success: true,
        url: publicUrl,
        path: remotePath,
        size: fileBuffer.length,
      };
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorMessage = error.message || String(error);
      
      console.error(`[PlanetHoster] ❌ Upload attempt ${attempt + 1}/${maxRetries} failed:`, errorMessage);
      
      // Close connection if it was established
      if (connectionEstablished) {
        try {
          await sftp.end();
        } catch (closeError) {
          // Ignore close errors
        }
      }

      // Check if error is retryable
      const isRetryable = 
        errorMessage.includes('timeout') ||
        errorMessage.includes('Timed out') ||
        errorMessage.includes('handshake') ||
        errorMessage.includes('Connection') ||
        errorMessage.includes('ECONNRESET') ||
        errorMessage.includes('ETIMEDOUT') ||
        errorMessage.includes('ENOTFOUND') ||
        errorMessage.includes('ECONNREFUSED');

      // If not retryable or last attempt, throw error
      if (!isRetryable || attempt === maxRetries - 1) {
        throw new Error(`Failed to upload to PlanetHoster: ${errorMessage}`);
      }

      // Exponential backoff: wait 2^attempt seconds before retry
      const waitTime = Math.min(1000 * Math.pow(2, attempt), 10000); // Max 10 seconds
      console.log(`[PlanetHoster] ⏳ Retrying in ${waitTime / 1000}s...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError || new Error('Failed to upload to PlanetHoster: Unknown error');
}

/**
 * Delete a file from PlanetHoster via SFTP
 */
export async function deleteFromPlanetHoster(remotePath: string): Promise<void> {
  const config = getPlanetHosterConfig();
  
  if (!(config.host && config.user && (config.password || config.privateKey))) {
    throw new Error('PlanetHoster SFTP is not configured');
  }

  const sftp = await createSFTPClient();
  const fullRemotePath = `${config.basePath}/${remotePath}`.replace(/\/+/g, '/');

  try {
    await sftp.connect({
      host: config.host!,
      port: config.port,
      username: config.user!,
      readyTimeout: 30000, // 30 seconds (increased from 20)
      keepaliveInterval: 10000, // Send keepalive every 10 seconds
      keepaliveCountMax: 3, // Max keepalive failures before disconnect
      ...(config.privateKey
        ? {
            privateKey: config.privateKey.replace(/\\n/g, '\n'),
            passphrase: config.passphrase,
          }
        : {
            password: config.password!,
          }),
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
  const config = getPlanetHosterConfig();
  
  if (!(config.host && config.user && (config.password || config.privateKey))) {
    return false;
  }

  const sftp = await createSFTPClient();
  const fullRemotePath = `${config.basePath}/${remotePath}`.replace(/\/+/g, '/');

  try {
    await sftp.connect({
      host: config.host!,
      port: config.port,
      username: config.user!,
      readyTimeout: 30000, // 30 seconds (increased from 20)
      keepaliveInterval: 10000, // Send keepalive every 10 seconds
      keepaliveCountMax: 3, // Max keepalive failures before disconnect
      ...(config.privateKey
        ? {
            privateKey: config.privateKey.replace(/\\n/g, '\n'),
            passphrase: config.passphrase,
          }
        : {
            password: config.password!,
          }),
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

