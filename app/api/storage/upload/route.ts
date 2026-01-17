import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readdir, stat } from 'fs/promises';
import path from 'path';
import { verifyAuthAndPro } from '~/lib/stripe-utils';
import { uploadToBunny, isBunnyConfigured } from '~/lib/bunny';
import { uploadToPlanetHoster, isPlanetHosterConfigured } from '~/lib/planethoster-sftp';
import { createErrorResponse, ErrorCodes, fileUploadSchema, validateRequest, isValidationError } from '~/lib/validation';
import { rateLimiters, getClientIdentifier } from '~/lib/rate-limit';
import { startRequestSpan } from '~/lib/observability';
import { recordError, recordRequest } from '~/lib/metrics';
import { isFeatureEnabledServer } from '@/lib/feature-flags';

const STORAGE_DIR = process.env.STORAGE_DIR || path.join(process.cwd(), 'storage');
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB for free users
const MAX_FILE_SIZE_PRO = 500 * 1024 * 1024; // 500MB for Pro users
const MAX_LOCAL_STORAGE_FREE = 25 * 1024 * 1024 * 1024; // 25GB for free users

async function getDirectorySize(dirPath: string): Promise<number> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    let total = 0;
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        total += await getDirectorySize(fullPath);
      } else {
        const fileStat = await stat(fullPath);
        total += fileStat.size;
      }
    }
    return total;
  } catch (error) {
    return 0;
  }
}

export async function POST(request: NextRequest) {
  const span = startRequestSpan(request, 'storage.upload');
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request);
    const rateLimit = await rateLimiters.upload(clientId, false);
    if (!rateLimit.allowed) {
      const response = createErrorResponse(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        rateLimit.message || 'Upload limit exceeded',
        429,
        {
          resetTime: new Date(rateLimit.resetTime).toISOString(),
        }
      );
      recordRequest('/storage/upload', 'POST', 429);
      span.end(429);
      return response;
    }

    const auth = await verifyAuthAndPro(request);
    if (!auth) {
      const response = createErrorResponse(
        ErrorCodes.AUTHENTICATION_ERROR,
        'User not authenticated',
        401
      );
      recordRequest('/storage/upload', 'POST', 401);
      span.end(401);
      return response;
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      const response = createErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'No file uploaded. Please provide a file in the request.',
        400
      );
      recordRequest('/storage/upload', 'POST', 400);
      span.end(400);
      return response;
    }

    const fileValidation = validateRequest(fileUploadSchema, { file });
    if (isValidationError(fileValidation)) {
      const response = createErrorResponse(
        fileValidation.error.code,
        fileValidation.error.message,
        400,
        fileValidation.error.details
      );
      recordRequest('/storage/upload', 'POST', 400);
      span.end(400);
      return response;
    }

    // Validate file type (optional - can be made stricter)
    const allowedTypes = [
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/flac', 'audio/aac', 'audio/ogg',
      'video/mp4', 'video/avi', 'video/mkv', 'video/webm',
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    ];
    if (file.type && !allowedTypes.includes(file.type) && !file.type.startsWith('audio/') && !file.type.startsWith('video/')) {
      const response = createErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        `File type not allowed: ${file.type}. Allowed types: audio, video, image files.`,
        400
      );
      recordRequest('/storage/upload', 'POST', 400);
      span.end(400);
      return response;
    }

    const maxSize = auth.isPro ? MAX_FILE_SIZE_PRO : MAX_FILE_SIZE;
    if (file.size > maxSize) {
      const response = createErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        `File too large. Maximum size is ${maxSize / 1024 / 1024}MB${auth.isPro ? '' : '. Upgrade to Pro for 500MB limit.'}`,
        400,
        {
          maxSize,
          fileSize: file.size,
          isPro: auth.isPro,
        }
      );
      recordRequest('/storage/upload', 'POST', 400);
      span.end(400);
      return response;
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const fileId = uniqueSuffix;
    const fileExtension = path.extname(file.name);

    const target = request.nextUrl.searchParams.get('target');

    if (target !== 'local' && !isFeatureEnabledServer('cloudUpload')) {
      const response = createErrorResponse(
        ErrorCodes.FEATURE_DISABLED,
        'Cloud uploads are temporarily disabled.',
        503
      );
      recordRequest('/storage/upload', 'POST', 503);
      span.end(503);
      return response;
    }

    // Pro users: upload to cloud storage (Bunny or PlanetHoster), unless target=local
    if (auth.isPro && target !== 'local') {
      console.log(`[Upload] Pro user ${auth.userId} uploading file: ${file.name} (${file.size} bytes)`);
      
      let lastError: Error | null = null;
      
      // Pro users: Try Bunny first (serveur 1), then PlanetHoster (serveur 2)
      // Try Bunny first (serveur 1) - if configured
      if (isBunnyConfigured()) {
        console.log('[Upload] Bunny Storage is configured (serveur 1), attempting upload...');
        try {
          const fileName = `${fileId}${fileExtension}`;
          const bunnyPath = `nexus/${auth.userId}/${fileName}`;
          
          const bytes = await file.arrayBuffer();
          const buffer = Buffer.from(bytes);
          const contentType = file.type || 'application/octet-stream';
          
          console.log(`[Upload] Uploading to Bunny (serveur 1): ${bunnyPath} (${contentType})`);
          const result = await uploadToBunny(bunnyPath, buffer, contentType);
          console.log(`[Upload] ✅ Bunny upload successful (serveur 1): ${result.url}`);

          const response = NextResponse.json({
            id: fileId,
            url: result.url,
            size: file.size,
            filename: file.name,
            provider: 'bunny',
            server: 1, // Serveur 1
          });
          recordRequest('/storage/upload', 'POST', 200);
          span.end(200);
          return response;
        } catch (bunnyError: any) {
          console.error('[Upload] ❌ Bunny upload failed (serveur 1):', bunnyError.message || bunnyError);
          lastError = bunnyError instanceof Error ? bunnyError : new Error(bunnyError.message || 'Bunny upload failed');
          console.log('[Upload] Falling back to PlanetHoster (serveur 2)...');
          // Continue to try PlanetHoster
        }
      } else {
        console.warn('[Upload] ⚠️ Bunny Storage (serveur 1) not configured for Pro user');
      }

      // Try PlanetHoster SFTP (serveur 2) - if configured
      if (isPlanetHosterConfigured()) {
        try {
          const fileName = `${fileId}${fileExtension}`;
          const remotePath = `nexus/${auth.userId}/${fileName}`;
          
          const bytes = await file.arrayBuffer();
          const buffer = Buffer.from(bytes);
          
          console.log(`[Upload] Uploading to PlanetHoster: ${remotePath}`);
          const result = await uploadToPlanetHoster(remotePath, buffer);
          console.log(`[Upload] ✅ PlanetHoster upload successful: ${result.url}`);

          // For PlanetHoster, the URL is already a secure proxy URL
          // No need to modify it - it's generated in uploadToPlanetHoster
          const response = NextResponse.json({
            id: fileId,
            url: result.url, // Already a secure proxy URL
            size: file.size,
            filename: file.name,
            provider: 'planethoster',
          });
          recordRequest('/storage/upload', 'POST', 200);
          span.end(200);
          return response;
        } catch (planethosterError: any) {
          console.error('[Upload] ❌ PlanetHoster upload failed:', planethosterError.message || planethosterError);
          lastError = planethosterError instanceof Error ? planethosterError : new Error(planethosterError.message || 'PlanetHoster upload failed');
        }
      } else {
        console.warn('[Upload] ⚠️ PlanetHoster not configured for Pro user');
      }

      // If we reach here, both Bunny and PlanetHoster failed or are not configured
      // For Pro users, we should return an error instead of falling back to local storage
      const errorMessage = isBunnyConfigured() || isPlanetHosterConfigured()
        ? `Upload vers le cloud storage a échoué. ${lastError?.message || 'Veuillez réessayer.'}`
        : 'Aucun service de stockage cloud configuré. Veuillez configurer Bunny Storage ou PlanetHoster pour les utilisateurs Pro.';
      
      console.error(`[Upload] ❌ Pro user upload failed: ${errorMessage}`);
      const response = createErrorResponse(
        ErrorCodes.INTERNAL_ERROR,
        errorMessage,
        500,
        {
          isPro: true,
          bunnyConfigured: isBunnyConfigured(),
          planethosterConfigured: isPlanetHosterConfigured(),
          lastError: lastError?.message,
        }
      );
      recordRequest('/storage/upload', 'POST', 500);
      span.end(500);
      return response;
    }

    // Free users (and Pro target=local): use local storage
    console.log(`[Upload] Local upload for user ${auth.userId}: ${file.name} (${file.size} bytes)`);

    const userDir = path.join(STORAGE_DIR, 'users', auth.userId);
    await mkdir(userDir, { recursive: true });

    if (!auth.isPro) {
      const currentSize = await getDirectorySize(userDir);
      if (currentSize + file.size > MAX_LOCAL_STORAGE_FREE) {
        const response = createErrorResponse(
          ErrorCodes.VALIDATION_ERROR,
          `Limite de stockage local atteinte (25GB). Passez au plan Pro pour débloquer les serveurs cloud.`,
          400,
          {
            maxSize: MAX_LOCAL_STORAGE_FREE,
            currentSize,
            fileSize: file.size,
            isPro: false,
          }
        );
        recordRequest('/storage/upload', 'POST', 400);
        span.end(400);
        return response;
      }
    }

    const fileName = fileId + fileExtension;
    const filePath = path.join(userDir, fileName);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    const fileUrl = `/api/storage/download/${fileId}`;

    const response = NextResponse.json({
      id: fileId,
      url: fileUrl,
      size: file.size,
      filename: file.name,
      provider: 'local',
    });
    recordRequest('/storage/upload', 'POST', 200);
    span.end(200);
    return response;
  } catch (error: unknown) {
    console.error('Error uploading file:', error);
    const err = error as { message?: string; code?: string };
    
    // Check if it's a known error type
    if (err.code === 'VALIDATION_ERROR' || err.code === 'AUTHENTICATION_ERROR') {
      const response = createErrorResponse(
        err.code,
        err.message || 'Upload failed',
        400
      );
      recordRequest('/storage/upload', 'POST', 400);
      span.end(400);
      return response;
    }
    
    const response = createErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      err.message || 'Failed to upload file. Please try again later.',
      500,
      process.env.NODE_ENV === 'development' ? { originalError: err.message } : undefined
    );
    recordError('/storage/upload');
    recordRequest('/storage/upload', 'POST', 500);
    span.error(500, error);
    return response;
  }
}

