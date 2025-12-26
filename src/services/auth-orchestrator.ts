/**
 * AuthOrchestrator - Source de vérité unique pour l'authentification
 * 
 * Architecture:
 * - FSM (Finite State Machine) pour gérer les phases d'auth
 * - Cache Stripe par UID pour éviter les appels multiples
 * - État global unique accessible par tous les composants
 * - Composants UI passifs qui lisent seulement
 */

import { authService, UserProfile } from './auth';
import { firebaseService } from './firebase';
import { firebaseSyncService } from './firebase-sync';

// Phases de la FSM d'authentification
export type AuthPhase =
  | 'boot'           // Initialisation
  | 'anonymous'      // Utilisateur anonyme
  | 'oauth_pending'  // OAuth en cours
  | 'authenticated'  // Authentifié mais pas encore sync
  | 'syncing'        // Synchronisation en cours
  | 'ready'          // Prêt (sync terminé)
  | 'error';         // Erreur

// État global d'authentification
export interface AuthState {
  phase: AuthPhase;
  uid: string | null;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  token: string | null;
  isPro: boolean;
  isProChecked: boolean; // Stripe vérifié pour cet UID
  profile: UserProfile | null;
  error: string | null;
}

// Cache Stripe par UID (évite les appels multiples)
const stripeCheckedForUid = new Set<string>();

// Listeners pour les changements d'état
type AuthStateListener = (state: AuthState) => void;
const listeners = new Set<AuthStateListener>();

// État global unique
let currentState: AuthState = {
  phase: 'boot',
  uid: null,
  email: null,
  displayName: null,
  photoURL: null,
  token: null,
  isPro: false,
  isProChecked: false,
  profile: null,
  error: null,
};

// Transition vers un nouvel état
function transitionTo(newState: Partial<AuthState>): void {
  const previousPhase = currentState.phase;
  currentState = { ...currentState, ...newState };
  
  // Log uniquement si la phase change
  if (currentState.phase !== previousPhase) {
    console.log(`🔄 AuthOrchestrator: ${previousPhase} → ${currentState.phase}`, {
      uid: currentState.uid,
      email: currentState.email,
    });
  }
  
  // Notifier tous les listeners
  listeners.forEach(listener => {
    try {
      listener(currentState);
    } catch (error) {
      console.error('Error in auth state listener:', error);
    }
  });
}

// Obtenir l'état actuel
export function getAuthState(): AuthState {
  return { ...currentState };
}

// S'abonner aux changements d'état
export function subscribeToAuthState(listener: AuthStateListener): () => void {
  listeners.add(listener);
  // Notifier immédiatement avec l'état actuel
  listener(currentState);
  
  // Retourner la fonction de désabonnement
  return () => {
    listeners.delete(listener);
  };
}

// Vérifier Stripe UNE SEULE FOIS par UID
async function checkStripeOnce(uid: string, email: string): Promise<boolean> {
  // Vérifier le cache
  if (stripeCheckedForUid.has(uid)) {
    return currentState.isPro;
  }
  
  // Marquer comme en cours de vérification
  stripeCheckedForUid.add(uid);
  
  try {
    const token = await authService.getAccessToken();
    if (!token) {
      return false;
    }
    
    const response = await fetch('/api/stripe/subscription-status', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (response.ok) {
      const stripeData = await response.json();
      const isPro = stripeData.isActive && stripeData.plan === 'pro';
      
      if (isPro) {
        // Mettre à jour le cache local
        authService.updateUserPlan('pro', 'active');
      }
      
      transitionTo({
        isPro,
        isProChecked: true,
      });
      
      return isPro;
    }
  } catch (error) {
    console.warn('⚠️ AuthOrchestrator: Erreur lors de la vérification Stripe:', error);
  }
  
  return false;
}

// Initialiser Firebase sync UNE SEULE FOIS par UID
const firebaseSyncInitialized = new Set<string>();

async function initializeFirebaseSyncOnce(uid: string): Promise<void> {
  // Vérifier si déjà initialisé
  if (firebaseSyncInitialized.has(uid)) {
    return;
  }
  
  // Marquer comme en cours d'initialisation
  firebaseSyncInitialized.add(uid);
  
  try {
    await firebaseSyncService.initializeSync(uid);
    console.log('✅ AuthOrchestrator: Firebase sync initialisé pour', uid);
  } catch (error) {
    console.error('❌ AuthOrchestrator: Erreur initialisation Firebase sync:', error);
    firebaseSyncInitialized.delete(uid); // Permettre la réessai
    throw error;
  }
}

// Lock pour éviter les appels concurrents
let orchestrationInProgress = false;
let lastOrchestrationUid: string | null = null;

// Orchestrer l'authentification complète
export async function orchestrateAuth(): Promise<void> {
  // Vérifier si déjà en cours ou si déjà ready pour le même UID
  if (orchestrationInProgress) {
    console.log('⏳ AuthOrchestrator: Orchestration déjà en cours, ignoré');
    return;
  }
  
  // Si déjà ready et même UID, ne pas relancer
  const currentState = getAuthState();
  if (currentState.phase === 'ready' && currentState.uid === lastOrchestrationUid && currentState.uid !== null) {
    console.log('⏳ AuthOrchestrator: Déjà ready pour cet UID, ignoré');
    return;
  }
  
  orchestrationInProgress = true;
  
  try {
    // Phase 1: Boot → Vérifier l'état initial (seulement si pas déjà authenticated/ready)
    if (currentState.phase !== 'authenticated' && currentState.phase !== 'ready' && currentState.phase !== 'syncing') {
      transitionTo({ phase: 'boot' });
    }
    // Attendre que Firebase soit initialisé
    await firebaseService.ensureInitialized();
    
    // Vérifier si un utilisateur Google existe localement (OAuth manuel)
    const localGoogleUser = authService.getCurrentUser();
    const firebaseUser = firebaseService.getCurrentUser();
    
    if (localGoogleUser && !localGoogleUser.isAnonymous && localGoogleUser.email) {
      // Phase 2: Utilisateur OAuth détecté
      transitionTo({
        phase: 'oauth_pending',
        email: localGoogleUser.email,
        displayName: localGoogleUser.displayName || null,
        photoURL: localGoogleUser.photoURL || null,
      });
      
      // Vérifier si Firebase Auth est nécessaire
      const profileUid = localGoogleUser.uid;
      const isFirebaseUid = profileUid && profileUid.length === 28 && 
                           !profileUid.includes('@') && !profileUid.includes('user_');
      
      let finalUid = profileUid;
      
      if (!isFirebaseUid) {
        // Chercher l'UID Firebase dans Firestore
        const existingUser = await firebaseService.findUserByEmail(localGoogleUser.email);
        if (existingUser && existingUser.uid) {
          const firestoreUid = existingUser.uid;
          const isFirestoreFirebaseUid = firestoreUid && firestoreUid.length === 28 && 
                                        !firestoreUid.includes('@') && !firestoreUid.includes('user_');
          if (isFirestoreFirebaseUid) {
            finalUid = firestoreUid;
          }
        }
      }
      
      // Phase 3: Authentifié
      transitionTo({
        phase: 'authenticated',
        uid: finalUid,
        profile: localGoogleUser,
      });
      
      // Phase 4: Vérifier Stripe (UNE SEULE FOIS)
      if (finalUid && !stripeCheckedForUid.has(finalUid)) {
        await checkStripeOnce(finalUid, localGoogleUser.email);
      }
      
      // Phase 5: Initialiser Firebase sync (UNE SEULE FOIS)
      if (finalUid && !firebaseSyncInitialized.has(finalUid)) {
        transitionTo({ phase: 'syncing' });
        await initializeFirebaseSyncOnce(finalUid);
      }
      
      // Phase 6: Prêt
      transitionTo({ phase: 'ready' });
      lastOrchestrationUid = finalUid;
      
    } else if (firebaseUser && !firebaseUser.isAnonymous) {
      // Utilisateur Firebase Auth (pas OAuth manuel)
      const profile = firebaseService.getUserProfile();
      
      transitionTo({
        phase: 'authenticated',
        uid: firebaseUser.uid,
        email: firebaseUser.email || null,
        displayName: firebaseUser.displayName || null,
        photoURL: firebaseUser.photoURL || null,
        profile: profile || null,
      });
      
      // Vérifier Stripe
      if (firebaseUser.uid && !stripeCheckedForUid.has(firebaseUser.uid)) {
        await checkStripeOnce(firebaseUser.uid, firebaseUser.email || '');
      }
      
      // Initialiser sync
      if (firebaseUser.uid && !firebaseSyncInitialized.has(firebaseUser.uid)) {
        transitionTo({ phase: 'syncing' });
        await initializeFirebaseSyncOnce(firebaseUser.uid);
      }
      
      transitionTo({ phase: 'ready' });
      lastOrchestrationUid = firebaseUser.uid;
      
    } else {
      // Phase: Utilisateur anonyme
      transitionTo({ phase: 'anonymous' });
      lastOrchestrationUid = null;
    }
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur d\'authentification';
    console.error('❌ AuthOrchestrator: Erreur lors de l\'orchestration:', error);
    transitionTo({
      phase: 'error',
      error: errorMessage,
    });
  } finally {
    orchestrationInProgress = false;
  }
}

// Réinitialiser l'orchestrateur (logout)
export function resetAuthOrchestrator(): void {
  stripeCheckedForUid.clear();
  firebaseSyncInitialized.clear();
  orchestrationInProgress = false;
  lastOrchestrationUid = null;
  transitionTo({
    phase: 'boot',
    uid: null,
    email: null,
    displayName: null,
    photoURL: null,
    token: null,
    isPro: false,
    isProChecked: false,
    profile: null,
    error: null,
  });
}

// Forcer la vérification Stripe (pour refresh manuel)
export async function forceStripeCheck(): Promise<void> {
  const state = getAuthState();
  if (state.uid && state.email) {
    stripeCheckedForUid.delete(state.uid); // Réinitialiser le cache
    await checkStripeOnce(state.uid, state.email);
  }
}

