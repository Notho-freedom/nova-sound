import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface CheckUpdateRequest {
  currentVersion?: string;
  currentBuildNumber?: number;
}

/**
 * API Route pour vérifier rapidement si une mise à jour est disponible
 * POST /api/update/check
 * 
 * Compare la version du client avec celle du serveur
 * Retourne si une mise à jour est disponible sans télécharger le build
 */
export async function POST(request: Request) {
  try {
    const body: CheckUpdateRequest = await request.json();
    
    // Récupérer la version serveur
    // Sur Vercel, les fonctions serverless sont dans /var/task/app/api/...
    const functionDir = __dirname;
    // Remonter à /var/task puis chercher .next/standalone
    const taskRoot = path.join(functionDir, '../../..');
    const nextStandalone = path.join(taskRoot, '.next', 'standalone');
    const nextStandaloneLocalUI = path.join(nextStandalone, 'local-ui');
    
    // Chercher version.json dans plusieurs emplacements (priorité: public/local-ui)
    const cwd = process.cwd();
    const possiblePaths = [
      path.join(cwd, 'public', 'local-ui', 'version.json'), // Priorité: accessible depuis les routes API
      path.join(nextStandaloneLocalUI, 'version.json'),
      path.join(nextStandalone, 'local-ui', 'version.json'),
      path.join(nextStandalone, 'version.json'),
      '/var/task/public/local-ui/version.json',
      '/var/task/.next/standalone/local-ui/version.json',
      '/var/task/.next/standalone/version.json',
      path.join(cwd, '.next', 'standalone', 'local-ui', 'version.json'),
      path.join(cwd, 'local-ui', 'version.json'),
      path.join(cwd, '.next', 'standalone', 'version.json'),
    ];
    
    let versionFile: string | null = null;
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        versionFile = possiblePath;
        console.log('Found version.json at:', versionFile);
        break;
      }
    }
    
    if (!versionFile) {
      return NextResponse.json({
        available: false,
        reason: 'Version file not found on server',
      });
    }
    
    const serverVersion = JSON.parse(fs.readFileSync(versionFile, 'utf-8'));
    
    // Comparer les versions
    let updateAvailable = false;
    let reason = '';
    
    if (!body.currentVersion && !body.currentBuildNumber) {
      updateAvailable = true;
      reason = 'No local version found';
    } else if (body.currentBuildNumber && serverVersion.buildNumber) {
      // Comparer les buildNumbers (plus fiable)
      updateAvailable = serverVersion.buildNumber > body.currentBuildNumber;
      reason = updateAvailable 
        ? `New build available (${serverVersion.buildNumber} > ${body.currentBuildNumber})`
        : 'Build is up to date';
    } else if (body.currentVersion && serverVersion.version) {
      // Comparer les versions
      updateAvailable = serverVersion.version !== body.currentVersion;
      reason = updateAvailable
        ? `Version mismatch (${serverVersion.version} vs ${body.currentVersion})`
        : 'Version is up to date';
    }
    
    return NextResponse.json({
      available: updateAvailable,
      reason,
      serverVersion: {
        version: serverVersion.version,
        buildNumber: serverVersion.buildNumber,
        buildDate: serverVersion.buildDate,
        changelog: serverVersion.changelog,
      },
      clientVersion: {
        version: body.currentVersion,
        buildNumber: body.currentBuildNumber,
      },
    });
  } catch (error) {
    console.error('Update check failed:', error);
    return NextResponse.json(
      {
        available: false,
        error: 'Failed to check for updates',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

