import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

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
    // En production Vercel, le build est dans .next/standalone
    // Chercher version.json dans plusieurs emplacements possibles
    // Priorité: .next/standalone/local-ui/version.json (créé pendant le build) > autres
    const cwd = process.cwd();
    const possiblePaths = [
      path.join(cwd, '.next', 'standalone', 'local-ui', 'version.json'),
      path.join(cwd, 'local-ui', 'version.json'),
      path.join(cwd, '.next', 'standalone', 'version.json'),
      path.join(cwd, '.next', 'standalone', 'app', 'version.json'),
      path.join(cwd, 'dist', 'version.json'),
      // Chemins alternatifs pour Vercel
      '/vercel/path0/.next/standalone/local-ui/version.json',
      '/vercel/path0/local-ui/version.json',
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
