import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { cloudinaryService, CloudinaryConfig, UploadProgress } from "@/services/cloudinary";
import { nexusServerService } from "@/services/nexus-server";
import { authService, UserProfile } from "@/services/auth";
import { firebaseService } from "@/services/firebase";
import { stripeService } from "@/services/stripe";
import { notificationService } from "@/services/notification-service";
import { isElectron } from "@/lib/electron-detector";
import { toast } from "sonner";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { auth } from "@/services/firebase";
import { 
  subscribeToAuthState, 
  getAuthState, 
  orchestrateAuth, 
  resetAuthOrchestrator,
  forceStripeCheck 
} from "@/services/auth-orchestrator";
// Imports statiques pour éviter les erreurs HMR
import { completeLogoutCleanup } from "@/lib/storage-utils";
import { dispatchLogoutCleanupEvent } from "@/lib/logout-cleanup";

interface UseCloudSyncReturn {
  // Auth status
  firebaseInitialized: boolean; // Keep name for compatibility (always true now)
  stripeInitialized: boolean;

  // Cloudinary
  cloudinaryConfigured: boolean;
  cloudinaryConfig: CloudinaryConfig | null;
  saveCloudinaryConfig: (config: CloudinaryConfig) => void;
  clearCloudinaryConfig: () => void;

  // Nexus Server (Firebase Auth + Storage)
  nexusUser: UserProfile | null;
  nexusAuthenticated: boolean;
  nexusIsPro: boolean;
  nexusLoginWithGoogle: () => Promise<void>;
  nexusLogout: () => Promise<void>;
  nexusUpgradeToPro: () => Promise<void>;
  nexusManageBilling: () => Promise<void>;
  refreshUser: () => void;

  // Upload status
  uploadProgress: Map<string, UploadProgress>;
  overallProgress: number;
  isUploading: boolean;

  // Sync
  startSync: () => Promise<void>;
  syncStatus: {
    lastSyncAt: string | null;
    tracksUploaded: number;
    tracksDownloaded: number;
  };
  syncLoading: boolean;
}

export function useCloudSync(): UseCloudSyncReturn {
  // Service status
  const [authInitialized] = useState(true); // Auth service is always initialized
  const [stripeInitialized, setStripeInitialized] = useState(stripeService.isInitialized());

  // Cloudinary state
  const [cloudinaryConfig, setCloudinaryConfig] = useState<CloudinaryConfig | null>(null);
  const [cloudinaryConfigured, setCloudinaryConfigured] = useState(false);

  // Nexus state
  const [nexusUser, setNexusUser] = useState<UserProfile | null>(null);
  const [nexusAuthenticated, setNexusAuthenticated] = useState(false);
  const [nexusIsPro, setNexusIsPro] = useState(false);

  // Upload state
  const [uploadProgress, setUploadProgress] = useState<Map<string, UploadProgress>>(new Map());
  const [overallProgress, setOverallProgress] = useState(0);

  // Sync state
  const [syncStatus, setSyncStatus] = useState({
    lastSyncAt: null as string | null,
    tracksUploaded: 0,
    tracksDownloaded: 0,
  });
  const [syncLoading, setSyncLoading] = useState(false);

  // Track if sync has been initialized to prevent multiple initializations
  const syncInitializedRef = useRef<boolean>(false);
  const lastUserIdRef = useRef<string | null>(null);
  const anonymousUserInitRef = useRef<boolean>(false); // Prevent multiple anonymous user creations
  const googleMergeInProgressRef = useRef<boolean>(false); // Prevent multiple Google merge attempts
  const syncStatusDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastFindUserByEmailRef = useRef<string | null>(null); // Prevent multiple findUserByEmail calls for same email
  const findUserByEmailInProgressRef = useRef<boolean>(false); // Prevent multiple findUserByEmail calls
  const stripeSyncInProgressRef = useRef<boolean>(false); // Prevent multiple Stripe sync calls
  const lastStripeSyncEmailRef = useRef<string | null>(null); // Track last synced email
  const lastProcessedAuthUserRef = useRef<string | null>(null); // Track last processed auth user to prevent duplicate processing
  const authStateChangeProcessingRef = useRef<boolean>(false); // Lock pour empêcher les appels concurrents dans onAuthStateChange
  const initAnonymousUserProcessingRef = useRef<boolean>(false); // Lock pour empêcher les appels concurrents dans initAnonymousUser
  const authStateChangeDebounceTimerRef = useRef<NodeJS.Timeout | null>(null); // Debounce pour éviter les appels multiples très rapides

  // Initialize on mount
  useEffect(() => {
    // Load Stripe config and update initialized state
    stripeService.ensureInitialized().then(() => {
      setStripeInitialized(stripeService.isInitialized());
    }).catch((error) => {
      console.warn("Failed to initialize Stripe:", error);
      setStripeInitialized(false);
    });
    
    // Load Cloudinary config
    const config = cloudinaryService.loadConfig();
    setCloudinaryConfig(config);
    setCloudinaryConfigured(cloudinaryService.isConfigured());

    // S'abonner à l'état d'authentification via AuthOrchestrator
    // NOTE: Hook passif - ne fait que lire l'état, ne déclenche aucune action
    const unsubscribeAuth = subscribeToAuthState((authState) => {
      // Mettre à jour l'UI en fonction de l'état de l'orchestrateur
      // Pas d'appels API, pas d'imports dynamiques, juste mise à jour d'état
      if (authState.phase === 'ready' || authState.phase === 'authenticated' || authState.phase === 'syncing') {
        if (authState.profile) {
          setNexusUser(authState.profile);
          setNexusAuthenticated(true);
          setNexusIsPro(authState.isPro);
        }
      } else if (authState.phase === 'anonymous') {
        // Utilisateur anonyme
        setNexusAuthenticated(false);
        setNexusIsPro(false);
      } else if (authState.phase === 'boot' || authState.phase === 'error') {
        // État initial ou erreur
        if (authState.phase === 'error') {
          console.error('AuthOrchestrator error:', authState.error);
        }
      }
    });

    // NOTE: orchestrateAuth est appelé par FirebaseProvider au démarrage
    // Plus besoin de l'appeler ici car cela causait des appels multiples
    // L'AuthOrchestrator gère maintenant toute l'authentification de manière centralisée

    // NOTE: initAnonymousUser est DÉSACTIVÉ
    // L'AuthOrchestrator gère maintenant toute la logique d'authentification
    // Cette fonction causait des appels multiples et des re-renders inutiles
    // Si un utilisateur anonyme doit être créé, l'AuthOrchestrator le fera
    const initAnonymousUser = async () => {
      // Early return - AuthOrchestrator gère tout maintenant
      return;
      // LOCK: Empêcher les appels concurrents - CHECK FIRST
      if (initAnonymousUserProcessingRef.current) {
        // Déjà en train de traiter, ignorer
        return;
      }
      
      // Prevent multiple initializations with a lock
      if (anonymousUserInitRef.current) {
        console.log("⏳ Anonymous user initialization already in progress, skipping...");
        return;
      }

      // Marquer comme en cours de traitement IMMÉDIATEMENT
      initAnonymousUserProcessingRef.current = true;

      try {
        // Check Firebase first (for anonymous auth)
        if (!firebaseService.isInitialized()) {
          console.log("⏳ Firebase not initialized yet, waiting...");
          return;
        }

        const firebaseUser = firebaseService.getCurrentUser();
        
        // Check if there's a Google user in local storage (from manual OAuth)
        const localGoogleUser = authService.getCurrentUser();
        
        // PRIORITY 1: If there's already a non-anonymous Firebase user, use it
        if (firebaseUser !== null && !firebaseUser!.isAnonymous) {
          // Try to get profile, if not loaded yet, load it
          let profile = firebaseService.getUserProfile();
          if (!profile) {
            console.log("📥 Profile not loaded yet, loading from Firestore...");
            profile = await firebaseService.loadUserProfileById(firebaseUser!.uid);
          }
          
          if (profile !== null) {
            setNexusUser(profile!);
            setNexusAuthenticated(true);
            // Use profile directly instead of isPro() to ensure we have the latest data
            setNexusIsPro(profile!.plan === 'pro' && profile!.subscriptionStatus === 'active');
            anonymousUserInitRef.current = true;
            console.log("✅ Using existing Firebase Google user:", firebaseUser!.email, "isPro:", profile!.plan === 'pro');
            
            // NOTE: La synchronisation Stripe/Firebase est maintenant gérée par AuthOrchestrator
            // On ne fait que mettre à jour l'UI ici
            
            return;
          }
        }
        
        // PRIORITY 2: If there's a local Google user but no Firebase user
        // NOTE: L'AuthOrchestrator gère maintenant toute la logique d'authentification
        // On ne fait que mettre à jour l'UI basique ici si nécessaire
        if (localGoogleUser !== null && localGoogleUser!.email !== null && firebaseUser === null) {
          // Prevent multiple calls for the same user - CHECK FIRST
          const userKey = localGoogleUser!.email ?? localGoogleUser!.uid ?? 'anonymous';
          if (lastProcessedAuthUserRef.current === userKey) {
            // Already processed, skip silently
            return;
          }
          
          // Mark as processed IMMEDIATELY to prevent concurrent processing
          lastProcessedAuthUserRef.current = userKey;
          anonymousUserInitRef.current = true;
          
          // NOTE: L'UI est mise à jour par l'AuthOrchestrator via subscribeToAuthState
          // On ne fait rien ici pour éviter les conflits
          
          // Don't create anonymous user - user is already authenticated with Google
          return;
        }
        
        // PRIORITY 3: If no Firebase user exists and no Google user, create anonymous user
        // Note: Don't check navigator.onLine - it's unreliable in Electron
        // Let Firebase SDK handle offline scenarios naturally
        if (firebaseUser === null && localGoogleUser === null) {
          // Mark as initializing to prevent multiple creations
          anonymousUserInitRef.current = true;
          
          try {
            const anonymousProfile = await firebaseService.signInAnonymously();
            
            setNexusUser(anonymousProfile);
            
            // Check if the returned profile is actually from a Google user (not anonymous)
            // This can happen if Firebase already had a Google user persisted
            const hasValidEmail = !!anonymousProfile.email && anonymousProfile.email.includes('@');
            const currentUser = firebaseService.getCurrentUser();
            const isActuallyAuthenticated = hasValidEmail || (currentUser !== null && !currentUser!.isAnonymous);
            
            if (isActuallyAuthenticated) {
              // This is actually a Google user, not anonymous
              setNexusAuthenticated(true);
              setNexusIsPro(anonymousProfile.plan === 'pro' && anonymousProfile.subscriptionStatus === 'active');
              console.log("✅ Firebase returned existing Google user:", anonymousProfile.email, "isPro:", anonymousProfile.plan === 'pro');
            } else {
              // Anonymous user is NOT considered authenticated (only Google users are)
              setNexusAuthenticated(false);
              setNexusIsPro(false);
              console.log("✅ Firebase anonymous user initialized (not authenticated - waiting for Google)");
            }
            return;
          } catch (anonError: any) {
            // Check if anonymous auth is disabled
            if (anonError.code === "auth/admin-restricted-operation") {
              console.warn("⚠️ Firebase Anonymous Authentication is disabled. Please enable it in Firebase Console > Authentication > Sign-in method > Anonymous");
              // Don't show error to user, just log it
              anonymousUserInitRef.current = false;
              return;
            }
            
            // Handle offline/network errors gracefully
            if (anonError.code === "unavailable" || 
                anonError.code === "network-request-failed" ||
                anonError.message?.includes("offline") ||
                anonError.message?.includes("network")) {
              console.warn("⚠️ Firebase network issue, anonymous user creation deferred");
              anonymousUserInitRef.current = false; // Allow retry when connection improves
              return;
            }
            
            anonymousUserInitRef.current = false;
            throw anonError;
          }
        } else if (firebaseUser !== null && firebaseUser!.isAnonymous) {
          // Firebase anonymous user exists - check if we should link with Google
          const profile = firebaseService.getUserProfile();
          
          // If there's a local Google user, merge it (Google data takes priority)
          if (localGoogleUser !== null && localGoogleUser!.email !== null && profile !== null && !googleMergeInProgressRef.current) {
            googleMergeInProgressRef.current = true; // Set flag to prevent concurrent merges
            console.log("🔄 Merging local Google user with existing Firebase anonymous user (Google data takes priority)");
            try {
              // Wait for Firebase to be fully initialized
              await firebaseService.ensureInitialized();
              
              // Get fresh Firebase user state to avoid stale data
              const currentFirebaseUser = firebaseService.getCurrentUser();
              
              // Check if Google account already exists in Firestore first
              const existingGoogleUser = await firebaseService.findUserByEmail(localGoogleUser!.email!);
              
              if (existingGoogleUser !== null && currentFirebaseUser !== null && existingGoogleUser!.uid !== currentFirebaseUser!.uid) {
                // Google account exists with different UID - sign in to existing account instead of linking
                console.log("🔍 Google account exists with different UID, signing in directly");
                
                const accessToken = await authService.getAccessToken();
                const idToken = await authService.getIdToken();
                
                if (accessToken && idToken) {
                  // Clean up anonymous user session first
                  await firebaseService.signOut();
                  
                  // Sign in to existing Google account
                  const credential = GoogleAuthProvider.credential(idToken, accessToken);
                  const authInstance = auth;
                  if (authInstance !== null) {
                    await signInWithCredential(authInstance!, credential);
                  
                    // Get updated profile
                    const mergedProfile = firebaseService.getUserProfile();
                    if (mergedProfile) {
                      setNexusUser(mergedProfile);
                      setNexusAuthenticated(true);
                      setNexusIsPro(firebaseService.isPro());
                      console.log("✅ Signed in to existing Google account directly");
                      
                      // Clear local Google user data (now using Firebase)
                      await authService.signOut();
                      anonymousUserInitRef.current = true;
                      googleMergeInProgressRef.current = false; // Reset flag on success
                      return;
                    }
                  }
                }
                googleMergeInProgressRef.current = false; // Reset flag if sign-in failed
              } else if (currentFirebaseUser !== null && currentFirebaseUser!.isAnonymous) {
                // Safe to link - we have an anonymous user
                const accessToken = await authService.getAccessToken();
                const idToken = await authService.getIdToken();
                
                if (accessToken && idToken && localGoogleUser !== null) {
                  console.log("🔗 Linking Google account to anonymous user");
                  
                  // Pass Google user data to prioritize it during merge
                  const googleUserData = {
                    email: localGoogleUser!.email ?? '',
                    displayName: localGoogleUser!.displayName ?? '',
                    photoURL: localGoogleUser!.photoURL ?? undefined,
                  };
                  
                  const mergedProfile = await firebaseService.linkWithGoogleCredential(
                    idToken!, 
                    accessToken!,
                    googleUserData
                  );
                  
                  // Wait a bit for Firestore to update and Firebase listeners to trigger
                  await new Promise(resolve => setTimeout(resolve, 500));
                  
                  // Get the latest profile from Firestore (to ensure we have the merged data)
                  const latestProfile = firebaseService.getUserProfile();
                  const profileToUse = latestProfile || mergedProfile;
                  
                  // Update UI with merged profile from Firestore (Google data is prioritized)
                  setNexusUser(profileToUse);
                  // Now authenticated because Google account is linked (not anonymous anymore)
                  setNexusAuthenticated(true);
                  setNexusIsPro(firebaseService.isPro());
                  console.log("✅ Google user merged with Firebase anonymous user. Profile (Google data):", profileToUse);
                  
                  // Clear local Google user data (now merged in Firebase)
                  await authService.signOut();
                  anonymousUserInitRef.current = true;
                  googleMergeInProgressRef.current = false; // Reset flag on success
                  return;
                }
              } else {
                // Not an anonymous user or other conditions not met
                console.warn("⚠️ Cannot merge - user is not anonymous or merge conditions not met");
                setNexusUser(profile);
                setNexusAuthenticated(false);
                setNexusIsPro(false);
                googleMergeInProgressRef.current = false; // Reset flag
                anonymousUserInitRef.current = true;
                return;
              }
            } catch (mergeError: any) {
              console.error("Error merging Google user:", mergeError);
              googleMergeInProgressRef.current = false; // Reset flag on error
              // If merge fails, use the existing anonymous profile
              anonymousUserInitRef.current = false; // Allow retry
            }
          }
          
          // Load existing anonymous profile
          if (profile) {
            setNexusUser(profile);
            // Anonymous user is NOT considered authenticated (only Google users are)
            setNexusAuthenticated(false);
            setNexusIsPro(false);
            console.log("✅ Firebase anonymous user restored (not authenticated - waiting for Google)");
            anonymousUserInitRef.current = true;
            return;
          }
        }
      } catch (error) {
        console.error("Error initializing Firebase anonymous user:", error);
        // Don't show error to user if it's just anonymous auth disabled
        const authError = error as { code?: string };
        if (authError.code !== "auth/admin-restricted-operation") {
          // Only log other errors, don't show to user
          console.warn("Could not initialize anonymous user:", error);
        }
      } finally {
        // TOUJOURS libérer le lock, même en cas d'erreur
        initAnonymousUserProcessingRef.current = false;
      }
    };

    // NOTE: initRedirect et initAnonymousUser sont DÉSACTIVÉS
    // L'AuthOrchestrator gère maintenant toute l'authentification et l'initialisation
    // Ces fonctions causaient des appels multiples lors des re-renders et des changements de vue
    // L'AuthOrchestrator est appelé une seule fois au démarrage via FirebaseProvider

    // NOTE: Le listener Firebase onAuthStateChange est maintenant PASSIF
    // Toute la logique d'authentification/sync est gérée par AuthOrchestrator
    // On garde juste un listener passif pour mettre à jour l'UI si nécessaire
    let unsubscribeFirebase: (() => void) | null = null;
    if (firebaseService.isInitialized()) {
      unsubscribeFirebase = firebaseService.onAuthStateChange((firebaseUser) => {
        // Listener passif : seulement mettre à jour l'UI basique si AuthOrchestrator n'a pas encore fait
        // L'AuthOrchestrator gère toute la logique d'authentification et de sync
        if (!firebaseUser) {
          // User signed out - l'AuthOrchestrator gérera le cleanup
          // On ne fait rien ici pour éviter les conflits
        }
      });
    }

    // NOTE: L'ancien listener authService.onAuthStateChange est DÉSACTIVÉ
    // Toute la logique d'authentification est maintenant gérée par AuthOrchestrator
    // On garde juste un listener passif pour le sync status (debounced)
    const unsubscribeAuthService = authService.onAuthStateChange((user) => {
      // Listener passif : seulement mettre à jour le sync status (debounced)
      // L'UI et l'authentification sont gérées par AuthOrchestrator
      if (syncStatusDebounceTimerRef.current) {
        clearTimeout(syncStatusDebounceTimerRef.current);
      }
      syncStatusDebounceTimerRef.current = setTimeout(async () => {
        try {
          const status = await nexusServerService.getSyncStatus();
          setSyncStatus({
            lastSyncAt: status.lastSyncAt || null,
            tracksUploaded: status.tracksUploaded,
            tracksDownloaded: status.tracksDownloaded,
          });
        } catch (error) {
          console.error("Error loading sync status:", error);
          setSyncStatus({
            lastSyncAt: null,
            tracksUploaded: 0,
            tracksDownloaded: 0,
          });
        }
      }, 1000); // 1 second debounce
    });

    // Subscribe to upload progress
    const unsubscribeProgress = cloudinaryService.onProgressUpdate((progress) => {
      setUploadProgress(new Map(progress));
      setOverallProgress(cloudinaryService.getOverallProgress());
    });

    return () => {
      if (unsubscribeFirebase) {
        unsubscribeFirebase();
      }
      unsubscribeAuth(); // AuthOrchestrator subscription
      if (typeof unsubscribeAuthService !== 'undefined') {
        unsubscribeAuthService(); // Legacy authService subscription
      }
      unsubscribeProgress();
      
      // Clear debounce timer
      if (syncStatusDebounceTimerRef.current) {
        clearTimeout(syncStatusDebounceTimerRef.current);
        syncStatusDebounceTimerRef.current = null;
      }
      
      // Cleanup Firestore sync listeners
      // NOTE: Import statique pour éviter les erreurs HMR
      // Le cleanup est géré par l'AuthOrchestrator maintenant
    };
  }, []);

  // Cloudinary methods
  const saveCloudinaryConfig = useCallback((config: CloudinaryConfig) => {
    cloudinaryService.saveConfig(config);
    setCloudinaryConfig(config);
    setCloudinaryConfigured(cloudinaryService.isConfigured());
  }, []);

  const clearCloudinaryConfig = useCallback(() => {
    cloudinaryService.clearConfig();
    setCloudinaryConfig(null);
    setCloudinaryConfigured(false);
  }, []);

  // Nexus methods - Google login
  const nexusLoginWithGoogle = useCallback(async () => {
    const electronEnv = isElectron();
    
    // In Electron, use Desktop App OAuth flow (custom URI scheme)
    // In Web, try Firebase Auth first, fallback to manual OAuth if needed
    if (electronEnv) {
      // Use Desktop App OAuth flow for Electron
      try {
        console.log('🔐 Using Desktop App OAuth for Google sign-in (Electron)');
        await authService.signInWithGoogle();
        toast.info("Authentification en cours...");
        return;
      } catch (error: any) {
        console.error("Desktop App OAuth error:", error);
        toast.error("Erreur d'authentification", {
          description: error.message || "Impossible de se connecter avec Google.",
        });
        throw error;
      }
    }
    
    // For Web, try Firebase Auth first, fallback to manual OAuth
    const firebaseReady = firebaseService.isInitialized();
    if (firebaseReady) {
      try {
        console.log('🔐 Using Firebase Auth for Google sign-in (Web)');
        await firebaseService.signInWithGoogle();
        toast.info("Authentification en cours...");
        return;
      } catch (error: any) {
        console.error("Firebase Auth error:", error);
        console.log('⚠️ Firebase Auth failed, falling back to manual OAuth');
      }
    }
    
    // Fallback to manual OAuth for Web (if Firebase not available or failed)
    const clientId = await authService.getGoogleClientId();
    if (!clientId) {
      toast.error("Google OAuth non configuré", {
        description: "Configurez le Client ID OAuth dans les paramètres ou ajoutez GOOGLE_CLIENT_ID dans les variables d'environnement serveur",
      });
      return;
    }

    try {
      // signInWithGoogle may redirect, so it doesn't return a profile
      await authService.signInWithGoogle();
      
      // If we get here without redirect, the popup worked
      // The profile will be set via onAuthStateChange
      const profile = authService.getUserProfile();
      if (profile) {
        setNexusUser(profile);
        setNexusAuthenticated(true);
        // Vérifier le statut Pro depuis le profil (mis à jour par webhook Stripe)
        const isProFromProfile = profile.plan === "pro" && profile.subscriptionStatus === "active";
        setNexusIsPro(isProFromProfile);
        
        // Vérifier aussi directement avec Stripe pour confirmation (non-bloquant)
        if (isProFromProfile) {
          try {
            if (stripeService.isInitialized()) {
              const stripeStatus = await stripeService.getSubscriptionStatus();
              // Utiliser les données Stripe réelles comme source de vérité finale
              const isProFromStripe = stripeStatus.isActive && stripeStatus.plan === 'pro';
              if (isProFromStripe !== isProFromProfile) {
                console.warn('⚠️ Incohérence détectée: Profil indique Pro mais Stripe indique autre chose. Utilisation des données Stripe.');
                setNexusIsPro(isProFromStripe);
              }
            }
          } catch (error) {
            // En cas d'erreur, utiliser les données du profil (mises à jour par webhook)
            console.warn('Could not verify Pro status with Stripe, using profile data:', error);
          }
        }
        notificationService.loginSuccess(profile.email || profile.displayName || "Utilisateur");
      } else {
        // Redirect is happening, show info message
        toast.info("Redirection vers Google...");
      }
    } catch (error: any) {
      console.error("Login error:", error);
      
      // Don't show error if it's just a redirect
      if (error.message && error.message.includes("redirection")) {
        toast.info("Redirection vers Google...");
        return;
      }
      
      toast.error("Erreur de connexion", {
        description: error.message,
      });
      throw error;
    }
  }, [authInitialized]);

  const nexusLogout = useCallback(async () => {
    try {
      console.log('📝 Starting complete logout process...');
      
      // Déconnexion complète : à la fois authService (OAuth manuel) et firebaseService
      await authService.signOut();
      await firebaseService.signOut();
      
      // Nettoyer toutes les données de l'application
      await completeLogoutCleanup();
      
      // Dispatcher l'événement de nettoyage pour tous les hooks et composants
      dispatchLogoutCleanupEvent();
      
      // Nettoyer les états React
      setNexusUser(null);
      setNexusAuthenticated(false);
      setNexusIsPro(false);
      setSyncStatus({
        lastSyncAt: null,
        tracksUploaded: 0,
        tracksDownloaded: 0,
      });
      setCloudinaryConfig(null);
      setCloudinaryConfigured(false);
      
      // Réinitialiser les flags internes
      syncInitializedRef.current = false;
      lastUserIdRef.current = null;
      anonymousUserInitRef.current = false;
      googleMergeInProgressRef.current = false;
      
      // Nettoyer les timers
      if (syncStatusDebounceTimerRef.current) {
        clearTimeout(syncStatusDebounceTimerRef.current);
        syncStatusDebounceTimerRef.current = null;
      }
      
      // NOTE: Le cleanup de firebaseSyncService est géré par l'AuthOrchestrator
      // Plus besoin d'import dynamique qui cause des erreurs HMR
      
      console.log('✅ Complete logout finished - all user data cleaned');
      notificationService.logoutSuccess();
      
      // Recharger l'app après le logout pour garantir un état propre
      setTimeout(() => {
        console.log('🔄 Reloading app after logout...');
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }, 500);
    } catch (error: any) {
      console.error("Logout error:", error);
      notificationService.error("Erreur lors de la déconnexion");
    }
  }, []);

  const nexusUpgradeToPro = useCallback(async () => {
    if (!stripeInitialized) {
      toast.error("Stripe non configuré", {
        description: "Vérifiez votre fichier .env",
      });
      return;
    }

    if (!nexusAuthenticated) {
      toast.error("Connectez-vous d'abord");
      return;
    }

    try {
      toast.info("Redirection vers Stripe...");
      await stripeService.redirectToCheckout();
    } catch (error: any) {
      console.error("Upgrade error:", error);
      toast.error("Erreur", {
        description: error.message,
      });
    }
  }, [stripeInitialized, nexusAuthenticated]);

  const nexusManageBilling = useCallback(async () => {
    if (!stripeInitialized) {
      toast.error("Stripe non configuré");
      return;
    }

    if (!nexusAuthenticated) {
      toast.error("Connectez-vous d'abord");
      return;
    }

    try {
      toast.info("Redirection vers le portail...");
      await stripeService.redirectToPortal();
    } catch (error: any) {
      console.error("Billing portal error:", error);
      toast.error("Erreur", {
        description: error.message,
      });
    }
  }, [stripeInitialized, nexusAuthenticated]);

  const refreshUser = useCallback(async () => {
    // Force reload profile from Firestore
    const currentUser = firebaseService.getCurrentUser();
    if (currentUser && !currentUser.isAnonymous) {
      // Use the new refreshProfile method which will reload from Firestore
      // and trigger the snapshot listener
      await firebaseService.refreshProfile();
      // Update state from current profile
      const profile = firebaseService.getUserProfile();
      if (profile) {
        setNexusUser(profile);
        // Vérifier le statut Pro depuis le profil Firestore (mis à jour par webhook Stripe)
        const isProFromProfile = profile.plan === "pro" && profile.subscriptionStatus === "active";
        setNexusIsPro(isProFromProfile);
        
        // Vérifier aussi directement avec Stripe pour confirmation (non-bloquant)
        if (isProFromProfile) {
          try {
            if (stripeService.isInitialized()) {
              const stripeStatus = await stripeService.getSubscriptionStatus();
              // Utiliser les données Stripe réelles comme source de vérité finale
              const isProFromStripe = stripeStatus.isActive && stripeStatus.plan === 'pro';
              if (isProFromStripe !== isProFromProfile) {
                console.warn('⚠️ Incohérence détectée: Firestore indique Pro mais Stripe indique autre chose. Utilisation des données Stripe.');
                setNexusIsPro(isProFromStripe);
              }
            }
          } catch (error) {
            // En cas d'erreur, utiliser les données Firestore (mises à jour par webhook)
            console.warn('Could not verify Pro status with Stripe, using Firestore data:', error);
          }
        }
      }
    } else {
      const profile = authService.getUserProfile();
      setNexusUser(profile);
      setNexusIsPro(authService.isPro());
    }
  }, []);

  // Sync methods
  const startSync = useCallback(async () => {
    if (!nexusAuthenticated && !cloudinaryConfigured) {
      toast.error("Configurez un service cloud d'abord");
      return;
    }

    setSyncLoading(true);
    try {
      // Synchroniser Firebase d'abord
      await nexusServerService.startSync();

      // Ensuite, synchroniser Stripe avec Firestore si l'utilisateur est authentifié
      if (nexusAuthenticated) {
        try {
          const currentUser = firebaseService.getCurrentUser();
          if (currentUser && !currentUser.isAnonymous) {
            const idToken = await firebaseService.getIdToken();
            if (idToken) {
              console.log('🔄 useCloudSync: Synchronisation Stripe ↔ Firestore...');
              const syncResponse = await fetch('/api/stripe/sync-profile', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${idToken}`,
                },
              });
              
              if (syncResponse.ok) {
                console.log('✅ useCloudSync: Profil Stripe synchronisé');
                // Ne pas appeler refreshProfile() ici - le listener Firestore mettra à jour l'UI automatiquement
                // Mettre à jour l'état local seulement
                await refreshUser();
              } else {
                console.warn('⚠️ useCloudSync: Erreur lors de la synchronisation Stripe:', await syncResponse.text());
              }
            }
          }
        } catch (stripeError) {
          // Ne pas bloquer la synchronisation Firebase si Stripe échoue
          console.warn('⚠️ useCloudSync: Erreur lors de la synchronisation Stripe (non-bloquant):', stripeError);
        }
      }

      // Update sync status
      const status = await nexusServerService.getSyncStatus();
      setSyncStatus({
        lastSyncAt: status.lastSyncAt || new Date().toISOString(),
        tracksUploaded: status.tracksUploaded,
        tracksDownloaded: status.tracksDownloaded,
      });

      toast.success("Synchronisation terminée");
    } catch (error: any) {
      console.error("Sync error:", error);
      toast.error("Erreur de synchronisation", {
        description: error.message,
      });
    } finally {
      setSyncLoading(false);
    }
  }, [nexusAuthenticated, cloudinaryConfigured, refreshUser]);

  const isUploading =
    uploadProgress.size > 0 &&
    Array.from(uploadProgress.values()).some((p) => p.status === "uploading");

  // Mémoriser les valeurs pour éviter les re-renders inutiles
  const memoizedReturn = useMemo(() => ({
    // Service status
    firebaseInitialized: authInitialized,
    stripeInitialized,

    // Cloudinary
    cloudinaryConfigured,
    cloudinaryConfig,
    saveCloudinaryConfig,
    clearCloudinaryConfig,

    // Nexus Server
    nexusUser,
    nexusAuthenticated,
    nexusIsPro,
    nexusLoginWithGoogle,
    nexusLogout,
    nexusUpgradeToPro,
    nexusManageBilling,
    refreshUser,

    // Upload status
    uploadProgress,
    overallProgress,
    isUploading,

    // Sync
    startSync,
    syncStatus,
    syncLoading,
  }), [
    authInitialized,
    stripeInitialized,
    cloudinaryConfigured,
    cloudinaryConfig,
    nexusUser,
    nexusAuthenticated,
    nexusIsPro,
    uploadProgress,
    overallProgress,
    isUploading,
    syncStatus,
    syncLoading,
    // Les callbacks sont déjà mémorisés avec useCallback
    saveCloudinaryConfig,
    clearCloudinaryConfig,
    nexusLoginWithGoogle,
    nexusLogout,
    nexusUpgradeToPro,
    nexusManageBilling,
    refreshUser,
    startSync,
  ]);

  return memoizedReturn;
}
