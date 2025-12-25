/**
 * Utility functions for user-isolated localStorage operations
 */

/**
 * Get the current user ID from Firebase or auth service
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    // Try Firebase first
    const { firebaseService } = await import('@/services/firebase');
    if (firebaseService.isInitialized()) {
      const user = firebaseService.getCurrentUser();
      if (user) {
        return user.uid;
      }
    }
  } catch (error) {
    // Firebase not available
  }

  try {
    // Fallback to auth service
    const { authService } = await import('@/services/auth');
    const user = authService.getCurrentUser();
    if (user) {
      // UserProfile uses 'uid' not 'id'
      return (user as any).uid || (user as any).id;
    }
  } catch (error) {
    // Auth service not available
  }

  return null;
}

/**
 * Get user-isolated localStorage key
 * @param baseKey The base key (e.g., 'nexus-uploaded-media')
 * @param userId Optional user ID. If not provided, will try to get current user ID
 * @returns The isolated key (e.g., 'nexus-uploaded-media:userId123')
 */
export async function getUserStorageKey(baseKey: string, userId?: string | null): Promise<string> {
  const uid = userId || await getCurrentUserId();
  if (uid) {
    return `${baseKey}:${uid}`;
  }
  // Fallback to base key if no user ID available (for backward compatibility)
  return baseKey;
}

/**
 * Get user-isolated localStorage key synchronously (for cases where userId is already known)
 * @param baseKey The base key
 * @param userId The user ID
 * @returns The isolated key
 */
export function getUserStorageKeySync(baseKey: string, userId: string): string {
  return `${baseKey}:${userId}`;
}

/**
 * Clean up localStorage keys for a specific user (useful when switching accounts)
 * @param userId The user ID to clean up
 */
export function cleanupUserStorage(userId: string): void {
  if (typeof window === 'undefined') return;

  const keysToClean = [
    'nexus-uploaded-media',
    'nexus-settings',
    'nexus-favorites',
    'nexus-play-history',
    'nexus-theme',
    'nexus-notifications-enabled',
    'nexus-volume',
    'nexus-search-history',
    'nexus-cloudinary-config',
    'nexus-equalizer-presets',
    'nexus-youtube-api-key',
    'nexus-playlists',
  ];

  keysToClean.forEach(baseKey => {
    const userKey = getUserStorageKeySync(baseKey, userId);
    try {
      localStorage.removeItem(userKey);
    } catch (error) {
      console.error(`Failed to remove ${userKey}:`, error);
    }
  });
}

/**
 * Complete logout cleanup - removes all user data from the application
 * This includes:
 * - Firebase auth tokens and profile
 * - Manual auth tokens and profile 
 * - All user localStorage data
 * - YouTube cache and quota
 * - Browser storage
 * - Memory caches
 */
export async function completeLogoutCleanup(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    console.log('🧹 Starting complete logout cleanup...');
    
    // 1. Get current user ID for targeted cleanup
    const userId = await getCurrentUserId();
    
    // 2. Clean user-specific data
    if (userId) {
      cleanupUserStorage(userId);
    }
    
    // 3. Clean all nexus-prefixed keys (including non-user-specific ones)
    const nexusKeysToClean = [
      'nexus-settings',
      'nexus-favorites', 
      'nexus-play-history',
      'nexus-theme',
      'nexus-notifications-enabled',
      'nexus-volume',
      'nexus-search-history',
      'nexus-cloudinary-config',
      'nexus-equalizer-presets',
      'nexus-youtube-api-key',
      'nexus-playlists',
      'nexus-uploaded-media',
      'nexus-last-sync',
      'nexus-tracks-uploaded', 
      'nexus-tracks-downloaded',
    ];
    
    // Clean both direct keys and user-isolated keys
    const allKeys = Object.keys(localStorage);
    nexusKeysToClean.forEach(key => {
      try {
        // Remove direct key
        localStorage.removeItem(key);
        
        // Remove any user-isolated versions found
        const userIsolatedKeys = allKeys.filter(k => k.startsWith(key + ':'));
        userIsolatedKeys.forEach(userKey => localStorage.removeItem(userKey));
      } catch (error) {
        console.error(`Failed to remove ${key}:`, error);
      }
    });
    
    // Clean any other nexus- prefixed keys that might exist
    const otherNexusKeys = allKeys.filter(key => 
      key.startsWith('nexus-') && !nexusKeysToClean.some(nk => key.startsWith(nk))
    );
    otherNexusKeys.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.error(`Failed to remove other nexus key ${key}:`, error);
      }
    });
    
    // 4. Clean YouTube cache and quota data
    const ytKeys = allKeys.filter(key => 
      key.startsWith('yt_') || 
      key.includes('youtube') ||
      key.includes('quota') ||
      key.startsWith('ytcache_')
    );
    ytKeys.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.error(`Failed to remove YouTube key ${key}:`, error);
      }
    });
    
    // 5. Clean auth-related data
    const authKeys = [
      'google_oauth_user',
      'google_oauth_tokens', 
      'google_client_id',
      'firebase_auth_user',
      'auth_tokens',
      'user_profile'
    ];
    authKeys.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.error(`Failed to remove auth key ${key}:`, error);
      }
    });
    
    // 6. Clear sessionStorage
    try {
      sessionStorage.clear();
    } catch (error) {
      console.error('Failed to clear sessionStorage:', error);
    }
    
    // 7. Clear memory caches from services
    try {
      // Import and clear storage service cache
      const { storageService } = await import('@/services/storage-service');
      storageService.clearMemoryCache();
      console.log('✅ Storage service cache cleared');
    } catch (error) {
      console.error('Failed to clear storage service cache:', error);
    }
    
    try {
      // Import and clear YouTube cache
      const { youtubeCache } = await import('@/services/youtube/cache');
      youtubeCache.clear();
      console.log('✅ YouTube cache cleared');
    } catch (error) {
      console.error('Failed to clear YouTube cache:', error);
    }
    
    try {
      // Clear YouTube quota manager if it exists
      const { youtubeQuota } = await import('@/services/youtube/quota');
      // Reset budget
      youtubeQuota.reset();
      console.log('✅ YouTube quota manager reset');
    } catch (error) {
      console.error('Failed to reset YouTube quota:', error);
    }
    
    console.log('✅ Complete logout cleanup finished - all user data removed');
  } catch (error) {
    console.error('Error during logout cleanup:', error);
  }
}

/**
 * Migrate old localStorage keys to user-isolated keys
 * This should be called once when a user logs in
 */
export async function migrateToUserIsolatedStorage(): Promise<void> {
  if (typeof window === 'undefined') return;

  const userId = await getCurrentUserId();
  if (!userId) return;

  const keysToMigrate = [
    'nexus-uploaded-media',
  ];

  for (const baseKey of keysToMigrate) {
    try {
      const oldData = localStorage.getItem(baseKey);
      if (oldData) {
        const userKey = getUserStorageKeySync(baseKey, userId);
        // Only migrate if user key doesn't exist
        if (!localStorage.getItem(userKey)) {
          localStorage.setItem(userKey, oldData);
          console.log(`Migrated ${baseKey} to ${userKey}`);
        }
        // Optionally remove old key after migration (uncomment if desired)
        // localStorage.removeItem(baseKey);
      }
    } catch (error) {
      console.error(`Failed to migrate ${baseKey}:`, error);
    }
  }
}

