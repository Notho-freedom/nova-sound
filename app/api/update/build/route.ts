import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Limite de taille (1000MB)
const MAX_BUILD_SIZE = 1000 * 1024 * 1024;

/**
 * API Route pour servir le build complet en ZIP
 * GET /api/update/build
 * 
 * Crée un ZIP du build actuel et le retourne
 * Utilisé par l'application Electron pour télécharger les mises à jour
 */
export async function GET() {
  try {
    // En production Vercel, le build est dans .next/standalone
    // Chercher le build dans plusieurs emplacements possibles
    const possiblePaths = [
      path.join(process.cwd(), 'local-ui'),
      path.join(process.cwd(), 'dist'),
      path.join(process.cwd(), '.next', 'standalone'),
      path.join(process.cwd(), '.next', 'standalone', 'app'),
    ];
    
    let buildDir: string | null = null;
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        // Vérifier qu'il y a des fichiers (pas juste un dossier vide)
        const files = fs.readdirSync(possiblePath);
        if (files.length > 0) {
          buildDir = possiblePath;
          break;
        }
      }
    }
    
    if (!buildDir) {
      console.error('Build directory not found');
      return NextResponse.json(
        { error: 'Build directory not found' },
        { status: 404 }
      );
    }

    // Vérifier la taille du build
    const getTotalSize = (dirPath: string): number => {
      let totalSize = 0;
      const items = fs.readdirSync(dirPath);
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stats = fs.statSync(itemPath);
        
        if (stats.isDirectory()) {
          totalSize += getTotalSize(itemPath);
        } else {
          totalSize += stats.size;
        }
      }
      
      return totalSize;
    };

    const buildSize = getTotalSize(buildDir);
    
    if (buildSize > MAX_BUILD_SIZE) {
      return NextResponse.json(
        { error: 'Build too large', size: buildSize, limit: MAX_BUILD_SIZE },
        { status: 413 }
      );
    }
    
    // Créer le zip en mémoire
    const archive = archiver('zip', {
      zlib: { level: 9 } // Compression maximale
    });
    
    const chunks: Buffer[] = [];
    
    return new Promise<NextResponse>((resolve, reject) => {
      archive.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      
      archive.on('end', () => {
        const buffer = Buffer.concat(chunks);
        
        console.log(`Build archive created: ${buffer.length} bytes`);
        
        resolve(new NextResponse(buffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/zip',
            'Content-Disposition': 'attachment; filename="nexus-build.zip"',
            'Content-Length': buffer.length.toString(),
            'Cache-Control': 'no-cache',
            'Access-Control-Allow-Origin': '*',
          },
        }));
      });
      
      archive.on('error', (err) => {
        console.error('Archive creation error:', err);
        reject(new NextResponse(
          JSON.stringify({ error: 'Failed to create archive', details: err.message }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
      });
      
      // Ajouter tout le contenu de buildDir au zip
      archive.directory(buildDir, false);
      archive.finalize();
    });
  } catch (error) {
    console.error('Failed to create build archive:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create build archive',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
