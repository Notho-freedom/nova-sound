import { useState, useEffect, useCallback } from "react";
import { cloudinaryService, CloudinaryConfig, UploadProgress } from "@/services/cloudinary";
import { nexusServerService, NexusUser } from "@/services/nexus-server";
import { toast } from "sonner";

interface UseCloudSyncReturn {
  // Cloudinary
  cloudinaryConfigured: boolean;
  cloudinaryConfig: CloudinaryConfig | null;
  saveCloudinaryConfig: (config: CloudinaryConfig) => void;
  clearCloudinaryConfig: () => void;

  // Nexus Server
  nexusUser: NexusUser | null;
  nexusAuthenticated: boolean;
  nexusIsPro: boolean;
  nexusLogin: (credential: string, provider: string) => Promise<void>;
  nexusLoginWithEmail: (email: string, password: string) => Promise<void>;
  nexusRegister: (email: string, password: string, name: string) => Promise<void>;
  nexusLogout: () => void;
  nexusUpgradeToPro: () => Promise<void>;
  nexusManageBilling: () => Promise<void>;
  refreshNexusUser: () => Promise<void>;

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
}

export function useCloudSync(): UseCloudSyncReturn {
  // Cloudinary state
  const [cloudinaryConfig, setCloudinaryConfig] = useState<CloudinaryConfig | null>(null);
  const [cloudinaryConfigured, setCloudinaryConfigured] = useState(false);

  // Nexus state
  const [nexusUser, setNexusUser] = useState<NexusUser | null>(null);
  const [nexusAuthenticated, setNexusAuthenticated] = useState(false);

  // Upload state
  const [uploadProgress, setUploadProgress] = useState<Map<string, UploadProgress>>(new Map());
  const [overallProgress, setOverallProgress] = useState(0);

  // Sync state
  const [syncStatus, setSyncStatus] = useState({
    lastSyncAt: null as string | null,
    tracksUploaded: 0,
    tracksDownloaded: 0,
  });

  // Initialize on mount
  useEffect(() => {
    // Load Cloudinary config
    const config = cloudinaryService.loadConfig();
    setCloudinaryConfig(config);
    setCloudinaryConfigured(cloudinaryService.isConfigured());

    // Check Nexus auth
    const isAuth = nexusServerService.isAuthenticated();
    setNexusAuthenticated(isAuth);
    setNexusUser(nexusServerService.getUser());

    // Load sync status
    if (isAuth) {
      nexusServerService.getSyncStatus().then((status) => {
        setSyncStatus({
          lastSyncAt: status.lastSyncAt || null,
          tracksUploaded: status.tracksUploaded,
          tracksDownloaded: status.tracksDownloaded,
        });
      });
    }

    // Subscribe to upload progress
    const unsubscribe = cloudinaryService.onProgressUpdate((progress) => {
      setUploadProgress(new Map(progress));
      setOverallProgress(cloudinaryService.getOverallProgress());
    });

    return unsubscribe;
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

  // Nexus methods - Google/OAuth login
  const nexusLogin = useCallback(async (credential: string, provider: string) => {
    try {
      let user: NexusUser;
      
      if (provider === "google") {
        // Check if it's a credential (JWT) or an OAuth code
        if (credential.includes(".")) {
          // JWT credential from Google Identity Services
          user = await nexusServerService.loginWithGoogle(credential);
        } else {
          // OAuth code from popup flow
          user = await nexusServerService.loginWithOAuthCode(credential, provider);
        }
      } else {
        user = await nexusServerService.loginWithOAuthCode(credential, provider);
      }
      
      setNexusUser(user);
      setNexusAuthenticated(true);
      
      // Load sync status
      const status = await nexusServerService.getSyncStatus();
      setSyncStatus({
        lastSyncAt: status.lastSyncAt || null,
        tracksUploaded: status.tracksUploaded,
        tracksDownloaded: status.tracksDownloaded,
      });
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  }, []);

  // Email/password login
  const nexusLoginWithEmail = useCallback(async (email: string, password: string) => {
    const user = await nexusServerService.login(email, password);
    setNexusUser(user);
    setNexusAuthenticated(true);
    
    // Load sync status
    const status = await nexusServerService.getSyncStatus();
    setSyncStatus({
      lastSyncAt: status.lastSyncAt || null,
      tracksUploaded: status.tracksUploaded,
      tracksDownloaded: status.tracksDownloaded,
    });
  }, []);

  const nexusRegister = useCallback(async (email: string, password: string, name: string) => {
    const user = await nexusServerService.register(email, password, name);
    setNexusUser(user);
    setNexusAuthenticated(true);
  }, []);

  const nexusLogout = useCallback(() => {
    nexusServerService.logout();
    setNexusUser(null);
    setNexusAuthenticated(false);
    setSyncStatus({
      lastSyncAt: null,
      tracksUploaded: 0,
      tracksDownloaded: 0,
    });
  }, []);

  const nexusUpgradeToPro = useCallback(async () => {
    const url = await nexusServerService.getProCheckoutUrl();
    
    if (url === "DEMO_UPGRADE_SUCCESS") {
      // Demo mode - user was upgraded locally
      const updatedUser = nexusServerService.getUser();
      setNexusUser(updatedUser);
      toast.success("Passé au plan Pro !", {
        description: "Mode démo: Upgrade simulé avec succès",
      });
    } else if (url) {
      window.open(url, "_blank");
    }
  }, []);

  const nexusManageBilling = useCallback(async () => {
    const url = await nexusServerService.getBillingPortalUrl();
    
    if (url === "DEMO_BILLING_PORTAL") {
      toast.info("Portail de facturation", {
        description: "Mode démo: Le portail n'est pas disponible",
      });
    } else if (url) {
      window.open(url, "_blank");
    }
  }, []);

  const refreshNexusUser = useCallback(async () => {
    await nexusServerService.refreshUser();
    setNexusUser(nexusServerService.getUser());
  }, []);

  // Sync methods
  const startSync = useCallback(async () => {
    if (!nexusAuthenticated && !cloudinaryConfigured) {
      toast.error("Configurez un service cloud d'abord");
      return;
    }
    
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
    } catch (error) {
      console.error("Sync error:", error);
      toast.error("Erreur de synchronisation");
    }
  }, [nexusAuthenticated, cloudinaryConfigured]);

  const isUploading = uploadProgress.size > 0 && 
    Array.from(uploadProgress.values()).some(p => p.status === "uploading");

  return {
    // Cloudinary
    cloudinaryConfigured,
    cloudinaryConfig,
    saveCloudinaryConfig,
    clearCloudinaryConfig,

    // Nexus Server
    nexusUser,
    nexusAuthenticated,
    nexusIsPro: nexusUser?.plan === "pro",
    nexusLogin,
    nexusLoginWithEmail,
    nexusRegister,
    nexusLogout,
    nexusUpgradeToPro,
    nexusManageBilling,
    refreshNexusUser,

    // Upload status
    uploadProgress,
    overallProgress,
    isUploading,

    // Sync
    startSync,
    syncStatus,
  };
}
