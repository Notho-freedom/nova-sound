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

