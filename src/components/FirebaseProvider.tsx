'use client';

import { useEffect, useState, useRef } from 'react';

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

    // NOTE: Le listener onAuthStateChange est DÉSACTIVÉ
    // L'AuthOrchestrator gère maintenant toute l'authentification et se déclenche automatiquement
    // Ce listener causait des appels multiples à orchestrateAuth() lors des re-renders
    // L'AuthOrchestrator est appelé une seule fois au démarrage ci-dessus

    // Nettoyage
    return () => {
      initRef.current = false;
    };
  }, []);

  return <>{children}</>;
}

