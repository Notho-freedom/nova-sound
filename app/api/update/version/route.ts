import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * API Route pour servir la version actuelle du build
 * GET /api/update/version
 * 
 * Retourne le version.json du build actuel
 * Utilisé par l'application Electron pour vérifier les mises à jour
 */
export async function GET() {
  try {
    // En production Vercel, les fonctions serverless sont dans /var/task/app/api/...
    const cwd = process.cwd();
    const functionDir = __dirname;
    // Depuis /var/task/app/api/update/version, remonter à /var/task
    let taskRoot = path.join(functionDir, '../../..'); // /var/task/app
    // Si on est dans /var/task/app, remonter à /var/task
    if (taskRoot.endsWith('/app') || taskRoot.endsWith('\\app')) {
      taskRoot = path.join(taskRoot, '..'); // /var/task
    }
    const nextStandalone = path.join(taskRoot, '.next', 'standalone');
    const nextStandaloneLocalUI = path.join(nextStandalone, 'local-ui');
    
    // Chercher version.json dans plusieurs emplacements possibles
    // Priorité: public/local-ui (accessible depuis les routes API) > standalone > autres
    const possiblePaths = [
      path.join(cwd, 'public', 'local-ui', 'version.json'), // Priorité: accessible depuis les routes API
      path.join(nextStandaloneLocalUI, 'version.json'),
      path.join(nextStandalone, 'local-ui', 'version.json'),
      path.join(nextStandalone, 'version.json'),
      path.join(nextStandalone, 'app', 'version.json'),
      '/var/task/public/local-ui/version.json',
      '/var/task/.next/standalone/local-ui/version.json',
      '/var/task/.next/standalone/version.json',
      path.join(cwd, '.next', 'standalone', 'local-ui', 'version.json'),
      path.join(cwd, 'local-ui', 'version.json'),
      path.join(cwd, '.next', 'standalone', 'version.json'),
      path.join(cwd, 'dist', 'version.json'),
    ];
    
    let versionFile: string | null = null;
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        versionFile = possiblePath;
        console.log('Found version.json at:', versionFile);
        break;
      }
    }
    
    if (versionFile) {
      const versionData = JSON.parse(fs.readFileSync(versionFile, 'utf-8'));
      
      return NextResponse.json(versionData, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
    
    // Fallback: générer une version depuis package.json
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      return NextResponse.json({
        version: packageJson.version || '1.0.0',
        buildDate: new Date().toISOString(),
        changelog: 'Build Vercel',
      }, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
    
    return NextResponse.json(
      { error: 'Version file not found' },
      { status: 404 }
    );
  } catch (error) {
    console.error('Error reading version:', error);
    return NextResponse.json(
      { 
        error: 'Failed to read version',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
