'use client';

import { useEffect, useState, useRef } from 'react';
import { firebaseService } from '@/services/firebase';
import { orchestrateAuth } from '@/services/auth-orchestrator';

/**
 * Provider pour gérer l'initialisation Firebase une seule fois
 * Utilise AuthOrchestrator pour centraliser la logique d'authentification
 */
export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [initialized, setInitialized] = useState(false);
  const initRef = useRef(false);

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
      
      // Lancer l'orchestration d'authentification
      orchestrateAuth().catch((error) => {
        console.error('Error orchestrating auth:', error);
      });
    }).catch((error) => {
      console.error('Firebase initialization failed:', error);
      setInitialized(true); // Continuer même en cas d'erreur
      
      // Lancer l'orchestration même en cas d'erreur
      orchestrateAuth().catch((orchestrateError) => {
        console.error('Error orchestrating auth:', orchestrateError);
      });
    });

    // Toute la logique d'authentification est maintenant gérée par AuthOrchestrator
    // On s'abonne aux changements d'état Firebase pour relancer l'orchestration si nécessaire
    // MAIS seulement si l'utilisateur change vraiment (évite les boucles)
    let lastFirebaseUid: string | null = null;
    const unsubscribe = firebaseService.onAuthStateChange((user) => {
      const currentUid = user?.uid || null;
      // Relancer l'orchestration seulement si l'UID a changé
      if (currentUid !== lastFirebaseUid) {
        lastFirebaseUid = currentUid;
        orchestrateAuth().catch((error) => {
          console.error('Error re-orchestrating auth after Firebase state change:', error);
        });
      }
    });

    // Nettoyage
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      initRef.current = false;
    };
  }, []);

  return <>{children}</>;
}

