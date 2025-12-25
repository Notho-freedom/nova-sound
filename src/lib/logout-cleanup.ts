/**
 * Central logout cleanup utilities
 * 
 * This file provides utilities for completely cleaning up all application data
 * when a user logs out, ensuring no personal data remains in the application.
 */

/**
 * Event that components and hooks can listen to for logout cleanup
 */
export const LOGOUT_CLEANUP_EVENT = 'nexus-logout-cleanup';

/**
 * Dispatch logout cleanup event to notify all components and hooks
 */
export function dispatchLogoutCleanupEvent(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(LOGOUT_CLEANUP_EVENT));
  }
}

/**
 * Hook utility to listen for logout cleanup events
 * Components and hooks should use this to reset their state on logout
 */
export function useLogoutCleanupListener(callback: () => void): () => void {
  if (typeof window !== 'undefined') {
    const handleCleanup = () => callback();
    window.addEventListener(LOGOUT_CLEANUP_EVENT, handleCleanup);
    
    // Return cleanup function
    return () => {
      window.removeEventListener(LOGOUT_CLEANUP_EVENT, handleCleanup);
    };
  }
  return () => {};
}

/**
 * Reset common React state to default values
 */
export const DEFAULT_RESET_VALUES = {
  user: null,
  isAuthenticated: false,
  isPro: false,
  tracks: [],
  playlists: [],
  favorites: [],
  history: [],
  searchHistory: [],
  theme: 'spotify' as const,
  volume: 100,
  settings: {},
  notifications: [],
  cloudinaryConfig: null,
  equalizerPresets: [],
};

/**
 * Helper to completely reset an array state
 */
export function resetArrayState<T>(setState: (value: T[]) => void): void {
  setState([]);
}

/**
 * Helper to completely reset an object state
 */
export function resetObjectState<T>(setState: (value: T | null) => void): void {
  setState(null);
}