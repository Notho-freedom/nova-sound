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
  const syncInProgressRef = useRef(false);
  const lastSyncUserIdRef = useRef<string | null>(null);
  const lastSyncTimestampRef = useRef<number>(0);
  const initializedUserIdRef = useRef<string | null>(null);

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
    const syncProfileWithStripe = async (userId: string, skipRefresh = false) => {
      // Éviter les synchronisations multiples simultanées
      if (syncInProgressRef.current) {
        console.log('⏳ FirebaseProvider: Synchronisation Stripe déjà en cours, ignorée');
        return;
      }
      
      // Éviter de synchroniser plusieurs fois pour le même utilisateur dans un court délai
      if (lastSyncUserIdRef.current === userId) {
        const timeSinceLastSync = Date.now() - lastSyncTimestampRef.current;
        if (timeSinceLastSync < 10000) { // 10 secondes
          console.log('⏳ FirebaseProvider: Synchronisation Stripe récente, ignorée');
          return;
        }
      }
      
      syncInProgressRef.current = true;
      lastSyncUserIdRef.current = userId;
      lastSyncTimestampRef.current = Date.now();
      
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
          // Ne pas forcer le rafraîchissement si skipRefresh est true (évite la boucle)
          // Le listener Firestore mettra à jour l'UI automatiquement
          if (!skipRefresh) {
            await fbService.refreshProfile();
          }
        } else {
          const errorText = await syncResponse.text();
          console.warn('⚠️ FirebaseProvider: Erreur lors de la synchronisation:', errorText);
        }
      } catch (error) {
        console.warn('⚠️ FirebaseProvider: Erreur lors de la synchronisation Stripe (non-bloquant):', error);
      } finally {
        syncInProgressRef.current = false;
      }
    };
    

    // S'abonner aux changements d'authentification Firebase
    let isFirstAuth = true;
    const unsubscribe = firebaseService.onAuthStateChange(async (user) => {
      if (user && !user.isAnonymous) {
        // Ne réinitialiser la sync QUE si l'utilisateur a vraiment changé
        // Le listener Firestore peut déclencher onAuthStateChange même si l'utilisateur est le même
        if (initializedUserIdRef.current === user.uid) {
          // Sync déjà initialisée pour cet utilisateur, ne rien faire
          return;
        }
        
        // Initialiser la synchronisation pour cet utilisateur (non-anonyme uniquement)
        try {
          const shouldSyncStripe = isFirstAuth || lastSyncUserIdRef.current !== user.uid;
          isFirstAuth = false;
          initializedUserIdRef.current = user.uid;
          
          console.log('🔄 FirebaseProvider: Initializing sync for Firebase user:', user.uid);
          await firebaseSyncService.initializeSync(user.uid);
          console.log('✅ FirebaseProvider: Sync initialized successfully for Firebase user');
          
          // Synchroniser automatiquement le profil Firestore avec Stripe SEULEMENT au premier démarrage
          // Les mises à jour suivantes se feront via le webhook Stripe ou le bouton de sync de la sidebar
          if (shouldSyncStripe) {
            await syncProfileWithStripe(user.uid, true); // skipRefresh=true pour éviter la boucle
          }
          
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
          lastSyncUserIdRef.current = null;
          lastSyncTimestampRef.current = 0;
          initializedUserIdRef.current = null;
          isFirstAuth = true;
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
            const firestoreUserId = manualUser.uid;
            
            // Prevent multiple calls for the same user
            if (initializedUserIdRef.current === firestoreUserId || syncInProgressRef.current) {
              return; // Already processed or in progress
            }
            
            syncInProgressRef.current = true;
            
            try {
              console.log('🔄 FirebaseProvider: Manual OAuth user detected, creating Firestore user:', manualUser.email);
              
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
              
              // Mark as initialized
              initializedUserIdRef.current = firestoreUserId;
              lastSyncUserIdRef.current = firestoreUserId;
              
              // Synchroniser automatiquement le profil Firestore avec Stripe (seulement si première fois)
              await syncProfileWithStripe(firestoreUserId, true); // skipRefresh=true pour éviter la boucle
            } catch (syncError) {
              console.error('❌ FirebaseProvider: Failed to initialize sync for manual OAuth user:', syncError);
              if (checkAttempts < maxCheckAttempts) {
                setTimeout(checkManualAuthUser, 5000);
              }
            } finally {
              syncInProgressRef.current = false;
            }
          } else if (firebaseUser && !firebaseUser.isAnonymous) {
            // Firebase user exists, initialize sync
            if (initializedUserIdRef.current !== firebaseUser.uid && !syncInProgressRef.current) {
              syncInProgressRef.current = true;
              try {
                console.log('🔄 FirebaseProvider: Firebase user exists, initializing sync');
                await firebaseSyncService.initializeSync(firebaseUser.uid);
                console.log('✅ FirebaseProvider: Sync initialized for Firebase user');
                
                initializedUserIdRef.current = firebaseUser.uid;
                lastSyncUserIdRef.current = firebaseUser.uid;
                
                // Synchroniser automatiquement le profil Firestore avec Stripe (seulement si première fois)
                await syncProfileWithStripe(firebaseUser.uid, true); // skipRefresh=true pour éviter la boucle
              } finally {
                syncInProgressRef.current = false;
              }
            }
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

