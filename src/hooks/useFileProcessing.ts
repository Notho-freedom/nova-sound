import { useCallback } from 'react';
import type { Track } from '@/types/music';

interface UseFileProcessingReturn {
  processFiles: (files: File[]) => Promise<Track[]>;
  isProcessing: boolean;
}

export function useFileProcessing(): UseFileProcessingReturn {
  const processFiles = useCallback(
    (files: File[]): Promise<Track[]> => {
      return new Promise((resolve, reject) => {
        if (files.length === 0) {
          resolve([]);
          return;
        }

        // Traiter les fichiers de manière asynchrone sans bloquer le thread principal
        (async () => {
          try {
            const processedTracks: Track[] = [];

            for (const file of files) {
              try {
                const fileName = file.name.replace(/\.[^/.]+$/, '');
                const [title, artist] = fileName.includes('-')
                  ? fileName.split('-').map((s) => s.trim())
                  : [fileName, 'Unknown Artist'];

                const fileUrl = URL.createObjectURL(file);
                const idBase = `${file.name}-${file.size}-${file.lastModified}`;
                const id = `local-${btoa(idBase).replace(/[^a-z0-9]/gi, '').substring(0, 20)}`;

                // Extraire la durée
                let duration = 0;
                try {
                  const audioElement = new Audio();
                  duration = await new Promise<number>((resolve) => {
                    const timeout = setTimeout(() => {
                      audioElement.pause();
                      resolve(0);
                    }, 5000);

                    audioElement.onloadedmetadata = () => {
                      clearTimeout(timeout);
                      const dur = audioElement.duration || 0;
                      audioElement.pause();
                      resolve(isFinite(dur) ? dur : 0);
                    };

                    audioElement.src = fileUrl;
                    audioElement.load();
                  });
                } catch (err) {
                  console.warn('[useFileProcessing] Could not extract duration:', err);
                  duration = 0;
                }

                const track: Track = {
                  id,
                  title: title || 'Unknown Track',
                  artist: artist || 'Unknown Artist',
                  album: 'Local Files',
                  duration: Math.round(duration),
                  coverUrl: '',
                  mediaSource: 'local' as const,
                  filePath: fileUrl,
                  addedAt: new Date().toISOString(),
                  format: file.type || file.name.split('.').pop() || 'unknown',
                };

                processedTracks.push(track);

                // Laisser le navigateur respirer
                await new Promise((resolve) => setTimeout(resolve, 50));
              } catch (err) {
                console.error('[useFileProcessing] Error processing file:', err);
              }
            }

            resolve(processedTracks);
          } catch (err) {
            reject(err);
          }
        })();
      });
    },
    []
  );

  return {
    processFiles,
    isProcessing: false, // Simple version without tracking
  };
}
