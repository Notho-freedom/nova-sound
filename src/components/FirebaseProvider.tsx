'use client';

import { useEffect, useState, useRef } from 'react';
import { User } from 'firebase/auth';

/**
 * Provider pour gérer l'initialisation Firebase une seule fois
 * Utilise AuthOrchestrator pour centraliser la logique d'authentification
 * Écoute les changements d'état d'authentification pour mettre à jour l'UI
 */
export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [initialized, setInitialized] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    // Initialiser Firebase une seule fois
    if (initRef.current) {
      return;
    }

    initRef.current = true;

    // Import dynamique pour éviter les problèmes SSR
    Promise.all([
      import('@/services/firebase'),
      import('@/services/auth-orchestrator')
    ]).then(([{ firebaseService }, { orchestrateAuth }]) => {
      // Gérer le résultat de redirection
      return firebaseService.handleRedirectResult().then(() => {
        console.log('Firebase initialization complete');
        setInitialized(true);
        
        // Lancer l'orchestration d'authentification
        return orchestrateAuth().catch((error) => {
          console.error('Error orchestrating auth:', error);
        });
      }).catch((error) => {
        console.error('Firebase initialization failed:', error);
        setInitialized(true); // Continuer même en cas d'erreur
        
        // Lancer l'orchestration même en cas d'erreur
        return orchestrateAuth().catch((orchestrateError) => {
          console.error('Error orchestrating auth:', orchestrateError);
        });
      });
    }).catch((error) => {
      console.error('Failed to load Firebase services:', error);
      setInitialized(true);
    });
  }, []);

  // Écouter les changements d'état d'authentification pour mettre à jour l'UI
  useEffect(() => {
    if (!initialized) return;

    let unsubscribe: (() => void) | null = null;

    import('@/services/firebase').then(({ firebaseService }) => {
      // S'abonner aux changements d'état d'authentification
      unsubscribe = firebaseService.onAuthStateChanged((user) => {
        console.log('[FirebaseProvider] Auth state changed:', user ? `${user.email || 'anonymous'} (${user.uid})` : 'signed out');
        setAuthUser(user);
        
        // Forcer un re-render complet en déclenchant un événement custom
        // Cela permet aux composants qui utilisent firebaseService de se mettre à jour
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth-state-changed', { 
            detail: { user } 
          }));
        }
      });
    }).catch((error) => {
      console.error('Failed to setup auth state listener:', error);
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [initialized]);

  return <>{children}</>;
}

