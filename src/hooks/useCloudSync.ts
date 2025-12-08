import { useState, useEffect, useCallback } from "react";
import { cloudinaryService, CloudinaryConfig, UploadProgress } from "@/services/cloudinary";
import { nexusServerService, NexusUser } from "@/services/nexus-server";

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
  nexusLogin: (email: string, password: string) => Promise<void>;
  nexusRegister: (email: string, password: string, name: string) => Promise<void>;
  nexusLogout: () => void;
  nexusUpgradeToPro: () => Promise<void>;
  nexusManageBilling: () => Promise<void>;

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
    setNexusAuthenticated(nexusServerService.isAuthenticated());
    setNexusUser(nexusServerService.getUser());

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

  // Nexus methods
  const nexusLogin = useCallback(async (email: string, password: string) => {
    const user = await nexusServerService.login(email, password);
    setNexusUser(user);
    setNexusAuthenticated(true);
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
  }, []);

  const nexusUpgradeToPro = useCallback(async () => {
    const url = await nexusServerService.getProCheckoutUrl();
    window.open(url, "_blank");
  }, []);

  const nexusManageBilling = useCallback(async () => {
    const url = await nexusServerService.getBillingPortalUrl();
    window.open(url, "_blank");
  }, []);

  // Sync methods
  const startSync = useCallback(async () => {
    await nexusServerService.startSync();
    const status = await nexusServerService.getSyncStatus();
    setSyncStatus({
      lastSyncAt: status.lastSyncAt,
      tracksUploaded: status.tracksUploaded,
      tracksDownloaded: status.tracksDownloaded,
    });
  }, []);

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
    nexusRegister,
    nexusLogout,
    nexusUpgradeToPro,
    nexusManageBilling,

    // Upload status
    uploadProgress,
    overallProgress,
    isUploading,

    // Sync
    startSync,
    syncStatus,
  };
}

