import { NextRequest, NextResponse } from 'next/server';
import { readdir, stat } from 'fs/promises';
import path from 'path';
import { verifyAuth } from '../../auth/middleware';

const STORAGE_DIR = process.env.STORAGE_DIR || path.join(process.cwd(), 'storage');

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    const userDir = path.join(STORAGE_DIR, 'users', auth.userId);

    try {
      const files = await readdir(userDir);
      const fileList = await Promise.all(
        files.map(async (file) => {
          const filePath = path.join(userDir, file);
          const stats = await stat(filePath);
          return {
            id: path.basename(file, path.extname(file)),
            name: file,
            size: stats.size,
            uploadedAt: stats.birthtime.toISOString(),
          };
        })
      );

      return NextResponse.json(fileList);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return NextResponse.json([]);
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Error getting file list:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get file list' },
      { status: 500 }
    );
  }
}

