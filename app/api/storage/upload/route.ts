import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { verifyAuthAndPro } from '~/lib/stripe-utils';
import { uploadToBunny, isBunnyConfigured } from '~/lib/bunny';
import { uploadToPlanetHoster, isPlanetHosterConfigured } from '~/lib/planethoster-sftp';
import { createErrorResponse, ErrorCodes } from '~/lib/validation';
import { rateLimiters, getClientIdentifier } from '~/lib/rate-limit';

const STORAGE_DIR = process.env.STORAGE_DIR || path.join(process.cwd(), 'storage');
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB for free users
const MAX_FILE_SIZE_PRO = 500 * 1024 * 1024; // 500MB for Pro users

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request);
    const rateLimit = await rateLimiters.upload(clientId, false);
    if (!rateLimit.allowed) {
      return createErrorResponse(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        rateLimit.message || 'Upload limit exceeded',
        429,
        {
          resetTime: new Date(rateLimit.resetTime).toISOString(),
        }
      );
    }

    const auth = await verifyAuthAndPro(request);
    if (!auth) {
      return createErrorResponse(
        ErrorCodes.AUTHENTICATION_ERROR,
        'User not authenticated',
        401
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return createErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'No file uploaded. Please provide a file in the request.',
        400
      );
    }

    // Validate file type (optional - can be made stricter)
    const allowedTypes = [
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/flac', 'audio/aac', 'audio/ogg',
      'video/mp4', 'video/avi', 'video/mkv', 'video/webm',
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    ];
    if (file.type && !allowedTypes.includes(file.type) && !file.type.startsWith('audio/') && !file.type.startsWith('video/')) {
      return createErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        `File type not allowed: ${file.type}. Allowed types: audio, video, image files.`,
        400
      );
    }

    const maxSize = auth.isPro ? MAX_FILE_SIZE_PRO : MAX_FILE_SIZE;
    if (file.size > maxSize) {
      return createErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        `File too large. Maximum size is ${maxSize / 1024 / 1024}MB${auth.isPro ? '' : '. Upgrade to Pro for 500MB limit.'}`,
        400,
        {
          maxSize,
          fileSize: file.size,
          isPro: auth.isPro,
        }
      );
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const fileId = uniqueSuffix;
    const fileExtension = path.extname(file.name);

    // Pro users: upload to cloud storage (Bunny or PlanetHoster)
    if (auth.isPro) {
      console.log(`[Upload] Pro user ${auth.userId} uploading file: ${file.name} (${file.size} bytes)`);
      
      let lastError: Error | null = null;
      
      // Try Bunny first (if configured)
      if (isBunnyConfigured()) {
        console.log('[Upload] Bunny Storage is configured, attempting upload...');
        try {
          const fileName = `${fileId}${fileExtension}`;
          const bunnyPath = `nexus/${auth.userId}/${fileName}`;
          
          const bytes = await file.arrayBuffer();
          const buffer = Buffer.from(bytes);
          const contentType = file.type || 'application/octet-stream';
          
          console.log(`[Upload] Uploading to Bunny: ${bunnyPath} (${contentType})`);
          const result = await uploadToBunny(bunnyPath, buffer, contentType);
          console.log(`[Upload] ✅ Bunny upload successful: ${result.url}`);

          return NextResponse.json({
            id: fileId,
            url: result.url,
            size: file.size,
            filename: file.name,
            provider: 'bunny',
          });
        } catch (bunnyError: any) {
          console.error('[Upload] ❌ Bunny upload failed:', bunnyError.message || bunnyError);
          lastError = bunnyError instanceof Error ? bunnyError : new Error(bunnyError.message || 'Bunny upload failed');
          console.log('[Upload] Falling back to PlanetHoster...');
          // Continue to try PlanetHoster
        }
      } else {
        console.warn('[Upload] ⚠️ Bunny Storage not configured for Pro user');
      }

      // Try PlanetHoster SFTP (if configured)
      if (isPlanetHosterConfigured()) {
        try {
          const fileName = `${fileId}${fileExtension}`;
          const remotePath = `nexus/${auth.userId}/${fileName}`;
          
          const bytes = await file.arrayBuffer();
          const buffer = Buffer.from(bytes);
          
          console.log(`[Upload] Uploading to PlanetHoster: ${remotePath}`);
          const result = await uploadToPlanetHoster(remotePath, buffer);
          console.log(`[Upload] ✅ PlanetHoster upload successful: ${result.url}`);

          return NextResponse.json({
            id: fileId,
            url: result.url,
            size: file.size,
            filename: file.name,
            provider: 'planethoster',
          });
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
      return createErrorResponse(
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
    }

    // Free users or Bunny fallback: use local storage
    const userDir = path.join(STORAGE_DIR, 'users', auth.userId);
    await mkdir(userDir, { recursive: true });

    const fileName = fileId + fileExtension;
    const filePath = path.join(userDir, fileName);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    const fileUrl = `/api/storage/download/${fileId}`;

    return NextResponse.json({
      id: fileId,
      url: fileUrl,
      size: file.size,
      filename: file.name,
      provider: 'local',
    });
  } catch (error: unknown) {
    console.error('Error uploading file:', error);
    const err = error as { message?: string; code?: string };
    
    // Check if it's a known error type
    if (err.code === 'VALIDATION_ERROR' || err.code === 'AUTHENTICATION_ERROR') {
      return createErrorResponse(
        err.code,
        err.message || 'Upload failed',
        400
      );
    }
    
    return createErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      err.message || 'Failed to upload file. Please try again later.',
      500,
      process.env.NODE_ENV === 'development' ? { originalError: err.message } : undefined
    );
  }
}

