import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthAndPro } from '~/lib/stripe-utils';
import { uploadToBunny } from '~/lib/bunny';
import { createErrorResponse, ErrorCodes } from '~/lib/validation';
import { rateLimiters, getClientIdentifier } from '~/lib/rate-limit';

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB for Pro users

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

    // Only Pro users can use Bunny Storage
    if (!auth.isPro) {
      return createErrorResponse(
        ErrorCodes.AUTHORIZATION_ERROR,
        'Bunny Storage is only available for Pro users. Please upgrade to Pro.',
        403
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return createErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'No file uploaded',
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

    if (file.size > MAX_FILE_SIZE) {
      return createErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        400
      );
    }

    // Determine content type
    const contentType = file.type || 'application/octet-stream';

    // Generate unique path
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const fileExtension = file.name.split('.').pop() || '';
    const fileName = `${uniqueSuffix}.${fileExtension}`;
    const path = `nexus/${auth.userId}/${fileName}`;

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Bunny
    const result = await uploadToBunny(path, buffer, contentType);

    return NextResponse.json({
      id: uniqueSuffix,
      url: result.url,
      size: file.size,
      filename: file.name,
      provider: 'bunny',
    });
  } catch (error: any) {
    console.error('Error uploading file to Bunny:', error);
    return createErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      error.message || 'Failed to upload file to Bunny',
      500,
      process.env.NODE_ENV === 'development' ? { originalError: error.message } : undefined
    );
  }
}

