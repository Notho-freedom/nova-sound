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
    // Priorité: public/local-ui (accessible depuis les routes API) > .next/standalone/local-ui > .next/standalone > local-ui
    const cwd = process.cwd();
    const possiblePaths = [
      path.join(cwd, 'public', 'local-ui'), // Priorité: accessible depuis les routes API
      path.join(cwd, '.next', 'standalone', 'local-ui'),
      path.join(cwd, '.next', 'standalone'),
      path.join(cwd, '.next', 'standalone', 'app'),
      path.join(cwd, 'local-ui'),
      path.join(cwd, 'dist'),
      // Chemins alternatifs pour Vercel
      '/var/task/public/local-ui',
      '/vercel/path0/public/local-ui',
      '/vercel/path0/.next/standalone/local-ui',
      '/vercel/path0/.next/standalone',
      '/vercel/path0/local-ui',
    ];
    
    // Sur Vercel, les fonctions serverless sont dans /var/task/app/api/...
    // Le build standalone est déployé mais peut être dans un emplacement différent
    // Essayer plusieurs stratégies pour trouver le build
    
    // Stratégie 1: Depuis la fonction (remonter jusqu'à .next/standalone)
    const functionDir = __dirname;
    // Depuis /var/task/app/api/update/build, remonter à /var/task puis chercher .next
    const taskRoot = path.join(functionDir, '../../..'); // /var/task
    const nextStandalone = path.join(taskRoot, '.next', 'standalone');
    const nextStandaloneLocalUI = path.join(nextStandalone, 'local-ui');
    
    // Stratégie 2: Chemins absolus possibles sur Vercel
    const vercelPaths = [
      nextStandaloneLocalUI,
      nextStandalone,
      path.join(nextStandalone, 'app'),
      // Chemins alternatifs
      '/var/task/.next/standalone/local-ui',
      '/var/task/.next/standalone',
      '/var/task/.next/standalone/app',
    ];
    
    // Log pour déboguer
    console.log('Searching for build directory.');
    console.log('CWD:', cwd);
    console.log('Function dir:', functionDir);
    console.log('Task root:', taskRoot);
    console.log('Next standalone:', nextStandalone);
    
    let buildDir: string | null = null;
    
    // Vérifier tous les chemins
    for (const possiblePath of [...vercelPaths, ...possiblePaths]) {
      if (fs.existsSync(possiblePath)) {
        const files = fs.readdirSync(possiblePath);
        if (files.length > 0) {
          buildDir = possiblePath;
          console.log('Found build directory:', buildDir);
          break;
        }
      }
    }
    
    if (!buildDir) {
      console.error('Build directory not found.');
      console.error('CWD:', cwd);
      console.error('Function dir:', functionDir);
      console.error('Task root:', taskRoot);
      
      // Lister les fichiers disponibles pour déboguer
      try {
        const cwdFiles = fs.existsSync(cwd) ? fs.readdirSync(cwd) : [];
        const functionFiles = fs.existsSync(functionDir) ? fs.readdirSync(functionDir) : [];
        const taskRootFiles = fs.existsSync(taskRoot) ? fs.readdirSync(taskRoot) : [];
        console.error('Files in CWD:', cwdFiles);
        console.error('Files in function dir:', functionFiles);
        console.error('Files in task root:', taskRootFiles);
        
        // Essayer de lister les fichiers dans les chemins parents
        const parentDirs = [
          path.join(functionDir, '..'),
          path.join(functionDir, '../..'),
          path.join(functionDir, '../../..'),
          path.join(functionDir, '../../../..'),
        ];
        for (const parentDir of parentDirs) {
          if (fs.existsSync(parentDir)) {
            try {
              const files = fs.readdirSync(parentDir);
              console.error(`Files in ${parentDir}:`, files);
            } catch (e) {
              // Ignorer les erreurs
            }
          }
        }
      } catch (e) {
        console.error('Cannot list files:', e);
      }
      
      return NextResponse.json(
        { 
          error: 'Build directory not found', 
          cwd, 
          functionDir,
          taskRoot,
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
