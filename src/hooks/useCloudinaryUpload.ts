import { useState, useCallback, useEffect } from 'react';
import { cloudinaryService, UploadProgress } from '@/services/cloudinary';
import { useCloudSync } from './useCloudSync';
import { Track } from '@/types/music';
import { toast } from 'sonner';

interface UseCloudinaryUploadReturn {
  uploadTrack: (track: Track) => Promise<void>;
  uploadAlbum: (tracks: Track[]) => Promise<void>;
  uploadPlaylist: (tracks: Track[]) => Promise<void>;
  uploadProgress: Map<string, UploadProgress>;
  overallProgress: number;
  isUploading: boolean;
  getTrackProgress: (trackId: string) => UploadProgress | undefined;
}

export function useCloudinaryUpload(): UseCloudinaryUploadReturn {
  const { cloudinaryConfigured, nexusIsPro } = useCloudSync();
  const [uploadProgress, setUploadProgress] = useState<Map<string, UploadProgress>>(new Map());
  const [isUploading, setIsUploading] = useState(false);

  // Subscribe to Cloudinary progress updates
  useEffect(() => {
    const unsubscribe = cloudinaryService.onProgressUpdate((progress) => {
      setUploadProgress(new Map(progress));
      setIsUploading(progress.size > 0 && Array.from(progress.values()).some(p => p.status === 'uploading'));
    });

    return unsubscribe;
  }, []);

  // Get overall progress
  const overallProgress = cloudinaryService.getOverallProgress();

  // Get progress for a specific track
  const getTrackProgress = useCallback((trackId: string): UploadProgress | undefined => {
    return uploadProgress.get(trackId);
  }, [uploadProgress]);

  // Upload a track to Cloudinary
  const uploadTrack = useCallback(async (track: Track) => {
    // Cloudinary is only for Free users (serveur 0)
    // Pro users should use Bunny (serveur 1) or PlanetHoster/Nexus (serveur 2)
    if (nexusIsPro) {
      toast.error('Plan Pro détecté', {
        description: 'Les utilisateurs Pro doivent utiliser Bunny ou PlanetHoster. Cloudinary est réservé aux utilisateurs Free.',
      });
      return;
    }
    
    if (!cloudinaryConfigured) {
      toast.error('Cloudinary non configuré', {
        description: 'Configurez Cloudinary dans les paramètres pour uploader vos fichiers.',
      });
      return;
    }

    // Check if already uploading
    const existingProgress = uploadProgress.get(track.id);
    if (existingProgress && existingProgress.status === 'uploading') {
      toast.info('Upload déjà en cours', {
        description: `L'upload de "${track.title}" est déjà en cours.`,
      });
      return;
    }

    // Check if file path exists (Electron mode)
    if (!track.filePath) {
      toast.error('Fichier introuvable', {
        description: 'Le fichier audio n\'est pas disponible localement.',
      });
      return;
    }

    try {
      // Get file blob from Electron
      if (!window.electronAPI) {
        toast.error('Mode Electron requis', {
          description: 'L\'upload Cloudinary nécessite le mode Electron.',
        });
        return;
      }

      // Read file as base64 from Electron
      const base64Data = await window.electronAPI.readFileAsBase64(track.filePath);
      
      // Convert base64 to blob
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      
      // Determine MIME type from file extension
      const ext = track.filePath.split('.').pop()?.toLowerCase();
      const mimeTypes: Record<string, string> = {
        'mp3': 'audio/mpeg',
        'flac': 'audio/flac',
        'ogg': 'audio/ogg',
        'wav': 'audio/wav',
        'm4a': 'audio/mp4',
        'aac': 'audio/aac',
        'opus': 'audio/opus',
        'wma': 'audio/x-ms-wma',
        'aiff': 'audio/aiff',
      };
      const mimeType = mimeTypes[ext || ''] || 'audio/mpeg';
      
      const blob = new Blob([byteArray], { type: mimeType });
      
      // Upload to Cloudinary
      await cloudinaryService.uploadTrack(track, blob, (progress) => {
        // Progress is handled by the service's listeners
      });

      toast.success('Upload réussi', {
        description: `"${track.title}" a été uploadé vers Cloudinary (Serveur 0).`,
      });
    } catch (error: any) {
      console.error('Error uploading track to Cloudinary:', error);
      
      // Provide more specific error messages
      let errorMessage = error.message || 'Une erreur est survenue lors de l\'upload.';
      let errorTitle = 'Erreur d\'upload Cloudinary';
      
      if (error.message?.includes('401') || error.message?.includes('authentication')) {
        errorTitle = 'Erreur d\'authentification Cloudinary';
        errorMessage = 'Les identifiants Cloudinary sont invalides. Vérifiez votre configuration dans les paramètres. L\'upload preset doit être configuré en mode "unsigned" dans votre dashboard Cloudinary.';
      } else if (error.message?.includes('not configured')) {
        errorTitle = 'Cloudinary non configuré';
        errorMessage = 'Veuillez configurer Cloudinary dans les paramètres avant d\'uploader des fichiers.';
      }
      
      toast.error(errorTitle, {
        description: errorMessage,
        duration: 5000, // Show longer for important errors
      });
    }
  }, [cloudinaryConfigured, nexusIsPro, uploadProgress]);

  // Upload an entire album (all tracks without duplicates)
  const uploadAlbum = useCallback(async (tracks: Track[]) => {
    // Cloudinary is only for Free users (serveur 0)
    if (nexusIsPro) {
      toast.error('Plan Pro détecté', {
        description: 'Les utilisateurs Pro doivent utiliser Bunny ou PlanetHoster. Cloudinary est réservé aux utilisateurs Free.',
      });
      return;
    }
    
    if (!cloudinaryConfigured) {
      toast.error('Cloudinary non configuré', {
        description: 'Configurez Cloudinary dans les paramètres pour uploader vos fichiers.',
      });
      return;
    }

    // Remove duplicates by ID
    const uniqueTracks = Array.from(new Map(tracks.map(t => [t.id, t])).values());
    
    if (uniqueTracks.length === 0) {
      toast.error('Aucune piste à uploader', {
        description: 'L\'album ne contient aucune piste valide.',
      });
      return;
    }

    toast.info(`Upload de l'album vers Cloudinary (serveur 0) en cours...`, {
      description: `${uniqueTracks.length} piste${uniqueTracks.length > 1 ? 's' : ''} à uploader.`,
    });

    // Upload tracks sequentially to avoid overwhelming the service
    for (let i = 0; i < uniqueTracks.length; i++) {
      const track = uniqueTracks[i];
      try {
        await uploadTrack(track);
        // Small delay between uploads
        if (i < uniqueTracks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`Failed to upload track ${track.title}:`, error);
        // Continue with next track even if one fails
      }
    }

    toast.success('Upload de l\'album terminé', {
      description: `${uniqueTracks.length} piste${uniqueTracks.length > 1 ? 's' : ''} uploadée${uniqueTracks.length > 1 ? 's' : ''}.`,
    });
  }, [cloudinaryConfigured, nexusIsPro, uploadTrack]);

  // Upload an entire playlist (all tracks without duplicates)
  const uploadPlaylist = useCallback(async (tracks: Track[]) => {
    // Cloudinary is only for Free users (serveur 0)
    if (nexusIsPro) {
      toast.error('Plan Pro détecté', {
        description: 'Les utilisateurs Pro doivent utiliser Bunny ou PlanetHoster. Cloudinary est réservé aux utilisateurs Free.',
      });
      return;
    }
    
    if (!cloudinaryConfigured) {
      toast.error('Cloudinary non configuré', {
        description: 'Configurez Cloudinary dans les paramètres pour uploader vos fichiers.',
      });
      return;
    }

    // Remove duplicates by ID
    const uniqueTracks = Array.from(new Map(tracks.map(t => [t.id, t])).values());
    
    if (uniqueTracks.length === 0) {
      toast.error('Aucune piste à uploader', {
        description: 'La playlist ne contient aucune piste valide.',
      });
      return;
    }

    toast.info(`Upload de la playlist vers Cloudinary (serveur 0) en cours...`, {
      description: `${uniqueTracks.length} piste${uniqueTracks.length > 1 ? 's' : ''} à uploader.`,
    });

    // Upload tracks sequentially to avoid overwhelming the service
    for (let i = 0; i < uniqueTracks.length; i++) {
      const track = uniqueTracks[i];
      try {
        await uploadTrack(track);
        // Small delay between uploads
        if (i < uniqueTracks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`Failed to upload track ${track.title}:`, error);
        // Continue with next track even if one fails
      }
    }

    toast.success('Upload de la playlist terminé', {
      description: `${uniqueTracks.length} piste${uniqueTracks.length > 1 ? 's' : ''} uploadée${uniqueTracks.length > 1 ? 's' : ''}.`,
    });
  }, [cloudinaryConfigured, nexusIsPro, uploadTrack]);

  return {
    uploadTrack,
    uploadAlbum,
    uploadPlaylist,
    uploadProgress,
    overallProgress,
    isUploading,
    getTrackProgress,
  };
}

