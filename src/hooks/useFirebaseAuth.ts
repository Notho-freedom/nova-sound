import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';

/**
 * Hook pour écouter l'état d'authentification Firebase et déclencher des re-renders
 * Quand l'utilisateur se connecte/déconnecte, ce hook notifie tous les composants qui l'utilisent
 */
export function useFirebaseAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    // Charger l'état initial et s'abonner aux changements
    import('@/services/firebase')
      .then(({ firebaseService }) => {
        if (!mounted) return;

        // Obtenir l'utilisateur actuel
        const currentUser = firebaseService.getCurrentUser();
        setUser(currentUser);
        setLoading(false);

        // S'abonner aux changements d'état d'authentification
        unsubscribe = firebaseService.onAuthStateChanged((newUser) => {
          if (mounted) {
            console.log('[useFirebaseAuth] Auth state changed:', newUser ? `${newUser.email || 'anonymous'}` : 'signed out');
            setUser(newUser);
            setLoading(false);
          }
        });
      })
      .catch((error) => {
        console.error('[useFirebaseAuth] Failed to initialize:', error);
        if (mounted) {
          setLoading(false);
        }
      });

    // Écouter l'événement custom pour forcer la mise à jour
    const handleAuthChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      const newUser = customEvent.detail?.user || null;
      if (mounted) {
        console.log('[useFirebaseAuth] Custom event received:', newUser ? `${newUser.email || 'anonymous'}` : 'signed out');
        setUser(newUser);
      }
    };

    window.addEventListener('auth-state-changed', handleAuthChange);

    return () => {
      mounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
      window.removeEventListener('auth-state-changed', handleAuthChange);
    };
  }, []);

  return {
    user,
    loading,
    isAuthenticated: !loading && user !== null && !user.isAnonymous,
    isAnonymous: !loading && user?.isAnonymous === true,
  };
}
