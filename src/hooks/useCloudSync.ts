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
  const [stripeInitialized, setStripeInitialized] = useState(false);

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

  // Initialize on mount
  useEffect(() => {
    // Check Stripe initialization status
    stripeService.isInitialized().then(setStripeInitialized).catch(() => setStripeInitialized(false));
    
    // Load Cloudinary config
    const config = cloudinaryService.loadConfig();
    setCloudinaryConfig(config);
    setCloudinaryConfigured(cloudinaryService.isConfigured());

    // Initialize Firebase anonymous user if no user is authenticated
    // If a Google user exists locally, merge it with Firebase anonymous user
    const initAnonymousUser = async () => {
      try {
        // First check if user is already authenticated via authService (manual OAuth)
        const existingAuthUser = authService.getUserProfile();
        if (existingAuthUser && !existingAuthUser.isAnonymous) {
          console.log('✅ [useCloudSync] User already authenticated via authService, skipping anonymous user');
          setNexusUser(existingAuthUser);
          setNexusAuthenticated(true);
          setNexusIsPro(authService.isPro());
          return;
        }
        
        // Check Firebase first (for anonymous auth)
        if (firebaseService.isInitialized()) {
          const firebaseUser = firebaseService.getCurrentUser();
          
          // Check if there's a Google user in local storage (from manual OAuth)
          const localGoogleUser = authService.getCurrentUser();
          
          if (!firebaseUser) {
            // No Firebase user, create anonymous user
            try {
              const anonymousProfile = await firebaseService.signInAnonymously();
              
              // If there's a local Google user, merge it with the anonymous Firebase user
              if (localGoogleUser && localGoogleUser.email) {
                console.log("🔄 Merging local Google user with Firebase anonymous user (Google data takes priority)");
                try {
                  const accessToken = await authService.getAccessToken();
                  const idToken = await authService.getIdToken();
                  
                  if (accessToken && idToken) {
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
                  await new Promise(resolve => setTimeout(resolve, 200));
                  
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
                  return;
                  }
                } catch (mergeError: any) {
                  console.error("Error merging Google user:", mergeError);
                  // If merge fails, keep the anonymous user
                  setNexusUser(anonymousProfile);
                  setNexusAuthenticated(true);
                  setNexusIsPro(false);
                  return;
                }
              }
              
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
                return;
              }
              throw anonError;
            }
          } else if (firebaseUser.isAnonymous) {
            // Firebase anonymous user exists
            const profile = firebaseService.getUserProfile();
            
            // If there's a local Google user, merge it (Google data takes priority)
            if (localGoogleUser && localGoogleUser.email && profile) {
              console.log("🔄 Merging local Google user with existing Firebase anonymous user (Google data takes priority)");
              try {
                const accessToken = await authService.getAccessToken();
                const idToken = await authService.getIdToken();
                
                if (accessToken && idToken) {
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
                  await new Promise(resolve => setTimeout(resolve, 200));
                  
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
                  return;
                }
              } catch (mergeError: any) {
                console.error("Error merging Google user:", mergeError);
                // If merge fails, use the existing anonymous profile
              }
            }
            
            // Load existing anonymous profile
            if (profile) {
              setNexusUser(profile);
              // Anonymous user is NOT considered authenticated (only Google users are)
              setNexusAuthenticated(false);
              setNexusIsPro(false);
              console.log("✅ Firebase anonymous user restored (not authenticated - waiting for Google)");
              return;
            }
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
        console.log('🔍 [useCloudSync] Checking redirect result...');
        console.log('🔍 [useCloudSync] Current URL:', window.location.href);
        console.log('🔍 [useCloudSync] URL search:', window.location.search);
        
        // First, check Firebase redirect (if using Firebase Google auth)
        // Firebase handleRedirectResult() should be called FIRST before checking OAuth params
        // because Firebase handles its own redirect flow
        if (firebaseService.isInitialized()) {
          console.log('🔍 [useCloudSync] Firebase initialized, checking redirect result...');
          try {
            const firebaseProfile = await firebaseService.handleRedirectResult();
            if (firebaseProfile) {
              console.log('✅ [useCloudSync] Firebase profile received:', firebaseProfile);
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
              
              // Clean URL after successful Firebase auth
              if (typeof window !== 'undefined') {
                window.history.replaceState({}, document.title, window.location.pathname);
              }
              return;
            } else {
              console.log('⚠️ [useCloudSync] No Firebase profile from redirect result');
            }
          } catch (firebaseError) {
            console.error('❌ [useCloudSync] Firebase handleRedirectResult error:', firebaseError);
          }
        } else {
          console.log('⚠️ [useCloudSync] Firebase not initialized');
        }

        // Then check manual OAuth callback (only if there are OAuth params in URL AND Firebase didn't handle it)
        // Only check on client side
        if (typeof window === 'undefined') {
          console.log('⚠️ [useCloudSync] Window undefined, initializing anonymous user');
          await initAnonymousUser();
          return;
        }
        
        const urlParams = new URLSearchParams(window.location.search);
        const hasOAuthParams = urlParams.has("code") && urlParams.has("state");
        console.log('🔍 [useCloudSync] OAuth params check:', { 
          hasCode: urlParams.has("code"), 
          hasState: urlParams.has("state"),
          hasOAuthParams 
        });
        
        // Try manual OAuth callback if we have OAuth params
        // This uses the backend Express API to exchange the code (client_secret is server-side)
        if (hasOAuthParams) {
          console.log('🔍 [useCloudSync] OAuth params found, trying manual OAuth via backend...');
          try {
            console.log('🔍 [useCloudSync] Calling authService.handleCallback()...');
            const profile = await authService.handleCallback();
            console.log('🔍 [useCloudSync] handleCallback returned:', profile ? 'Profile received' : 'null');
            if (profile) {
              console.log('✅ [useCloudSync] Auth profile received via backend:', profile);
              console.log('✅ [useCloudSync] Profile details:', {
                uid: profile.uid,
                email: profile.email,
                displayName: profile.displayName,
                photoURL: profile.photoURL,
                plan: profile.plan,
                subscriptionStatus: profile.subscriptionStatus,
              });
              
              // User just authenticated via manual OAuth redirect
              // Force update state immediately
              console.log('🔍 [useCloudSync] Setting state with profile...');
              setNexusUser(profile);
              setNexusAuthenticated(true);
              setNexusIsPro(authService.isPro());
              console.log('✅ [useCloudSync] State set successfully');
              
              // Verify the state was set by checking authService
              const currentProfile = authService.getUserProfile();
              console.log('✅ [useCloudSync] Verification - authService.getUserProfile():', currentProfile ? {
                email: currentProfile.email,
                displayName: currentProfile.displayName,
              } : 'null');
              
              // Verify the state was set
              console.log('✅ [useCloudSync] State updated, verifying...');
              setTimeout(() => {
                console.log('✅ [useCloudSync] State check after 100ms:', {
                  nexusUser: profile,
                  nexusAuthenticated: true,
                  nexusIsPro: authService.isPro(),
                });
              }, 100);
              
              // Show success message
              toast.success("Connecté avec succès", {
                description: `Bienvenue ${profile.displayName || profile.email || 'Utilisateur'}!`,
              });
              
              // Load sync status
              try {
                const status = await nexusServerService.getSyncStatus();
                setSyncStatus({
                  lastSyncAt: status.lastSyncAt || null,
                  tracksUploaded: status.tracksUploaded,
                  tracksDownloaded: status.tracksDownloaded,
                });
              } catch (syncError) {
                console.error('❌ [useCloudSync] Error loading sync status:', syncError);
              }
              
              // Clean URL after successful auth
              window.history.replaceState({}, document.title, window.location.pathname);
              
              // Don't initialize anonymous user - we're already authenticated
              console.log('✅ [useCloudSync] Authentication successful, skipping anonymous user initialization');
              return;
            } else {
              console.log('⚠️ [useCloudSync] No profile from authService.handleCallback()');
            }
          } catch (error) {
            console.error('❌ [useCloudSync] Error in authService.handleCallback():', error);
            // Clean URL on error
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        } else {
          console.log('⚠️ [useCloudSync] No OAuth params in URL');
        }
        
        // No OAuth redirect, check if we need to create anonymous user
        // But first check if user is already authenticated via authService
        const existingProfile = authService.getUserProfile();
        if (existingProfile && !existingProfile.isAnonymous) {
          console.log('✅ [useCloudSync] User already authenticated, skipping anonymous user initialization');
          setNexusUser(existingProfile);
          setNexusAuthenticated(true);
          setNexusIsPro(authService.isPro());
          return;
        }
        
        console.log('🔍 [useCloudSync] No redirect detected, initializing anonymous user...');
        await initAnonymousUser();
      } catch (error) {
        console.error("❌ [useCloudSync] Error handling redirect:", error);
        // Try to create anonymous user on error
        await initAnonymousUser();
      }
    };
    initRedirect();

    // Subscribe to Firebase auth state changes (priority - uses merged Google data from Firestore)
    let unsubscribeFirebase: (() => void) | null = null;
    if (firebaseService.isInitialized()) {
      console.log('🔍 [useCloudSync] Subscribing to Firebase auth state changes...');
      unsubscribeFirebase = firebaseService.onAuthStateChange(async (firebaseUser) => {
        console.log('🔔 [useCloudSync] Firebase auth state changed:', firebaseUser ? `User: ${firebaseUser.email}` : 'No user');
        if (firebaseUser) {
          // Always get the latest profile from Firestore (contains merged Google data with priority)
          const profile = firebaseService.getUserProfile();
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
                  const { firebaseSyncService } = await import('../services/firebase-sync');
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
                  } catch (error) {
                    // Silently fail
                    setSyncStatus({
                      lastSyncAt: null,
                      tracksUploaded: 0,
                      tracksDownloaded: 0,
                    });
                  }
                } catch (error) {
                  console.error('Error initializing Firebase sync:', error);
                }
              }
              // If sync is already initialized for this user, skip everything
              // This prevents re-initialization and status loading on every auth state change
            }
          }
        } else {
          // Firebase user signed out - cleanup sync listeners
          try {
            const { firebaseSyncService } = await import('../services/firebase-sync');
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

    // Subscribe to manual auth state changes (fallback for non-Firebase users)
    const unsubscribeAuth = authService.onAuthStateChange(async (user) => {
      // Only handle if Firebase is not initialized or no Firebase user exists
      if (user && (!firebaseService.isInitialized() || !firebaseService.getCurrentUser())) {
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
        
        console.log('✅ [useCloudSync] Setting user state:', { email: user.email, displayName: user.displayName, isPro: authService.isPro() });
        setNexusUser(user);
        setNexusAuthenticated(true);
        console.log('✅ [useCloudSync] User state updated');
        setNexusIsPro(authService.isPro());

        // Load sync status
        nexusServerService.getSyncStatus().then((status) => {
          setSyncStatus({
            lastSyncAt: status.lastSyncAt || null,
            tracksUploaded: status.tracksUploaded,
            tracksDownloaded: status.tracksDownloaded,
          });
        }).catch((error) => {
          console.error("Error loading sync status:", error);
          setSyncStatus({
            lastSyncAt: null,
            tracksUploaded: 0,
            tracksDownloaded: 0,
          });
        });
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
      
      // Cleanup Firestore sync listeners
      import('../services/firebase-sync').then(({ firebaseSyncService }) => {
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
    const clientId = authService.getGoogleClientId();
    if (!clientId) {
      toast.error("Google OAuth non configuré", {
        description: "Configurez le Client ID OAuth dans les paramètres ou ajoutez NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID dans .env",
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
