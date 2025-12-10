import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { verifyAuthAndPro } from '../../../lib/stripe-utils';
import { uploadToBunny } from '../../../lib/bunny';

const STORAGE_DIR = process.env.STORAGE_DIR || path.join(process.cwd(), 'storage');
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB for free users
const MAX_FILE_SIZE_PRO = 500 * 1024 * 1024; // 500MB for Pro users

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuthAndPro(request);
    if (!auth) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const maxSize = auth.isPro ? MAX_FILE_SIZE_PRO : MAX_FILE_SIZE;
    if (file.size > maxSize) {
      return NextResponse.json(
        { 
          error: `File too large. Maximum size is ${maxSize / 1024 / 1024}MB${auth.isPro ? '' : '. Upgrade to Pro for 500MB limit.'}` 
        },
        { status: 400 }
      );
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const fileId = uniqueSuffix;
    const fileExtension = path.extname(file.name);

    // Pro users: upload to Bunny Storage
    if (auth.isPro) {
      try {
        const fileName = `${fileId}${fileExtension}`;
        const bunnyPath = `nexus/${auth.userId}/${fileName}`;
        
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const contentType = file.type || 'application/octet-stream';
        
        const result = await uploadToBunny(bunnyPath, buffer, contentType);

        return NextResponse.json({
          id: fileId,
          url: result.url,
          size: file.size,
          filename: file.name,
          provider: 'bunny',
        });
      } catch (bunnyError: any) {
        console.error('Bunny upload failed, falling back to local storage:', bunnyError);
        // Fallback to local storage if Bunny fails
      }
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
  } catch (error: any) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload file' },
      { status: 500 }
    );
  }
}

