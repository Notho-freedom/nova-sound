import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

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
      return NextResponse.json(
        { error: 'Build directory not found' },
        { status: 404 }
      );
    }
    
    // Créer un stream pour le ZIP
    const archive = archiver('zip', {
      zlib: { level: 9 }, // Compression maximale
    });
    
    // Créer un ReadableStream pour la réponse
    const chunks: Buffer[] = [];
    
    archive.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    
    archive.on('error', (err) => {
      console.error('Archive error:', err);
    });
    
    // Ajouter tous les fichiers du build au ZIP
    const files = fs.readdirSync(buildDir);
    for (const file of files) {
      const filePath = path.join(buildDir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        archive.directory(filePath, file);
      } else {
        archive.file(filePath, { name: file });
      }
    }
    
    // Finaliser l'archive
    archive.finalize();
    
    // Attendre que tous les chunks soient collectés
    await new Promise<void>((resolve, reject) => {
      archive.on('end', resolve);
      archive.on('error', reject);
    });
    
    // Concaténer tous les chunks
    const buffer = Buffer.concat(chunks);
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="build.zip"',
        'Cache-Control': 'public, max-age=3600', // Cache 1 heure
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Error creating build zip:', error);
    return NextResponse.json(
      { error: 'Failed to create build zip' },
      { status: 500 }
    );
  }
}
