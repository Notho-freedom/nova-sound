import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * API Route pour servir latest.json
 * GET /api/updates/latest
 * 
 * Cette route sert le fichier latest.json qui contient les métadonnées du build le plus récent
 * Elle lit depuis plusieurs emplacements possibles pour fonctionner sur Vercel et en local
 */
export async function GET() {
  try {
    const cwd = process.cwd();
    const possibleLatestPaths = [
      path.join(cwd, 'public', 'updates', 'latest.json'),
      path.join(cwd, '.next', 'standalone', 'public', 'updates', 'latest.json'),
      '/var/task/public/updates/latest.json',
      '/vercel/path0/public/updates/latest.json',
    ];

    let latestJsonPath: string | null = null;
    for (const possiblePath of possibleLatestPaths) {
      if (fs.existsSync(possiblePath)) {
        latestJsonPath = possiblePath;
        break;
      }
    }

    if (!latestJsonPath) {
      return NextResponse.json(
        { error: 'latest.json not found' },
        { status: 404 }
      );
    }

    const latestData = JSON.parse(fs.readFileSync(latestJsonPath, 'utf-8'));

    return NextResponse.json(latestData, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Failed to read latest.json:', error);
    return NextResponse.json(
      { 
        error: 'Failed to read latest.json',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

