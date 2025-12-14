import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

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
    // SOLUTION PRO : latest.json est servi via /api/updates/latest
    // Cette route API peut accéder au filesystem et sert latest.json
    // On fait un fetch HTTP interne vers cette route API
    const baseUrl = process.env.UPDATE_BASE_URL 
      || (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : null)
      || 'https://nova-sound-nine.vercel.app';
    
    // Essayer d'abord la route API interne (plus fiable)
    const latestApiUrl = `${baseUrl}/api/updates/latest`;
    // Fallback vers le fichier statique
    const latestStaticUrl = `${baseUrl}/updates/latest.json`;
    
    let latestData;
    let fetchError: Error | null = null;
    
    // Essayer la route API d'abord
    try {
      const response = await fetch(latestApiUrl, {
        cache: 'no-store',
        headers: {
          'User-Agent': 'NEXUS-Update-API/1.0',
        },
      });
      
      if (response.ok) {
        latestData = await response.json();
        console.log('Successfully fetched latest.json via API route');
      } else {
        throw new Error(`API route returned ${response.status}`);
      }
    } catch (apiError) {
      console.warn('Failed to fetch via API route, trying static file:', apiError);
      fetchError = apiError as Error;
      
      // Fallback : essayer le fichier statique
      try {
        const response = await fetch(latestStaticUrl, {
          cache: 'no-store',
          headers: {
            'User-Agent': 'NEXUS-Update-API/1.0',
          },
        });
        
        if (response.ok) {
          latestData = await response.json();
          console.log('Successfully fetched latest.json via static file');
        } else {
          throw new Error(`Static file returned ${response.status}`);
        }
      } catch (staticError) {
        console.error('Failed to fetch latest.json via both methods:', staticError);
        fetchError = staticError as Error;
      }
    }
    
    if (!latestData) {
      // Fallback : essayer de lire via fs (pour développement local uniquement)
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

      if (latestJsonPath) {
        // Lire latest.json via fs (fallback pour développement local)
        latestData = JSON.parse(fs.readFileSync(latestJsonPath, 'utf-8'));
      } else {
        // Dernier recours : essayer de trouver le ZIP le plus récent via fs
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
    }
    
    // Construire l'URL complète du ZIP
    const zipUrl = latestData.zipUrl?.startsWith('http')
      ? latestData.zipUrl
      : `${baseUrl}${latestData.zipUrl || `/updates/${latestData.zipFileName}`}`;

    // Essayer de vérifier la taille du fichier (optionnel, peut échouer sur Vercel)
    let zipSize: number | undefined;
    try {
      const zipPath = path.join(process.cwd(), 'public', 'updates', latestData.zipFileName);
      if (fs.existsSync(zipPath)) {
        zipSize = fs.statSync(zipPath).size;
      }
    } catch (e) {
      // Ignorer si on ne peut pas accéder au fichier (normal sur Vercel)
    }

    return NextResponse.json({
      url: zipUrl,
      fileName: latestData.zipFileName,
      version: latestData.version,
      buildNumber: latestData.buildNumber,
      size: zipSize,
      buildDate: latestData.buildDate || new Date().toISOString(),
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
