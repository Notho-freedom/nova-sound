/**
 * Upload validation utilities
 * 
 * Provides client-side validation for file uploads before sending to server.
 */

// File size limits
export const MAX_FILE_SIZE_FREE = 100 * 1024 * 1024; // 100MB for free users
export const MAX_FILE_SIZE_PRO = 500 * 1024 * 1024; // 500MB for Pro users

// Allowed MIME types
export const ALLOWED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/flac',
  'audio/aac',
  'audio/ogg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/opus',
  'audio/x-ms-wma',
  'audio/aiff',
];

export const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/x-msvideo',
  'video/x-matroska',
  'video/webm',
  'video/quicktime',
];

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

// Audio file extensions
export const AUDIO_EXTENSIONS = [
  'mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'opus', 'wma', 'aiff'
];

// Video file extensions
export const VIDEO_EXTENSIONS = [
  'mp4', 'avi', 'mkv', 'webm', 'mov'
];

// Image file extensions
export const IMAGE_EXTENSIONS = [
  'jpg', 'jpeg', 'png', 'gif', 'webp'
];

export interface ValidationResult {
  valid: boolean;
  error?: string;
  details?: {
    fileSize?: number;
    maxSize?: number;
    fileType?: string;
    extension?: string;
  };
}

/**
 * Get file extension from filename or path
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

/**
 * Get MIME type from file extension
 */
export function getMimeType(extension: string): string {
  const mimeTypes: Record<string, string> = {
    // Audio
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'flac': 'audio/flac',
    'aac': 'audio/aac',
    'ogg': 'audio/ogg',
    'm4a': 'audio/mp4',
    'opus': 'audio/opus',
    'wma': 'audio/x-ms-wma',
    'aiff': 'audio/aiff',
    // Video
    'mp4': 'video/mp4',
    'avi': 'video/x-msvideo',
    'mkv': 'video/x-matroska',
    'webm': 'video/webm',
    'mov': 'video/quicktime',
    // Image
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
  };
  return mimeTypes[extension] || 'application/octet-stream';
}

/**
 * Check if file type is allowed
 */
export function isAllowedFileType(
  mimeType: string,
  extension: string,
  allowedTypes: 'audio' | 'video' | 'image' | 'all' = 'all'
): boolean {
  const extLower = extension.toLowerCase();
  
  switch (allowedTypes) {
    case 'audio':
      return ALLOWED_AUDIO_TYPES.includes(mimeType) || AUDIO_EXTENSIONS.includes(extLower);
    case 'video':
      return ALLOWED_VIDEO_TYPES.includes(mimeType) || VIDEO_EXTENSIONS.includes(extLower);
    case 'image':
      return ALLOWED_IMAGE_TYPES.includes(mimeType) || IMAGE_EXTENSIONS.includes(extLower);
    case 'all':
    default:
      return (
        ALLOWED_AUDIO_TYPES.includes(mimeType) ||
        ALLOWED_VIDEO_TYPES.includes(mimeType) ||
        ALLOWED_IMAGE_TYPES.includes(mimeType) ||
        AUDIO_EXTENSIONS.includes(extLower) ||
        VIDEO_EXTENSIONS.includes(extLower) ||
        IMAGE_EXTENSIONS.includes(extLower)
      );
  }
}

/**
 * Validate file for upload
 */
export function validateFileForUpload(
  file: File | Blob,
  options: {
    isPro?: boolean;
    maxSize?: number;
    allowedTypes?: 'audio' | 'video' | 'image' | 'all';
    filename?: string;
  } = {}
): ValidationResult {
  const {
    isPro = false,
    maxSize = isPro ? MAX_FILE_SIZE_PRO : MAX_FILE_SIZE_FREE,
    allowedTypes = 'all',
    filename = file instanceof File ? file.name : 'unknown',
  } = options;

  // Check file size
  if (file.size > maxSize) {
    const maxSizeMB = Math.round(maxSize / (1024 * 1024));
    return {
      valid: false,
      error: `Fichier trop volumineux. Taille maximale: ${maxSizeMB}MB${isPro ? ' (Pro)' : ''}`,
      details: {
        fileSize: file.size,
        maxSize,
      },
    };
  }

  // Check file type
  const extension = getFileExtension(filename);
  const mimeType = file.type || getMimeType(extension);
  
  if (!isAllowedFileType(mimeType, extension, allowedTypes)) {
    return {
      valid: false,
      error: `Type de fichier non autorisé: ${extension || mimeType}`,
      details: {
        fileType: mimeType,
        extension,
      },
    };
  }

  return { valid: true };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Get file type category from extension or MIME type
 */
export function getFileCategory(
  filename: string,
  mimeType?: string
): 'audio' | 'video' | 'image' | 'other' {
  const extension = getFileExtension(filename);
  const type = mimeType || getMimeType(extension);
  
  if (AUDIO_EXTENSIONS.includes(extension) || type.startsWith('audio/')) {
    return 'audio';
  }
  if (VIDEO_EXTENSIONS.includes(extension) || type.startsWith('video/')) {
    return 'video';
  }
  if (IMAGE_EXTENSIONS.includes(extension) || type.startsWith('image/')) {
    return 'image';
  }
  return 'other';
}
