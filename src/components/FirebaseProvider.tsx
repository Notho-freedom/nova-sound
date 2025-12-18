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

    // S'abonner aux changements d'authentification Firebase
    const unsubscribe = firebaseService.onAuthStateChange(async (user) => {
      if (user && !user.isAnonymous) {
        // Initialiser la synchronisation pour cet utilisateur (non-anonyme uniquement)
        try {
          console.log('🔄 FirebaseProvider: Initializing sync for Firebase user:', user.uid);
          await firebaseSyncService.initializeSync(user.uid);
          console.log('✅ FirebaseProvider: Sync initialized successfully for Firebase user');
        } catch (error) {
          console.error('❌ FirebaseProvider: Failed to initialize sync:', error);
        }
      } else {
        // Nettoyer la synchronisation si utilisateur déconnecté ou anonyme
        if (!user) {
          console.log('🔄 FirebaseProvider: User signed out, cleaning up sync');
          firebaseSyncService.cleanup();
        }
      }
    });
    
    // Also check for manual OAuth users (Electron) and initialize sync if needed
    // This ensures sync works even when using Desktop App OAuth instead of Firebase Auth
    const checkManualAuthUser = async () => {
      try {
        // Wait a bit for services to initialize
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Ensure Firebase is initialized
        await firebaseService.ensureInitialized();
        
        if (!firebaseService.isInitialized()) {
          console.log('⚠️ FirebaseProvider: Firebase not initialized, will retry sync initialization later');
          // Retry after another delay
          setTimeout(checkManualAuthUser, 3000);
          return;
        }
        
        // Check if there's a manual OAuth user (from authService)
        const { authService } = await import('@/services/auth');
        const manualUser = authService.getCurrentUser();
        
        if (manualUser && !manualUser.isAnonymous && manualUser.email) {
          const firebaseUser = firebaseService.getCurrentUser();
          
          // If no Firebase Auth user or anonymous, try to find/create Firestore user
          if (!firebaseUser || firebaseUser.isAnonymous) {
            console.log('🔄 FirebaseProvider: Checking Firestore for manual OAuth user:', manualUser.email);
            
            // Try to find existing user in Firestore by email
            let firestoreUser = await firebaseService.findUserByEmail(manualUser.email);
            
            if (firestoreUser && firestoreUser.uid) {
              console.log('✅ FirebaseProvider: Found Firestore user, initializing sync with UID:', firestoreUser.uid);
              // Initialize sync with the Firestore user ID
              await firebaseSyncService.initializeSync(firestoreUser.uid);
              console.log('✅ FirebaseProvider: Sync initialized for manual OAuth user');
            } else {
              console.log('⚠️ FirebaseProvider: No Firestore user found for', manualUser.email);
              console.log('   Sync will be initialized when user data is created in Firestore');
              // Retry later in case user data is being created
              setTimeout(checkManualAuthUser, 5000);
            }
          } else if (firebaseUser && !firebaseUser.isAnonymous) {
            // Firebase user exists, initialize sync
            console.log('🔄 FirebaseProvider: Firebase user exists, initializing sync');
            await firebaseSyncService.initializeSync(firebaseUser.uid);
            console.log('✅ FirebaseProvider: Sync initialized for Firebase user');
          }
        } else {
          console.log('ℹ️ FirebaseProvider: No manual OAuth user found');
        }
      } catch (error) {
        console.warn('FirebaseProvider: Error checking manual auth user:', error);
        // Retry after delay
        setTimeout(checkManualAuthUser, 5000);
      }
    };
    
    // Check for manual auth user after a delay (allows services to initialize)
    setTimeout(checkManualAuthUser, 3000);

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

