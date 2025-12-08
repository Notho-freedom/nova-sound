import { useState, useEffect, useCallback } from "react";
import { cloudinaryService, CloudinaryConfig, UploadProgress } from "@/services/cloudinary";
import { nexusServerService } from "@/services/nexus-server";
import { firebaseService, UserProfile } from "@/services/firebase";
import { stripeService } from "@/services/stripe";
import { toast } from "sonner";

interface UseCloudSyncReturn {
  // Firebase status
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
  const [firebaseInitialized] = useState(firebaseService.isInitialized());
  const [stripeInitialized] = useState(stripeService.isInitialized());

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

  // Initialize on mount
  useEffect(() => {
    // Load Cloudinary config
    const config = cloudinaryService.loadConfig();
    setCloudinaryConfig(config);
    setCloudinaryConfigured(cloudinaryService.isConfigured());

    // Handle redirect result on mount (if user just came back from Google auth)
    const initRedirect = async () => {
      try {
        const profile = await firebaseService.handleRedirectResult();
        if (profile) {
          // User just authenticated via redirect
          setNexusUser(profile);
          setNexusAuthenticated(true);
          setNexusIsPro(firebaseService.isPro());
          
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
        }
      } catch (error) {
        console.error("Error handling redirect:", error);
      }
    };
    initRedirect();

    // Subscribe to Firebase auth state changes
    const unsubscribeAuth = firebaseService.onAuthStateChange(async (user) => {
      if (user) {
        // Wait a bit for profile to be loaded from Firestore
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Get profile - if not loaded yet, wait a bit more
        let profile = firebaseService.getUserProfile();
        let retries = 0;
        while (!profile && retries < 5) {
          await new Promise(resolve => setTimeout(resolve, 200));
          profile = firebaseService.getUserProfile();
          retries++;
        }
        
        setNexusUser(profile);
        setNexusAuthenticated(true);
        setNexusIsPro(firebaseService.isPro());

        // Load sync status
        nexusServerService.getSyncStatus().then((status) => {
          setSyncStatus({
            lastSyncAt: status.lastSyncAt || null,
            tracksUploaded: status.tracksUploaded,
            tracksDownloaded: status.tracksDownloaded,
          });
        });
      } else {
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
      unsubscribeAuth();
      unsubscribeProgress();
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

  // Nexus methods - Google login via Firebase
  const nexusLoginWithGoogle = useCallback(async () => {
    if (!firebaseInitialized) {
      toast.error("Firebase non configuré", {
        description: "Vérifiez votre fichier .env",
      });
      return;
    }

    try {
      // signInWithGoogle may redirect, so it doesn't return a profile
      await firebaseService.signInWithGoogle();
      
      // If we get here without redirect, the popup worked
      // The profile will be set via onAuthStateChange
      const profile = firebaseService.getUserProfile();
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
  }, [firebaseInitialized]);

  const nexusLogout = useCallback(async () => {
    try {
      await firebaseService.signOut();
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
    const profile = firebaseService.getUserProfile();
    setNexusUser(profile);
    setNexusIsPro(firebaseService.isPro());
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
