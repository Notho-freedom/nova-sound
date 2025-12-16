import { useState, useEffect, useCallback, useRef } from "react";
import { cloudinaryService, CloudinaryConfig, UploadProgress } from "@/services/cloudinary";
import { nexusServerService } from "@/services/nexus-server";
import { authService, UserProfile } from "@/services/auth";
import { firebaseService } from "@/services/firebase";
import { stripeService } from "@/services/stripe";
import { toast } from "sonner";

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
  const syncStatusDebounceTimerRef = useRef<NodeJS.Timeout | null>(null); // Debounce sync status calls

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

    // Initialize Firebase anonymous user if no user is authenticated
    // If a Google user exists locally, merge it with Firebase anonymous user
    const initAnonymousUser = async () => {
      // Prevent multiple initializations with a lock
      if (anonymousUserInitRef.current) {
        console.log("⏳ Anonymous user initialization already in progress, skipping...");
        return;
      }

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
        if (firebaseUser && !firebaseUser.isAnonymous) {
          const profile = firebaseService.getUserProfile();
          if (profile) {
            setNexusUser(profile);
            setNexusAuthenticated(true);
            setNexusIsPro(firebaseService.isPro());
            anonymousUserInitRef.current = true;
            console.log("✅ Using existing Firebase Google user:", firebaseUser.email);
            return;
          }
        }
        
        // PRIORITY 2: If there's a local Google user but no Firebase user, update UI immediately
        // Then try to sync with Firebase if possible
        if (localGoogleUser && localGoogleUser.email && !firebaseUser) {
          console.log("🔍 Google user found locally (", localGoogleUser.email, "). Updating UI immediately.");
          
          // Update UI immediately with the Google user
          setNexusUser(localGoogleUser);
          setNexusAuthenticated(true);
          setNexusIsPro(authService.isPro());
          anonymousUserInitRef.current = true;
          
          // Try to find existing user in Firestore and sync (non-blocking)
          if (firebaseService.isInitialized()) {
            firebaseService.findUserByEmail(localGoogleUser.email)
              .then((existingUser) => {
                if (existingUser) {
                  console.log("✅ Found existing Google user in Firestore, syncing...");
                  // Update with Firestore data (more complete)
                  setNexusUser(existingUser);
                  setNexusIsPro(existingUser.plan === 'pro');
                }
              })
              .catch((error) => {
                // Silent fail - local user data is already set
                console.warn("⚠️ Could not sync with Firestore, using local user data");
              });
          }
          
          // Load sync status
          nexusServerService.getSyncStatus()
            .then((status) => {
              setSyncStatus({
                lastSyncAt: status.lastSyncAt || null,
                tracksUploaded: status.tracksUploaded,
                tracksDownloaded: status.tracksDownloaded,
              });
            })
            .catch((error) => {
              console.error("Error loading sync status:", error);
            });
          
          // Don't create anonymous user - user is already authenticated with Google
          return;
        }
        
        // PRIORITY 3: If no Firebase user exists and no Google user, create anonymous user
        // Only if we're online (Firestore operations require network)
        if (!firebaseUser && !localGoogleUser) {
          // Check if we're online before attempting to create anonymous user
          if (typeof navigator !== 'undefined' && !navigator.onLine) {
            console.warn("⚠️ Device is offline, skipping anonymous user creation");
            anonymousUserInitRef.current = true; // Prevent retry while offline
            return;
          }
          
          // Mark as initializing to prevent multiple creations
          anonymousUserInitRef.current = true;
          
          try {
            const anonymousProfile = await firebaseService.signInAnonymously();
            
            setNexusUser(anonymousProfile);
            // Anonymous user is NOT considered authenticated (only Google users are)
            setNexusAuthenticated(false);
            setNexusIsPro(false);
            console.log("✅ Firebase anonymous user initialized (not authenticated - waiting for Google)");
            return;
          } catch (anonError: any) {
            // Check if anonymous auth is disabled
            if (anonError.code === "auth/admin-restricted-operation") {
              console.warn("⚠️ Firebase Anonymous Authentication is disabled. Please enable it in Firebase Console > Authentication > Sign-in method > Anonymous");
              // Don't show error to user, just log it
              anonymousUserInitRef.current = false;
              return;
            }
            
            // Handle offline errors gracefully
            if (anonError.code === "unavailable" || anonError.message?.includes("offline")) {
              console.warn("⚠️ Firebase unavailable (offline), skipping anonymous user creation");
              anonymousUserInitRef.current = false; // Allow retry when back online
              return;
            }
            
            anonymousUserInitRef.current = false;
            throw anonError;
          }
        } else if (firebaseUser && firebaseUser.isAnonymous) {
          // Firebase anonymous user exists - check if we should link with Google
          const profile = firebaseService.getUserProfile();
          
          // If there's a local Google user, merge it (Google data takes priority)
          if (localGoogleUser && localGoogleUser.email && profile) {
            console.log("🔄 Merging local Google user with existing Firebase anonymous user (Google data takes priority)");
            try {
              // Wait for Firebase to be fully initialized
              await firebaseService.ensureInitialized();
              
              // Verify that we still have an anonymous user
              const currentFirebaseUser = firebaseService.getCurrentUser();
              if (!currentFirebaseUser || !currentFirebaseUser.isAnonymous) {
                console.warn("⚠️ No anonymous user found, skipping merge");
                setNexusUser(profile);
                setNexusAuthenticated(false);
                setNexusIsPro(false);
                anonymousUserInitRef.current = true;
                return;
              }
              
              const accessToken = await authService.getAccessToken();
              const idToken = await authService.getIdToken();
              
              if (accessToken && idToken) {
                // Check if a Google account with this email already exists in Firestore
                const existingGoogleUser = await firebaseService.findUserByEmail(localGoogleUser.email);
                
                if (existingGoogleUser && existingGoogleUser.uid !== firebaseUser.uid) {
                  // Account Google existe déjà avec un autre UID
                  // Firebase va automatiquement remplacer l'utilisateur anonyme lors de la liaison
                  console.log("🔍 Google account exists with different UID, will replace anonymous user during link");
                }
                
                // Pass Google user data to prioritize it during merge
                const googleUserData = {
                  email: localGoogleUser.email,
                  displayName: localGoogleUser.displayName,
                  photoURL: localGoogleUser.photoURL || undefined,
                };
                
                // Link Google account to anonymous Firebase user (Google data takes priority)
                const mergedProfile = await firebaseService.linkWithGoogleCredential(
                  idToken, 
                  accessToken,
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
                return;
              }
            } catch (mergeError: any) {
              console.error("Error merging Google user:", mergeError);
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
      }
    };

    // Handle redirect result on mount (if user just came back from Google auth)
    const initRedirect = async () => {
      try {
        // First, check Firebase redirect (if using Firebase Google auth)
        if (firebaseService.isInitialized()) {
          const firebaseProfile = await firebaseService.handleRedirectResult();
          if (firebaseProfile) {
            setNexusUser(firebaseProfile);
            setNexusAuthenticated(true);
            setNexusIsPro(firebaseService.isPro());
            
            toast.success("Connecté avec succès", {
              description: `Bienvenue ${firebaseProfile.displayName}!`,
            });
            
            const status = await nexusServerService.getSyncStatus();
            setSyncStatus({
              lastSyncAt: status.lastSyncAt || null,
              tracksUploaded: status.tracksUploaded,
              tracksDownloaded: status.tracksDownloaded,
            });
            return;
          }
        }

        // Then check manual OAuth callback (only if there are OAuth params in URL)
        // Only check on client side
        if (typeof window === 'undefined') {
          await initAnonymousUser();
          return;
        }
        
        const urlParams = new URLSearchParams(window.location.search);
        const hasOAuthParams = urlParams.has("code") && urlParams.has("state");
        
        if (hasOAuthParams) {
          const profile = await authService.handleCallback();
          if (profile) {
            // User just authenticated via manual OAuth redirect
            setNexusUser(profile);
            setNexusAuthenticated(true);
            setNexusIsPro(authService.isPro());
            
            // Show success message
            toast.success("Connecté avec succès", {
              description: `Bienvenue ${profile.displayName}!`,
            });
            
            // Load sync status
            const status = await nexusServerService.getSyncStatus();
            setSyncStatus({
              lastSyncAt: status.lastSyncAt || null,
              tracksUploaded: status.tracksUploaded,
              tracksDownloaded: status.tracksDownloaded,
            });
            return;
          }
        }
        
        // No OAuth redirect, check if we need to create anonymous user
        await initAnonymousUser();
      } catch (error) {
        console.error("Error handling redirect:", error);
        // Try to create anonymous user on error
        await initAnonymousUser();
      }
    };
    initRedirect();

    // Subscribe to Firebase auth state changes (priority - uses merged Google data from Firestore)
    let unsubscribeFirebase: (() => void) | null = null;
    
    // Initialize Firebase if not already initialized
    const initFirebaseAuth = async () => {
      try {
        await firebaseService.ensureInitialized();
        if (firebaseService.isInitialized()) {
          // Set up auth state listener
          unsubscribeFirebase = firebaseService.onAuthStateChange(async (firebaseUser) => {
            if (firebaseUser) {
              // Wait for profile to be loaded with retries
              // The profile might not be immediately available after auth state change
              let profile = firebaseService.getUserProfile();
              
              // Retry up to 5 times with increasing delays
              const delays = [100, 200, 400, 800, 1000];
              for (let i = 0; i < delays.length && !profile; i++) {
                await new Promise(resolve => setTimeout(resolve, delays[i]));
                profile = firebaseService.getUserProfile();
              }
              
              if (profile) {
                // Update UI with profile from Firestore (Google data is prioritized during merge)
                setNexusUser(profile);
                // Only consider authenticated if user is NOT anonymous (has Google account)
                setNexusAuthenticated(!firebaseUser.isAnonymous);
                setNexusIsPro(firebaseService.isPro());
                
                // Initialize Firebase sync ONLY ONCE per user session
                // Check if this is a new user or if sync hasn't been initialized yet
                if (!firebaseUser.isAnonymous) {
                  const currentUserId = firebaseUser.uid;
                  
                  // Only initialize if it's a different user or sync hasn't been initialized
                  if (lastUserIdRef.current !== currentUserId || !syncInitializedRef.current) {
                    try {
                      const { firebaseSyncService } = await import('@/services/firebase-sync');
                      
                      // Ensure sync is properly initialized
                      await firebaseSyncService.initializeSync(currentUserId);
                      
                      syncInitializedRef.current = true;
                      lastUserIdRef.current = currentUserId;
                      
                      // Load sync status only once during initialization
                      try {
                        const status = await nexusServerService.getSyncStatus();
                        setSyncStatus({
                          lastSyncAt: status.lastSyncAt || null,
                          tracksUploaded: status.tracksUploaded,
                          tracksDownloaded: status.tracksDownloaded,
                        });
                      } catch {
                        // Silently fail
                        setSyncStatus({
                          lastSyncAt: null,
                          tracksUploaded: 0,
                          tracksDownloaded: 0,
                        });
                      }
                    } catch (error) {
                      console.error('Error initializing Firebase sync:', error);
                      // Retry once after a delay
                      setTimeout(async () => {
                        try {
                          const { firebaseSyncService } = await import('@/services/firebase-sync');
                          await firebaseSyncService.initializeSync(currentUserId);
                          syncInitializedRef.current = true;
                          lastUserIdRef.current = currentUserId;
                        } catch (retryError) {
                          console.error('Retry failed to initialize Firebase sync:', retryError);
                        }
                      }, 2000);
                    }
                  }
                  // If sync is already initialized for this user, skip everything
                  // This prevents re-initialization and status loading on every auth state change
                }
              } else if (firebaseUser.isAnonymous) {
                // For anonymous users without profile, create a basic profile display
                setNexusUser({
                  uid: firebaseUser.uid,
                  email: '',
                  displayName: 'Utilisateur anonyme',
                  photoURL: null,
                  plan: 'free',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                });
                setNexusAuthenticated(false);
                setNexusIsPro(false);
              }
              // For non-anonymous users without profile after retries, silently skip
              // The profile will be loaded on next auth state change
            } else {
              // Firebase user signed out - cleanup sync listeners
              try {
                const { firebaseSyncService } = await import('@/services/firebase-sync');
                firebaseSyncService.cleanup();
              } catch (error) {
                // Silently fail
              }
              
              // Reset flags
              syncInitializedRef.current = false;
              lastUserIdRef.current = null;
              
              setNexusUser(null);
              setNexusAuthenticated(false);
              setNexusIsPro(false);
              setSyncStatus({
                lastSyncAt: null,
                tracksUploaded: 0,
                tracksDownloaded: 0,
              });
            }
          });
        }
      } catch (error) {
        console.error('Error initializing Firebase auth:', error);
      }
    };
    
    // Initialize Firebase auth
    initFirebaseAuth();

    // Subscribe to manual auth state changes (fallback for non-Firebase users)
    // This listener updates UI immediately when a Google user is detected
    const unsubscribeAuth = authService.onAuthStateChange(async (user) => {
      // Always update UI if user exists and Firebase user doesn't exist or is different
      if (user) {
        const firebaseUser = firebaseService.getCurrentUser();
        
        // Update UI if no Firebase user or if Firebase user is different
        if (!firebaseUser || (firebaseUser.isAnonymous && !user.isAnonymous)) {
          console.log("useCloudSync: Manual auth state changed, user:", user.email || user.displayName || "Anonymous");
          
          // Verify token is available (only for non-anonymous users)
          if (!user.isAnonymous) {
            try {
              const token = await authService.getAccessToken();
              console.log("useCloudSync: Token available:", token ? "✓" : "✗");
            } catch (tokenError) {
              console.error("useCloudSync: Error getting token:", tokenError);
            }
          }
          
          // Update UI immediately
          setNexusUser(user);
          setNexusAuthenticated(!user.isAnonymous);
          setNexusIsPro(authService.isPro());
          
          // Try to sync with Firestore if Firebase is initialized
          if (firebaseService.isInitialized() && user.email && !user.isAnonymous) {
            firebaseService.findUserByEmail(user.email)
              .then((existingUser) => {
                if (existingUser) {
                  console.log("✅ Syncing with Firestore user data");
                  setNexusUser(existingUser);
                  setNexusIsPro(existingUser.plan === 'pro');
                }
              })
              .catch((error) => {
                // Silent fail - local user data is already set
              });
          }

          // Load sync status (debounced to avoid excessive calls)
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
        }
      } else if (!user && (!firebaseService.isInitialized() || !firebaseService.getCurrentUser())) {
        // Only clear if no Firebase user exists
        setNexusUser(null);
        setNexusAuthenticated(false);
        setNexusIsPro(false);
        setSyncStatus({
          lastSyncAt: null,
          tracksUploaded: 0,
          tracksDownloaded: 0,
        });
      }
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
      unsubscribeAuth();
      unsubscribeProgress();
      
      // Clear debounce timer
      if (syncStatusDebounceTimerRef.current) {
        clearTimeout(syncStatusDebounceTimerRef.current);
        syncStatusDebounceTimerRef.current = null;
      }
      
      // Cleanup Firestore sync listeners
      import('@/services/firebase-sync').then(({ firebaseSyncService }) => {
        firebaseSyncService.cleanup();
      }).catch((error) => {
        console.error('Error cleaning up sync on unmount:', error);
      });
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
    // Check if Google OAuth Client ID is configured
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
        setNexusIsPro(profile.plan === "pro" && profile.subscriptionStatus === "active");
        toast.success("Connecté avec succès");
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
      await authService.signOut();
      setNexusUser(null);
      setNexusAuthenticated(false);
      setNexusIsPro(false);
      setSyncStatus({
        lastSyncAt: null,
        tracksUploaded: 0,
        tracksDownloaded: 0,
      });
      toast.success("Déconnecté");
    } catch (error: any) {
      console.error("Logout error:", error);
      toast.error("Erreur lors de la déconnexion");
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

  const refreshUser = useCallback(() => {
    const profile = authService.getUserProfile();
    setNexusUser(profile);
    setNexusIsPro(authService.isPro());
  }, []);

  // Sync methods
  const startSync = useCallback(async () => {
    if (!nexusAuthenticated && !cloudinaryConfigured) {
      toast.error("Configurez un service cloud d'abord");
      return;
    }

    setSyncLoading(true);
    try {
      await nexusServerService.startSync();

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
  }, [nexusAuthenticated, cloudinaryConfigured]);

  const isUploading =
    uploadProgress.size > 0 &&
    Array.from(uploadProgress.values()).some((p) => p.status === "uploading");

  return {
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
  };
}
