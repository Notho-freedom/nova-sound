import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthAndPro } from '../../../../lib/stripe-utils';
import { uploadToBunny } from '../../../../lib/bunny';

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB for Pro users

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuthAndPro(request);
    if (!auth) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Only Pro users can use Bunny Storage
    if (!auth.isPro) {
      return NextResponse.json(
        { error: 'Bunny Storage is only available for Pro users. Please upgrade to Pro.' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
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
    return NextResponse.json(
      { error: error.message || 'Failed to upload file to Bunny' },
      { status: 500 }
    );
  }
}

