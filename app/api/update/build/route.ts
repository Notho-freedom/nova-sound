import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import archiver from 'archiver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    // Priorité: .next/standalone/local-ui (créé pendant le build) > .next/standalone > local-ui
    const cwd = process.cwd();
    const possiblePaths = [
      path.join(cwd, '.next', 'standalone', 'local-ui'),
      path.join(cwd, '.next', 'standalone'),
      path.join(cwd, '.next', 'standalone', 'app'),
      path.join(cwd, 'local-ui'),
      path.join(cwd, 'dist'),
      // Chemins alternatifs pour Vercel
      '/vercel/path0/.next/standalone/local-ui',
      '/vercel/path0/.next/standalone',
      '/vercel/path0/local-ui',
    ];
    
    // Sur Vercel, les fonctions serverless s'exécutent dans /var/task
    // Les fichiers du build sont dans un emplacement différent
    // Utiliser __dirname pour trouver le répertoire de la fonction
    const functionDir = __dirname || path.dirname(new URL(import.meta.url).pathname);
    
    // Chercher depuis le répertoire de la fonction (qui devrait être dans .next/server)
    const serverDir = path.join(functionDir, '../..');
    const standaloneDir = path.join(serverDir, 'standalone');
    const standaloneLocalUIDir = path.join(standaloneDir, 'local-ui');
    
    // Chemins à vérifier (priorité: local-ui dans standalone > standalone lui-même)
    const vercelPaths = [
      standaloneLocalUIDir,
      standaloneDir,
      path.join(standaloneDir, 'app'),
    ];
    
    // Log pour déboguer
    console.log('Searching for build directory.');
    console.log('CWD:', cwd);
    console.log('Function dir:', functionDir);
    console.log('Server dir:', serverDir);
    console.log('Standalone dir:', standaloneDir);
    
    let buildDir: string | null = null;
    
    // D'abord vérifier les chemins relatifs à la fonction
    for (const possiblePath of vercelPaths) {
      if (fs.existsSync(possiblePath)) {
        const files = fs.readdirSync(possiblePath);
        if (files.length > 0) {
          buildDir = possiblePath;
          console.log('Found build directory (relative to function):', buildDir);
          break;
        }
      }
    }
    
    // Si pas trouvé, vérifier les chemins absolus
    if (!buildDir) {
      for (const possiblePath of possiblePaths) {
        if (fs.existsSync(possiblePath)) {
          const files = fs.readdirSync(possiblePath);
          if (files.length > 0) {
            buildDir = possiblePath;
            console.log('Found build directory (absolute):', buildDir);
            break;
          }
        }
      }
    }
    
    if (!buildDir) {
      console.error('Build directory not found.');
      console.error('CWD:', cwd);
      console.error('Function dir:', functionDir);
      console.error('Checked relative paths:', vercelPaths);
      console.error('Checked absolute paths:', possiblePaths);
      
      // Lister les fichiers disponibles pour déboguer
      try {
        const cwdFiles = fs.existsSync(cwd) ? fs.readdirSync(cwd) : [];
        const functionFiles = fs.existsSync(functionDir) ? fs.readdirSync(functionDir) : [];
        console.error('Files in CWD:', cwdFiles);
        console.error('Files in function dir:', functionFiles);
      } catch (e) {
        console.error('Cannot list files:', e);
      }
      
      return NextResponse.json(
        { 
          error: 'Build directory not found', 
          cwd, 
          functionDir,
          checkedPaths: [...vercelPaths, ...possiblePaths] 
        },
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
