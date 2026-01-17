import { NextRequest, NextResponse } from 'next/server';
import { uploadToPlanetHoster, isPlanetHosterConfigured } from '~/lib/planethoster-sftp';
import { createErrorResponse, ErrorCodes, fileUploadSchema, validateRequest, isValidationError } from '~/lib/validation';
import { rateLimiters, getClientIdentifier } from '~/lib/rate-limit';
import { requirePro } from '~/lib/authz';
import { startRequestSpan } from '~/lib/observability';
import { recordError, recordRequest } from '~/lib/metrics';
import { isFeatureEnabledServer } from '@/lib/feature-flags';

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB for Pro users

export async function POST(request: NextRequest) {
  const span = startRequestSpan(request, 'storage.uploadPlanetHoster');
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
      recordRequest('/storage/upload-planethoster', 'POST', 429);
      span.end(429);
      return response;
    }

    const { auth, error, status } = await requirePro(request);
    if (error || !auth) {
      const statusCode = status || 403;
      recordRequest('/storage/upload-planethoster', 'POST', statusCode);
      span.end(statusCode);
      return error;
    }

    if (!isFeatureEnabledServer('planethosterUpload')) {
      const response = createErrorResponse(
        ErrorCodes.FEATURE_DISABLED,
        'PlanetHoster uploads are temporarily disabled.',
        503
      );
      recordRequest('/storage/upload-planethoster', 'POST', 503);
      span.end(503);
      return response;
    }

    // Check if PlanetHoster is configured
    if (!isPlanetHosterConfigured()) {
      const response = createErrorResponse(
        ErrorCodes.EXTERNAL_SERVICE_ERROR,
        'PlanetHoster SFTP is not configured. Please contact support.',
        503
      );
      recordRequest('/storage/upload-planethoster', 'POST', 503);
      span.end(503);
      return response;
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      const response = createErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'No file uploaded',
        400
      );
      recordRequest('/storage/upload-planethoster', 'POST', 400);
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
      recordRequest('/storage/upload-planethoster', 'POST', 400);
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
      recordRequest('/storage/upload-planethoster', 'POST', 400);
      span.end(400);
      return response;
    }

    if (file.size > MAX_FILE_SIZE) {
      const response = createErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        400
      );
      recordRequest('/storage/upload-planethoster', 'POST', 400);
      span.end(400);
      return response;
    }

    // Determine content type
    const contentType = file.type || 'application/octet-stream';

    // Generate unique path
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const fileExtension = file.name.split('.').pop() || '';
    const fileName = `${uniqueSuffix}.${fileExtension}`;
    const remotePath = `nexus/${auth.userId}/${fileName}`;

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to PlanetHoster via SFTP
    const result = await uploadToPlanetHoster(remotePath, buffer);

    // For PlanetHoster, the URL is already a secure proxy URL
    // No need to modify it - it's generated in uploadToPlanetHoster
    const response = NextResponse.json({
      id: uniqueSuffix,
      url: result.url, // Already a secure proxy URL
      size: file.size,
      filename: file.name,
      provider: 'planethoster',
    });
    recordRequest('/storage/upload-planethoster', 'POST', 200);
    span.end(200);
    return response;
  } catch (error: any) {
    console.error('Error uploading file to PlanetHoster:', error);
    const response = createErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      error.message || 'Failed to upload file to PlanetHoster',
      500,
      process.env.NODE_ENV === 'development' ? { originalError: error.message } : undefined
    );
    recordError('/storage/upload-planethoster');
    recordRequest('/storage/upload-planethoster', 'POST', 500);
    span.error(500, error);
    return response;
  }
}

