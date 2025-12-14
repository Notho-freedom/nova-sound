import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * API Route pour servir l'URL du build ZIP
 * GET /api/update/build
 * 
 * SOLUTION PRO : Le ZIP est généré au build et servi statiquement
 * Cette route retourne simplement l'URL du ZIP le plus récent
 * 
 * Utilisé par l'application Electron pour télécharger les mises à jour
 */
export async function GET() {
  try {
    // Lire latest.json qui contient les métadonnées du build le plus récent
    // Ce fichier est généré au build par generate-build-zip.js
    const cwd = process.cwd();
    const possibleLatestPaths = [
      path.join(cwd, 'public', 'updates', 'latest.json'),
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
      // Si latest.json n'existe pas, essayer de trouver le ZIP le plus récent
      const updatesDirs = [
        path.join(cwd, 'public', 'updates'),
        '/var/task/public/updates',
        '/vercel/path0/public/updates',
      ];

      let updatesDir: string | null = null;
      for (const dir of updatesDirs) {
        if (fs.existsSync(dir)) {
          updatesDir = dir;
          break;
        }
      }

      if (!updatesDir) {
        return NextResponse.json(
          { 
            error: 'No build available',
            message: 'Build ZIP not found. Make sure the build process completed successfully.'
          },
          { status: 404 }
        );
      }

      // Trouver le ZIP le plus récent
      const files = fs.readdirSync(updatesDir);
      const zipFiles = files.filter(f => f.endsWith('.zip'));
      
      if (zipFiles.length === 0) {
        return NextResponse.json(
          { 
            error: 'No build ZIP found',
            message: 'No ZIP files found in updates directory.'
          },
          { status: 404 }
        );
      }

      // Trier par date de modification (le plus récent en premier)
      const zipFilesWithStats = zipFiles.map(file => {
        const filePath = path.join(updatesDir!, file);
        const stats = fs.statSync(filePath);
        return { file, mtime: stats.mtime };
      }).sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      const latestZip = zipFilesWithStats[0].file;
      const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL 
        ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
        : process.env.UPDATE_BASE_URL || 'https://nova-sound-nine.vercel.app';

      return NextResponse.json({
        url: `${baseUrl}/updates/${latestZip}`,
        fileName: latestZip,
        size: fs.statSync(path.join(updatesDir, latestZip)).size,
        buildDate: zipFilesWithStats[0].mtime.toISOString(),
      }, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Lire latest.json
    const latestData = JSON.parse(fs.readFileSync(latestJsonPath, 'utf-8'));
    
    // Construire l'URL complète
    const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL 
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : process.env.UPDATE_BASE_URL || 'https://nova-sound-nine.vercel.app';

    const zipUrl = latestData.zipUrl?.startsWith('http')
      ? latestData.zipUrl
      : `${baseUrl}${latestData.zipUrl || `/updates/${latestData.zipFileName}`}`;

    // Vérifier que le fichier ZIP existe
    const zipPath = path.join(path.dirname(latestJsonPath), latestData.zipFileName);
    if (!fs.existsSync(zipPath)) {
      return NextResponse.json(
        { 
          error: 'Build ZIP not found',
          message: `ZIP file ${latestData.zipFileName} not found on server.`
        },
        { status: 404 }
      );
    }

    const zipStats = fs.statSync(zipPath);

    return NextResponse.json({
      url: zipUrl,
      fileName: latestData.zipFileName,
      version: latestData.version,
      buildNumber: latestData.buildNumber,
      size: zipStats.size,
      buildDate: latestData.buildDate || zipStats.mtime.toISOString(),
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Failed to get build URL:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get build URL',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
