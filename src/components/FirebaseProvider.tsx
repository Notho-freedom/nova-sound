'use client';

import { useEffect, useState, useRef } from 'react';
import { firebaseService } from '@/services/firebase';
import { firebaseSyncService } from '@/services/firebase-sync';

/**
 * Provider pour gérer l'initialisation Firebase une seule fois
 * Évite les reconnexions multiples des listeners
 */
export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [initialized, setInitialized] = useState(false);
  const initRef = useRef(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Initialiser Firebase une seule fois
    if (initRef.current) {
      return;
    }

    initRef.current = true;

    // Gérer le résultat de redirection
    firebaseService.handleRedirectResult().then(() => {
      console.log('Firebase initialization complete');
      setInitialized(true);
    }).catch((error) => {
      console.error('Firebase initialization failed:', error);
      setInitialized(true); // Continuer même en cas d'erreur
    });

    // S'abonner aux changements d'authentification
    const unsubscribe = firebaseService.onAuthStateChange(async (user) => {
      if (user) {
        // Initialiser la synchronisation pour cet utilisateur
        try {
          await firebaseSyncService.initializeSync(user.uid);
        } catch (error) {
          console.error('Failed to initialize sync:', error);
        }
      } else {
        // Nettoyer la synchronisation
        firebaseSyncService.cleanup();
      }
    });

    unsubscribeRef.current = unsubscribe;

    // Nettoyage
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      initRef.current = false;
    };
  }, []);

  return <>{children}</>;
}

