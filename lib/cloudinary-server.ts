/**
 * Server-side Cloudinary upload utility
 * Used for Free users (serveur 0)
 */

export interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  resource_type: string;
  format: string;
  bytes: number;
}

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  uploadPreset: string;
}

/**
 * Check if Cloudinary is configured
 */
export function isCloudinaryConfigured(): boolean {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
  return !!(cloudName && uploadPreset);
}

/**
 * Upload file to Cloudinary (server-side)
 * @param fileBuffer - File buffer to upload
 * @param fileName - Original file name
 * @param contentType - MIME type
 * @param publicId - Optional public ID for the file
 * @returns Upload result with secure URL
 */
export async function uploadToCloudinary(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string,
  publicId?: string
): Promise<CloudinaryUploadResult> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
  const apiKey = process.env.CLOUDINARY_API_KEY;

  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary not configured. CLOUDINARY_CLOUD_NAME and CLOUDINARY_UPLOAD_PRESET are required.');
  }

  // Determine resource type based on content type
  let resourceType = 'auto';
  if (contentType.startsWith('audio/')) {
    resourceType = 'video'; // Cloudinary uses "video" for audio files
  } else if (contentType.startsWith('video/')) {
    resourceType = 'video';
  } else if (contentType.startsWith('image/')) {
    resourceType = 'image';
  }

  // Convert buffer to base64
  const base64Data = fileBuffer.toString('base64');
  const dataUri = `data:${contentType};base64,${base64Data}`;

  // Build upload URL
  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

  // Build form data
  const formData = new URLSearchParams();
  formData.append('file', dataUri);
  formData.append('upload_preset', uploadPreset);
  if (publicId) {
    formData.append('public_id', publicId);
  }
  // Add folder structure
  formData.append('folder', 'nexus/free');

  try {
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Cloudinary upload error:', errorText);
      throw new Error(`Cloudinary upload failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();

    return {
      public_id: result.public_id,
      secure_url: result.secure_url,
      resource_type: result.resource_type,
      format: result.format,
      bytes: result.bytes,
    };
  } catch (error: any) {
    console.error('Error uploading to Cloudinary:', error);
    throw new Error(`Failed to upload to Cloudinary: ${error.message || error}`);
  }
}
