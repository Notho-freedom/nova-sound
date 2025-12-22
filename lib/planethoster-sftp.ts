/**
 * SFTP/FTP service for PlanetHoster
 * Uses SSH2-SFTP-Client for SFTP (port 22) and basic-ftp for FTP/FTPS (port 21)
 * 
 * ⚠️ SECURITY: 
 * - SFTP (port 22): 100% encrypted via SSH
 * - FTPS (port 21 with TLS): Encrypted via TLS
 * - FTP (port 21 without TLS): NOT SECURE - passwords in plain text
 * 
 * ⚠️ SERVER-ONLY: This module uses Node.js native modules and should only be imported in API routes
 */

// Dynamic import to avoid bundling issues with Next.js
// ssh2 uses native Node.js modules that can't be bundled for the client
let sftpClientModule: any = null;
let ftpClientModule: any = null;

async function getSFTPClient() {
  if (!sftpClientModule) {
    sftpClientModule = await import('ssh2-sftp-client');
  }
  // ssh2-sftp-client exports Client as default or named export
  return sftpClientModule.default || sftpClientModule.Client || sftpClientModule;
}

async function getFTPClient() {
  if (!ftpClientModule) {
    ftpClientModule = await import('basic-ftp');
  }
  return ftpClientModule;
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

  // Determine protocol based on port: port 21 = FTP/FTPS, port 22 = SFTP
  const useFTP = config.port === 21;
  const protocol = useFTP ? 'FTP/FTPS' : 'SFTP';

  // Retry logic with exponential backoff
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    let connectionEstablished = false;

    try {
      console.log(`[PlanetHoster] Attempt ${attempt + 1}/${maxRetries} - Connecting to ${protocol} server (port ${config.port})...`);
      
      if (useFTP) {
        // Use FTP/FTPS for port 21
        const ftpModule = await getFTPClient();
        const { Client: FTPClient } = ftpModule;
        const client = new FTPClient(60000); // 60 second timeout
        
        try {
          // Try FTPS first (secure)
          await client.access({
            host: config.host!,
            port: config.port,
            user: config.user!,
            password: config.password!,
            secure: 'implicit', // Try implicit TLS first
            secureOptions: {
              rejectUnauthorized: false, // Accept self-signed certificates for testing
            },
          });
          connectionEstablished = true;
          console.log(`[PlanetHoster] ✅ Connected via FTPS (implicit TLS) on attempt ${attempt + 1}`);
        } catch (implicitError: any) {
          // If implicit TLS fails, try explicit TLS
          try {
            await client.access({
              host: config.host!,
              port: config.port,
              user: config.user!,
              password: config.password!,
              secure: true, // Explicit TLS
              secureOptions: {
                rejectUnauthorized: false,
              },
            });
            connectionEstablished = true;
            console.log(`[PlanetHoster] ✅ Connected via FTPS (explicit TLS) on attempt ${attempt + 1}`);
          } catch (explicitError: any) {
            // If TLS fails, try plain FTP (not secure, but might work)
            try {
              await client.access({
                host: config.host!,
                port: config.port,
                user: config.user!,
                password: config.password!,
                secure: false, // Plain FTP
              });
              connectionEstablished = true;
              console.log(`[PlanetHoster] ⚠️ Connected via plain FTP (NOT SECURE) on attempt ${attempt + 1}`);
            } catch (plainError: any) {
              throw new Error(`FTP connection failed: ${plainError.message}`);
            }
          }
        }

        // Ensure directory exists
        const dirPath = fullRemotePath.substring(0, fullRemotePath.lastIndexOf('/'));
        if (dirPath) {
          try {
            await client.ensureDir(dirPath);
            console.log(`[PlanetHoster] ✅ Directory created/verified: ${dirPath}`);
          } catch (error: any) {
            console.warn(`[PlanetHoster] ⚠️ Directory creation warning: ${error.message}`);
          }
        }

        // Upload file
        console.log(`[PlanetHoster] 📤 Uploading file via FTP (${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB)...`);
        if (onProgress) {
          onProgress(10);
        }
        
        // Convert Buffer to Readable stream for basic-ftp
        const { Readable } = await import('stream');
        const stream = Readable.from(fileBuffer);
        await client.uploadFrom(stream, fullRemotePath);
        
        if (onProgress) {
          onProgress(100);
        }

        console.log(`[PlanetHoster] ✅ File uploaded successfully: ${fullRemotePath}`);
        client.close();

        // Return only the path, not the public URL (security: files are served via proxy)
        // The URL will be generated client-side using the secure proxy endpoint
        return {
          success: true,
          url: `/api/storage/proxy/planethoster?path=${encodeURIComponent(remotePath)}`,
          path: remotePath,
          size: fileBuffer.length,
        };
      } else {
        // Use SFTP for port 22 or other ports
        const sftp = await createSFTPClient();
        
        // Connect to SFTP server with increased timeout and additional options
        const connectConfig: any = {
          host: config.host!,
          port: config.port,
          username: config.user!,
          readyTimeout: 60000, // 60 seconds
          keepaliveInterval: 5000, // Send keepalive every 5 seconds
          keepaliveCountMax: 5, // Max keepalive failures before disconnect
          // Additional SSH options for better compatibility
          algorithms: {
            kex: [
              'diffie-hellman-group-exchange-sha256',
              'diffie-hellman-group14-sha256',
              'diffie-hellman-group-exchange-sha1',
              'diffie-hellman-group14-sha1',
              'diffie-hellman-group1-sha1',
            ],
            cipher: [
              'aes128-ctr',
              'aes192-ctr',
              'aes256-ctr',
              'aes128-gcm',
              'aes256-gcm',
              'aes128-cbc',
              'aes192-cbc',
              'aes256-cbc',
              '3des-cbc',
            ],
            serverHostKey: [
              'ssh-rsa',
              'ssh-dss',
              'ecdsa-sha2-nistp256',
              'ecdsa-sha2-nistp384',
              'ecdsa-sha2-nistp521',
            ],
            hmac: [
              'hmac-sha2-256',
              'hmac-sha2-512',
              'hmac-sha1',
              'hmac-md5',
            ],
          },
          strictVendor: false,
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
        const connectTimeout = 60000; // 60s
        const connectPromise = sftp.connect(connectConfig);
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`Connection timeout after ${connectTimeout / 1000} seconds`)), connectTimeout);
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
        console.log(`[PlanetHoster] 📤 Uploading file via SFTP (${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB)...`);
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

        // Return only the path, not the public URL (security: files are served via proxy)
        // The URL will be generated client-side using the secure proxy endpoint
        // Close connection before returning
        try {
          await sftp.end();
        } catch (closeError) {
          // Ignore close errors
        }

        return {
          success: true,
          url: `/api/storage/proxy/planethoster?path=${encodeURIComponent(remotePath)}`,
          path: remotePath,
          size: fileBuffer.length,
        };
      }
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

  const fullRemotePath = `${config.basePath}/${remotePath}`.replace(/\/+/g, '/');
  const useFTP = config.port === 21;

  if (useFTP) {
    // Use FTP/FTPS for port 21
    const ftpModule = await getFTPClient();
    const { Client: FTPClient } = ftpModule;
    const client = new FTPClient(60000);

    try {
      // Try FTPS first (secure)
      try {
        await client.access({
          host: config.host!,
          port: config.port,
          user: config.user!,
          password: config.password!,
          secure: 'implicit',
          secureOptions: { rejectUnauthorized: false },
        });
      } catch {
        try {
          await client.access({
            host: config.host!,
            port: config.port,
            user: config.user!,
            password: config.password!,
            secure: true,
            secureOptions: { rejectUnauthorized: false },
          });
        } catch {
          await client.access({
            host: config.host!,
            port: config.port,
            user: config.user!,
            password: config.password!,
            secure: false,
          });
        }
      }

      await client.remove(fullRemotePath);
      client.close();
      return;
    } catch (error: any) {
      client.close();
      throw new Error(`Failed to delete from PlanetHoster: ${error.message}`);
    }
  } else {
    // Use SFTP for port 22 or other ports
    const sftp = await createSFTPClient();

    try {
      await sftp.connect({
        host: config.host!,
        port: config.port,
        username: config.user!,
        readyTimeout: 30000,
        keepaliveInterval: 10000,
        keepaliveCountMax: 3,
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
      await sftp.end();
    } catch (error: any) {
      console.error('PlanetHoster SFTP delete error:', error.message);
      await sftp.end();
      throw new Error(`Failed to delete from PlanetHoster: ${error.message}`);
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

/**
 * Read a file from PlanetHoster via SFTP/FTP
 * Used by the secure proxy to serve files to authenticated users
 * 
 * @param remotePath - Path on the server (e.g., "nexus/user123/file.mp3")
 * @returns File content as Buffer
 */
export async function readFileFromPlanetHoster(remotePath: string): Promise<Buffer> {
  const config = getPlanetHosterConfig();
  
  if (!(config.host && config.user && (config.password || config.privateKey))) {
    throw new Error('PlanetHoster SFTP is not configured');
  }

  const fullRemotePath = `${config.basePath}/${remotePath}`.replace(/\/+/g, '/');
  
  // Always use SFTP for reading files (more reliable than FTP)
  // If port 21 is configured, we'll still try SFTP on port 22 as fallback
  const sftp = await createSFTPClient();

  try {
    // Try configured port first
    let connected = false;
    try {
      await sftp.connect({
        host: config.host!,
        port: config.port,
        username: config.user!,
        readyTimeout: 60000,
        keepaliveInterval: 10000,
        keepaliveCountMax: 3,
        ...(config.privateKey
          ? {
              privateKey: config.privateKey.replace(/\\n/g, '\n'),
              passphrase: config.passphrase,
            }
          : {
              password: config.password!,
            }),
      });
      connected = true;
    } catch (error: any) {
      // If port 21 fails, try port 22 (standard SFTP port)
      if (config.port === 21) {
        console.log('[PlanetHoster] Port 21 failed, trying SFTP on port 22...');
        try {
          await sftp.connect({
            host: config.host!,
            port: 22,
            username: config.user!,
            readyTimeout: 60000,
            keepaliveInterval: 10000,
            keepaliveCountMax: 3,
            ...(config.privateKey
              ? {
                  privateKey: config.privateKey.replace(/\\n/g, '\n'),
                  passphrase: config.passphrase,
                }
              : {
                  password: config.password!,
                }),
          });
          connected = true;
        } catch (fallbackError: any) {
          throw new Error(`Failed to connect to PlanetHoster: ${fallbackError.message}`);
        }
      } else {
        throw error;
      }
    }

    if (!connected) {
      throw new Error('Failed to connect to PlanetHoster');
    }

    const fileBuffer = await sftp.get(fullRemotePath);
    await sftp.end();
    
    // Convert to Buffer if needed
    if (Buffer.isBuffer(fileBuffer)) {
      return fileBuffer;
    } else if (typeof fileBuffer === 'string') {
      return Buffer.from(fileBuffer, 'utf-8');
    } else {
      // If it's a stream, read it
      const chunks: Buffer[] = [];
      for await (const chunk of fileBuffer as any) {
        chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    }
  } catch (error: any) {
    console.error('PlanetHoster SFTP read error:', error.message);
    try {
      await sftp.end();
    } catch {
      // Ignore close errors
    }
    
    if (error.message?.includes('No such file') || error.message?.includes('not found')) {
      throw new Error(`File not found: ${remotePath}`);
    }
    throw new Error(`Failed to read from PlanetHoster: ${error.message}`);
  }
}

