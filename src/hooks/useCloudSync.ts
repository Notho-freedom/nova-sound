import { useState, useEffect, useCallback, useRef } from "react";
import { cloudinaryService, CloudinaryConfig, UploadProgress } from "@/services/cloudinary";
import { nexusServerService } from "@/services/nexus-server";
import { authService, UserProfile } from "@/services/auth";
import { firebaseService } from "@/services/firebase";
import { stripeService } from "@/services/stripe";
import { notificationService } from "@/services/notification-service";
import { toast } from "sonner";

interface UseCloudSyncReturn {
  // Auth status
  firebaseInitialized: boolean;
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
  const [firebaseInitialized, setFirebaseInitialized] = useState(false);
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

  // Refs to prevent multiple initializations
  const initRef = useRef(false);

  // Initialize everything on mount
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const init = async () => {
      console.log("🔄 useCloudSync: Starting initialization...");

      // 1. Initialize Stripe
      try {
        await stripeService.ensureInitialized();
        setStripeInitialized(stripeService.isInitialized());
      } catch (error) {
        console.warn("Stripe initialization failed:", error);
      }

      // 2. Load Cloudinary config
      const config = cloudinaryService.loadConfig();
      setCloudinaryConfig(config);
      setCloudinaryConfigured(cloudinaryService.isConfigured());

      // 3. Initialize Firebase and wait for auth
      try {
        await firebaseService.ensureInitialized();
        setFirebaseInitialized(true);

        // Wait for auth to be ready
        const user = await firebaseService.waitForAuthReady();
        
        if (user) {
          const profile = firebaseService.getUserProfile();
          if (profile) {
            updateUserState(profile, !user.isAnonymous);
            console.log(`✅ useCloudSync: User ready - ${user.isAnonymous ? 'Anonymous' : 'Google'}: ${user.email || user.uid}`);
          }
        } else {
          // No user - initialize anonymous session
          console.log("📱 useCloudSync: No user found, initializing session...");
          const profile = await firebaseService.initializeUserSession();
          if (profile) {
            updateUserState(profile, !profile.isAnonymous);
          }
        }
      } catch (error) {
        console.error("Firebase initialization error:", error);
        setFirebaseInitialized(true); // Mark as initialized even on error
      }

      console.log("✅ useCloudSync: Initialization complete");
    };

    init();
  }, []);

  // Helper to update user state
  const updateUserState = useCallback((profile: UserProfile | null, authenticated: boolean) => {
    setNexusUser(profile);
    setNexusAuthenticated(authenticated);
    setNexusIsPro(profile?.plan === "pro" && profile?.subscriptionStatus === "active");
  }, []);

  // Subscribe to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = firebaseService.onAuthStateChange(async (user) => {
      if (user) {
        const profile = firebaseService.getUserProfile();
        if (profile) {
          updateUserState(profile, !user.isAnonymous);
        } else {
          // Profile not loaded yet - wait a bit and retry
          setTimeout(() => {
            const p = firebaseService.getUserProfile();
            if (p) {
              updateUserState(p, !user.isAnonymous);
            }
          }, 500);
        }

        // Initialize sync for non-anonymous users
        if (!user.isAnonymous) {
          try {
            const { firebaseSyncService } = await import('@/services/firebase-sync');
            await firebaseSyncService.initializeSync(user.uid);
            console.log("✅ Firebase sync initialized for user:", user.email);
          } catch (error) {
            console.error("Firebase sync init error:", error);
          }

          // Load sync status
          loadSyncStatus();
        }
      } else {
        // User signed out
        updateUserState(null, false);
        setSyncStatus({ lastSyncAt: null, tracksUploaded: 0, tracksDownloaded: 0 });
      }
    });

    return () => unsubscribe();
  }, [updateUserState]);

  // Subscribe to upload progress
  useEffect(() => {
    const unsubscribe = cloudinaryService.onProgressUpdate((progress) => {
      setUploadProgress(new Map(progress));
      setOverallProgress(cloudinaryService.getOverallProgress());
    });
    return () => unsubscribe();
  }, []);

  // Load sync status
  const loadSyncStatus = useCallback(async () => {
    try {
      const status = await nexusServerService.getSyncStatus();
      setSyncStatus({
        lastSyncAt: status.lastSyncAt || null,
        tracksUploaded: status.tracksUploaded,
        tracksDownloaded: status.tracksDownloaded,
      });
    } catch (error) {
      console.warn("Failed to load sync status:", error);
    }
  }, []);

  // Cloudinary methods
  const saveCloudinaryConfig = useCallback((config: CloudinaryConfig) => {
    cloudinaryService.saveConfig(config);
    setCloudinaryConfig(config);
    setCloudinaryConfigured(true);
  }, []);

  const clearCloudinaryConfig = useCallback(() => {
    cloudinaryService.clearConfig();
    setCloudinaryConfig(null);
    setCloudinaryConfigured(false);
  }, []);

  // Login with Google
  const nexusLoginWithGoogle = useCallback(async () => {
    const clientId = await authService.getGoogleClientId();
    if (!clientId) {
      toast.error("Google OAuth non configuré", {
        description: "Ajoutez GOOGLE_CLIENT_ID dans les variables d'environnement",
      });
      return;
    }

    try {
      await authService.signInWithGoogle();
      
      // Wait for auth state to update
      const profile = authService.getUserProfile();
      if (profile) {
        updateUserState(profile, true);
        notificationService.loginSuccess(profile.email || profile.displayName || "Utilisateur");
      }
    } catch (error: any) {
      console.error("Login error:", error);
      
      if (error.message?.includes("annulée")) {
        return; // User cancelled
      }
      
      toast.error("Erreur de connexion", {
        description: error.message,
      });
    }
  }, [updateUserState]);

  // Logout
  const nexusLogout = useCallback(async () => {
    try {
      await authService.signOut();
      await firebaseService.signOut();
      
      updateUserState(null, false);
      notificationService.logoutSuccess();
    } catch (error: any) {
      console.error("Logout error:", error);
      notificationService.error("Erreur lors de la déconnexion");
    }
  }, [updateUserState]);

  // Upgrade to Pro
  const nexusUpgradeToPro = useCallback(async () => {
    if (!stripeInitialized) {
      toast.error("Stripe non configuré");
      return;
    }

    try {
      const email = nexusUser?.email;
      if (!email) {
        toast.error("Connectez-vous d'abord");
        return;
      }

      await stripeService.redirectToCheckout();
    } catch (error: any) {
      console.error("Upgrade error:", error);
      toast.error("Erreur lors de l'upgrade", {
        description: error.message,
      });
    }
  }, [stripeInitialized, nexusUser]);

  // Manage billing
  const nexusManageBilling = useCallback(async () => {
    if (!stripeInitialized) {
      toast.error("Stripe non configuré");
      return;
    }

    try {
      const email = nexusUser?.email;
      if (!email) {
        toast.error("Connectez-vous d'abord");
        return;
      }

      await stripeService.redirectToPortal();
    } catch (error: any) {
      console.error("Billing error:", error);
      toast.error("Erreur", {
        description: error.message,
      });
    }
  }, [stripeInitialized, nexusUser]);

  // Refresh user
  const refreshUser = useCallback(() => {
    const user = firebaseService.getCurrentUser();
    if (user) {
      const profile = firebaseService.getUserProfile();
      if (profile) {
        updateUserState(profile, !user.isAnonymous);
      }
    }
  }, [updateUserState]);

  // Start sync
  const startSync = useCallback(async () => {
    if (syncLoading) return;
    
    setSyncLoading(true);

    try {
      // Dispatch sync event
      window.dispatchEvent(new CustomEvent("nexus-sync-start"));

      if (nexusAuthenticated) {
        const { firebaseSyncService } = await import('@/services/firebase-sync');
        await firebaseSyncService.forceSyncNow();
        
        // Reload sync status
        await loadSyncStatus();
      }

      window.dispatchEvent(new CustomEvent("nexus-sync-complete"));
      notificationService.syncCompleted();
    } catch (error: any) {
      console.error("Sync error:", error);
      window.dispatchEvent(new CustomEvent("nexus-sync-error"));
      notificationService.syncFailed(error.message);
    } finally {
      setSyncLoading(false);
    }
  }, [syncLoading, nexusAuthenticated, loadSyncStatus]);

  // Computed values
  const isUploading = uploadProgress.size > 0;

  return {
    // Auth status
    firebaseInitialized,
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
