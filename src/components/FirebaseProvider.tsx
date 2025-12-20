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

    // Fonction pour synchroniser le profil Firestore avec Stripe
    const syncProfileWithStripe = async (userId: string) => {
      try {
        const { firebaseService: fbService } = await import('@/services/firebase');
        const currentUser = fbService.getCurrentUser();
        if (!currentUser || currentUser.isAnonymous) return;
        
        const idToken = await fbService.getIdToken();
        if (!idToken) return;
        
        console.log('🔄 FirebaseProvider: Synchronisation automatique Firestore ↔ Stripe...');
        const syncResponse = await fetch('/api/stripe/sync-profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
        });
        
        if (syncResponse.ok) {
          console.log('✅ FirebaseProvider: Profil synchronisé avec Stripe');
          // Forcer le rafraîchissement du profil pour mettre à jour l'UI
          await fbService.refreshProfile();
        } else {
          const errorText = await syncResponse.text();
          console.warn('⚠️ FirebaseProvider: Erreur lors de la synchronisation:', errorText);
        }
      } catch (error) {
        console.warn('⚠️ FirebaseProvider: Erreur lors de la synchronisation Stripe (non-bloquant):', error);
      }
    };
    

    // S'abonner aux changements d'authentification Firebase
    const unsubscribe = firebaseService.onAuthStateChange(async (user) => {
      if (user && !user.isAnonymous) {
        // Initialiser la synchronisation pour cet utilisateur (non-anonyme uniquement)
        try {
          console.log('🔄 FirebaseProvider: Initializing sync for Firebase user:', user.uid);
          await firebaseSyncService.initializeSync(user.uid);
          console.log('✅ FirebaseProvider: Sync initialized successfully for Firebase user');
          
          // Synchroniser automatiquement le profil Firestore avec Stripe au démarrage
          // Cela garantit que Firestore est toujours à jour avec les données Stripe réelles
          await syncProfileWithStripe(user.uid);
          
          // Le polling périodique a été retiré - la synchronisation se fait maintenant via le système de sync de la sidebar
          // Le webhook Stripe met à jour Firestore automatiquement, et l'utilisateur peut forcer une sync via le bouton de la sidebar
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
    let checkAttempts = 0;
    const maxCheckAttempts = 3;
    
    const checkManualAuthUser = async () => {
      // Prevent infinite retry loop
      if (checkAttempts >= maxCheckAttempts) {
        console.log('ℹ️ FirebaseProvider: Max check attempts reached, stopping manual auth user check');
        return;
      }
      
      checkAttempts++;
      
      try {
        // Wait a bit for services to initialize
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Ensure Firebase is initialized
        await firebaseService.ensureInitialized();
        
        if (!firebaseService.isInitialized()) {
          console.log('⚠️ FirebaseProvider: Firebase not initialized, will retry sync initialization later');
          if (checkAttempts < maxCheckAttempts) {
            setTimeout(checkManualAuthUser, 3000);
          }
          return;
        }
        
        // Check if there's a manual OAuth user (from authService)
        const { authService } = await import('@/services/auth');
        const manualUser = authService.getCurrentUser();
        
        if (manualUser && !manualUser.isAnonymous && manualUser.email) {
          const firebaseUser = firebaseService.getCurrentUser();
          
          // If no Firebase Auth user or anonymous, create Firestore user and initialize sync
          if (!firebaseUser || firebaseUser.isAnonymous) {
            console.log('🔄 FirebaseProvider: Manual OAuth user detected, creating Firestore user:', manualUser.email);
            
            // Create or get Firestore user for manual OAuth user
            try {
              // Try to create/get user in Firestore using the manual OAuth UID
              const firestoreUserId = manualUser.uid;
              
              // IMPORTANT: Ensure user profile exists in Firestore BEFORE initializing sync
              // This ensures the user document is available for sync operations
              console.log('🔄 FirebaseProvider: Ensuring user profile exists in Firestore...');
              await firebaseService.ensureUserProfileExists(manualUser);
              console.log('✅ FirebaseProvider: User profile ensured in Firestore');
              
              // Now initialize sync with the manual OAuth UID
              // The sync service will create the user data document if it doesn't exist
              console.log('🔄 FirebaseProvider: Initializing sync with manual OAuth UID:', firestoreUserId);
              await firebaseSyncService.initializeSync(firestoreUserId);
              console.log('✅ FirebaseProvider: Sync initialized for manual OAuth user');
              
              // Synchroniser automatiquement le profil Firestore avec Stripe
              await syncProfileWithStripe(firestoreUserId);
            } catch (syncError) {
              console.error('❌ FirebaseProvider: Failed to initialize sync for manual OAuth user:', syncError);
              if (checkAttempts < maxCheckAttempts) {
                setTimeout(checkManualAuthUser, 5000);
              }
            }
          } else if (firebaseUser && !firebaseUser.isAnonymous) {
            // Firebase user exists, initialize sync
            console.log('🔄 FirebaseProvider: Firebase user exists, initializing sync');
            await firebaseSyncService.initializeSync(firebaseUser.uid);
            console.log('✅ FirebaseProvider: Sync initialized for Firebase user');
            
            // Synchroniser automatiquement le profil Firestore avec Stripe
            await syncProfileWithStripe(firebaseUser.uid);
          }
        } else {
          console.log('ℹ️ FirebaseProvider: No manual OAuth user found');
        }
      } catch (error) {
        console.warn('FirebaseProvider: Error checking manual auth user:', error);
        if (checkAttempts < maxCheckAttempts) {
          setTimeout(checkManualAuthUser, 5000);
        }
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

