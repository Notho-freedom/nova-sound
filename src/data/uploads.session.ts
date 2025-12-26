/**
 * Session de données pour les fichiers uploadés
 * Cache mémoire par userId + promesse partagée
 */

interface UploadedFile {
  id: string;
  name: string;
  uploadedAt: string;
  cloudProvider?: "cloudinary" | "nexus" | "bunny" | "planethoster";
  url?: string;
  size?: number;
}

const UPLOADED_MEDIA_KEY = "nexus-uploaded-media";

// Cache par userId
const cache = new Map<string, { files: UploadedFile[]; timestamp: number }>();
const loadPromises = new Map<string, Promise<UploadedFile[]>>();
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

/**
 * Charge les fichiers uploadés avec cache mémoire
 */
export async function getUploadedFiles(userId: string | null): Promise<UploadedFile[]> {
  const cacheKey = userId || 'anonymous';

  // Vérifier le cache
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.files;
  }

  // Si un chargement est déjà en cours, attendre qu'il se termine
  const existingPromise = loadPromises.get(cacheKey);
  if (existingPromise) {
    return existingPromise;
  }

  // Démarrer un nouveau chargement
  const { getCurrentUserId, getUserStorageKey } = await import('@/lib/storage-utils');
  const actualUserId = userId || await getCurrentUserId();
  const storageKey = await getUserStorageKey(UPLOADED_MEDIA_KEY, actualUserId);

  const promise = (async () => {
    try {
      // Load from localStorage
      const saved = localStorage.getItem(storageKey);
      let uploadedMedia: UploadedFile[] = [];

      if (saved) {
        try {
          uploadedMedia = JSON.parse(saved);
        } catch (e) {
          console.error("[uploads.session] Error parsing localStorage:", e);
        }
      }

      // Try old key for backward compatibility
      if (uploadedMedia.length === 0) {
        const oldKey = UPLOADED_MEDIA_KEY;
        const oldSaved = localStorage.getItem(oldKey);
        if (oldSaved) {
          try {
            const oldMedia: UploadedFile[] = JSON.parse(oldSaved);
            uploadedMedia = oldMedia;
            // Migrate to new key
            if (actualUserId) {
              localStorage.setItem(storageKey, JSON.stringify(oldMedia));
            }
          } catch (e) {
            console.error("[uploads.session] Error migrating from old key:", e);
          }
        }
      }

      // Try to fetch from Nexus API if authenticated
      if (actualUserId && actualUserId !== 'anonymous') {
        try {
          const { firebaseService } = await import('@/services/firebase');
          const currentUser = firebaseService.getCurrentUser();
          if (currentUser && !currentUser.isAnonymous) {
            const idToken = await firebaseService.getIdToken();
            if (idToken) {
              const response = await fetch('/api/nexus/files', {
                headers: {
                  'Authorization': `Bearer ${idToken}`,
                },
              });

              if (response.ok) {
                const apiFiles = await response.json();
                // Merge avec les fichiers locaux (priorité au local)
                const localIds = new Set(uploadedMedia.map(f => f.id));
                const newFiles = apiFiles.filter((f: UploadedFile) => !localIds.has(f.id));
                uploadedMedia = [...uploadedMedia, ...newFiles];
              }
            }
          }
        } catch (error) {
          // Silently fail - use localStorage data only
        }
      }

      // Sort by upload date (newest first)
      uploadedMedia.sort((a, b) => 
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      );

      // Mettre à jour le cache
      cache.set(cacheKey, { files: uploadedMedia, timestamp: Date.now() });
      loadPromises.delete(cacheKey);

      return uploadedMedia;
    } catch (error) {
      loadPromises.delete(cacheKey);
      throw error;
    }
  })();

  loadPromises.set(cacheKey, promise);
  return promise;
}

/**
 * Invalide le cache pour un userId
 */
export function invalidateUploadsCache(userId: string | null): void {
  const cacheKey = userId || 'anonymous';
  cache.delete(cacheKey);
  loadPromises.delete(cacheKey);
}

/**
 * Met à jour le cache avec de nouveaux fichiers
 */
export function updateUploadsCache(userId: string | null, files: UploadedFile[]): void {
  const cacheKey = userId || 'anonymous';
  cache.set(cacheKey, { files, timestamp: Date.now() });
}

/**
 * Obtient les fichiers depuis le cache uniquement (sans charger)
 */
export function getCachedUploads(userId: string | null): UploadedFile[] | null {
  const cacheKey = userId || 'anonymous';
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.files;
  }
  return null;
}

