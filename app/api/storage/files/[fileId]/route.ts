import { NextRequest, NextResponse } from 'next/server';
import { readdir, unlink } from 'fs/promises';
import path from 'path';
import { verifyAuth } from '../../../auth/middleware';

const STORAGE_DIR = process.env.STORAGE_DIR || path.join(process.cwd(), 'storage');

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    const { fileId } = await params;
    const userDir = path.join(STORAGE_DIR, 'users', auth.userId);

    // Find file by ID
    const files = await readdir(userDir);
    const file = files.find((f) => f.startsWith(fileId));

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const filePath = path.join(userDir, file);
    await unlink(filePath);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting file:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete file' },
      { status: 500 }
    );
  }
}

