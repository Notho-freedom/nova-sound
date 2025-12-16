import { useState, useEffect } from "react";
import {
  Volume2,
  Palette,
  Music,
  Bell,
  Keyboard,
  HardDrive,
  Info,
  FolderOpen,
  RefreshCw,
  Mic2,
  Plus,
  X,
  Cloud,
  User,
  CreditCard,
  Shield,
  Sparkles,
  Crown,
  Calendar,
  Download,
  Upload,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  LogOut,
  AlertCircle,
  Zap,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useLibrary } from "@/hooks/useLibrary";
import { useVideos } from "@/hooks/useVideos";
import { useCloudSync } from "@/hooks/useCloudSync";
import { authService } from "@/services/auth";
import { useTheme } from "@/hooks/useTheme";
import { useNotifications } from "@/hooks/useNotifications";
import { toast } from "sonner";
import type { Settings } from "@/types/music";
import { stripeService, PRICE_IDS } from "@/services/stripe";
import type { SubscriptionStatus } from "@/services/stripe";

// Next.js: Use NEXT_PUBLIC_ prefix for client-side env vars
const API_BASE_URL = typeof window !== 'undefined' 
  ? (process.env.NEXT_PUBLIC_API_URL || "") 
  : "";

interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

const SettingRow = ({ label, description, children }: SettingRowProps) => (
  <div className="flex items-center justify-between py-3 border-b border-border/30 last:border-0">
    <div className="flex-1 min-w-0 pr-4">
      <p className="text-sm font-medium text-foreground">{label}</p>
      {description && (
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      )}
    </div>
    <div className="flex-shrink-0">{children}</div>
  </div>
);

interface SettingsCardProps {
  title: string;
  icon: typeof Volume2;
  children: React.ReactNode;
  className?: string;
}

const SettingsCard = ({ title, icon: Icon, children, className }: SettingsCardProps) => (
  <div className={cn("bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 p-5", className)}>
    <div className="flex items-center gap-3 mb-4">
      <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center">
        <Icon className="w-4.5 h-4.5 text-primary" />
      </div>
      <h3 className="font-display text-base font-semibold text-foreground">{title}</h3>
    </div>
    {children}
  </div>
);

// Config status alert
const ConfigAlert = ({ configured, service }: { configured: boolean; service: string }) => {
  if (configured) return null;
  return (
    <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 mb-4">
      <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
      <p className="text-xs text-yellow-500">
        {service} non configuré. Ajoutez les variables dans votre fichier .env
      </p>
    </div>
  );
};

export const SettingsView = () => {
  const { tracks, scanning, scanProgress, scanLibrary, selectMusicFolders } = useLibrary();
  const { videos, scanning: scanningVideos, scanProgress: videoScanProgress, scanVideos, selectVideoFolders } = useVideos();
  const { theme, setTheme } = useTheme();
  const { enabled: notificationsEnabled, setEnabled: setNotificationsEnabled, notifySuccess, notifyError } = useNotifications();
  const {
    firebaseInitialized,
    stripeInitialized,
    cloudinaryConfigured,
    cloudinaryConfig,
    saveCloudinaryConfig,
    clearCloudinaryConfig,
    nexusUser,
    nexusAuthenticated,
    nexusIsPro,
    nexusLoginWithGoogle,
    nexusLogout,
    nexusUpgradeToPro,
    nexusManageBilling,
    overallProgress,
    isUploading,
    syncStatus,
    startSync,
    syncLoading,
  } = useCloudSync();

  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [settings, setSettings] = useState<Partial<Settings>>({
    musicDirectories: [],
    crossfadeDuration: 5,
    gaplessPlayback: true,
    normalizeVolume: true,
    audioQuality: "high",
    notificationsEnabled: true,
    scrobblingEnabled: false,
    equalizerEnabled: false,
    theme: "dark",
    showLyrics: true,
    autoScanOnStartup: true,
  });
  const [scrobblerStatus, setScrobblerStatus] = useState({
    lastFm: { connected: false, username: undefined as string | undefined },
    libreFm: { connected: false, username: undefined as string | undefined },
  });
  const [loading, setLoading] = useState(true);
  const [showCloudinaryKey, setShowCloudinaryKey] = useState(false);
  const [cloudinaryForm, setCloudinaryForm] = useState({
    cloudName: "",
    apiKey: "",
    uploadPreset: "",
  });
  const [savingCloudinary, setSavingCloudinary] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const isElectron = !!window.electronAPI;

  // Load settings from backend
  useEffect(() => {
    const loadSettings = async () => {
      if (isElectron) {
        try {
          const [loadedSettings, status] = await Promise.all([
            window.electronAPI!.getSettings(),
            window.electronAPI!.getScrobblerStatus?.() || Promise.resolve({ lastFm: { connected: false, username: undefined }, libreFm: { connected: false, username: undefined } }),
          ]);
          setSettings(loadedSettings);
          setScrobblerStatus({
            lastFm: { connected: status.lastFm.connected, username: 'username' in status.lastFm ? status.lastFm.username : undefined },
            libreFm: { connected: status.libreFm.connected, username: 'username' in status.libreFm ? status.libreFm.username : undefined },
          });
        } catch (err) {
          console.error("Failed to load settings:", err);
        }
      }
      
      // Load cloudinary config
      if (cloudinaryConfig) {
        setCloudinaryForm({
          cloudName: cloudinaryConfig.cloudName || "",
          apiKey: cloudinaryConfig.apiKey || "",
          uploadPreset: cloudinaryConfig.uploadPreset || "",
        });
      }
      
      setLoading(false);
    };
    loadSettings();
  }, [isElectron, cloudinaryConfig]);

  // Load subscription status
  useEffect(() => {
    const loadSubscriptionStatus = async () => {
      if (nexusAuthenticated && stripeInitialized) {
        setSubscriptionLoading(true);
        try {
          const status = await stripeService.getSubscriptionStatus();
          setSubscriptionStatus(status);
        } catch (error) {
          console.error("Error loading subscription status:", error);
        } finally {
          setSubscriptionLoading(false);
        }
      }
    };
    loadSubscriptionStatus();
  }, [nexusAuthenticated, stripeInitialized]);

  // Handle URL params for Stripe success/cancel
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get("success");
    const canceled = urlParams.get("canceled");

    if (success === "true") {
      toast.success("Paiement réussi !", {
        description: "Bienvenue dans le plan Pro !",
      });
      // Reload subscription status
      if (nexusAuthenticated && stripeInitialized) {
        stripeService.getSubscriptionStatus().then(setSubscriptionStatus);
      }
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (canceled === "true") {
      toast.info("Paiement annulé");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const updateSetting = async <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    if (isElectron) {
      await window.electronAPI!.updateSettings({ [key]: value });
    }
    localStorage.setItem(`nexus-setting-${key}`, JSON.stringify(value));
  };

  const handleAddMusicFolder = async () => {
    const folders = await selectMusicFolders();
    if (folders.length > 0) {
      const newDirs = [...(settings.musicDirectories || []), ...folders];
      await updateSetting("musicDirectories", newDirs);
      notifySuccess(`${folders.length} dossier(s) ajouté(s)`);
      // Déclencher le scan automatique
      await scanLibrary(newDirs);
    }
  };

  const handleAddVideoFolder = async () => {
    const folders = await selectVideoFolders();
    if (folders.length > 0) {
      const newDirs = [...(settings.videoDirectories || []), ...folders];
      await updateSetting("videoDirectories", newDirs);
      notifySuccess(`${folders.length} dossier(s) vidéo ajouté(s)`);
      // Déclencher le scan automatique
      await scanVideos(newDirs);
    }
  };

  const handleRemoveVideoFolder = async (folder: string) => {
    const newDirs = (settings.videoDirectories || []).filter((d) => d !== folder);
    await updateSetting("videoDirectories", newDirs);
    notifySuccess("Dossier vidéo retiré");
  };

  const handleScanVideos = async () => {
    await scanVideos(settings.videoDirectories);
  };

  const handleRemoveMusicFolder = async (folder: string) => {
    const newDirs = (settings.musicDirectories || []).filter((d) => d !== folder);
    await updateSetting("musicDirectories", newDirs);
    notifySuccess("Dossier retiré");
  };

  const handleScanLibrary = async () => {
    await scanLibrary(settings.musicDirectories);
  };

  const handleConnectLastFm = async () => {
    if (isElectron && window.electronAPI?.authenticateLastFm) {
      try {
        await window.electronAPI.authenticateLastFm();
        notifySuccess("Connecté à Last.fm");
      } catch (err) {
        notifyError("Échec de connexion à Last.fm");
      }
    }
  };

  const handleConnectLibreFm = async () => {
    if (isElectron && window.electronAPI?.authenticateLibreFm) {
      try {
        await window.electronAPI.authenticateLibreFm();
        notifySuccess("Connecté à Libre.fm");
      } catch (err) {
        notifyError("Échec de connexion à Libre.fm");
      }
    }
  };

  const handleDisconnectScrobbler = async (service: "lastfm" | "librefm") => {
    if (isElectron && window.electronAPI?.disconnectScrobbler) {
      await window.electronAPI.disconnectScrobbler(service);
      setScrobblerStatus((prev) => ({
        ...prev,
        [service === "lastfm" ? "lastFm" : "libreFm"]: {
          connected: false,
          username: undefined,
        },
      }));
      notifySuccess(`Déconnecté de ${service === "lastfm" ? "Last.fm" : "Libre.fm"}`);
    }
  };

  // Save Cloudinary config
  const handleSaveCloudinary = async () => {
    if (!cloudinaryForm.cloudName || !cloudinaryForm.uploadPreset) {
      notifyError("Cloud Name et Upload Preset sont requis");
      return;
    }
    
    setSavingCloudinary(true);
    try {
      saveCloudinaryConfig({
        cloudName: cloudinaryForm.cloudName,
        apiKey: cloudinaryForm.apiKey,
        uploadPreset: cloudinaryForm.uploadPreset,
      });
      notifySuccess("Configuration Cloudinary sauvegardée");
    } catch (err) {
      notifyError("Erreur lors de la sauvegarde");
    } finally {
      setSavingCloudinary(false);
    }
  };

  // Clear Cloudinary config
  const handleClearCloudinary = () => {
    clearCloudinaryConfig();
    setCloudinaryForm({ cloudName: "", apiKey: "", uploadPreset: "" });
    notifySuccess("Configuration Cloudinary supprimée");
  };

  // Google Sign In
  const handleGoogleSignIn = async () => {
    // Check if Google OAuth Client ID is configured
    const clientId = await authService.getGoogleClientId();
    if (!clientId) {
      toast.error("Google OAuth non configuré", {
        description: "Configurez le Client ID OAuth dans les paramètres ou ajoutez GOOGLE_CLIENT_ID dans les variables d'environnement serveur",
      });
      return;
    }

    setAuthLoading(true);
    try {
      await nexusLoginWithGoogle();
    } catch (err) {
      // Error already handled in hook
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    setAuthLoading(true);
    try {
      await nexusLogout();
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle upgrade to pro
  const handleUpgradeToPro = async () => {
    if (!stripeInitialized) {
      toast.error("Stripe non configuré", {
        description: "Ajoutez NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY dans .env",
      });
      return;
    }
    await nexusUpgradeToPro();
  };

  // Handle manage billing
  const handleManageBilling = async () => {
    if (!stripeInitialized) {
      toast.error("Stripe non configuré");
      return;
    }
    if (!nexusAuthenticated) {
      toast.error("Connectez-vous d'abord");
      return;
    }
    try {
      setSubscriptionLoading(true);
      await nexusManageBilling();
    } catch (error: unknown) {
      console.error("Manage billing error:", error);
      const err = error as { message?: string };
      const errorMessage = err.message || "Erreur lors de l'accès au portail de facturation";
      
      // Check if it's a portal configuration error
      if (errorMessage.includes("Billing Portal") || errorMessage.includes("portal")) {
        toast.error("Portail non configuré", { 
          description: "Le portail de facturation Stripe n'est pas configuré. Si vous avez un abonnement Pro activé manuellement, contactez le support." 
        });
      } else {
        toast.error("Erreur", { description: errorMessage });
      }
    } finally {
      setSubscriptionLoading(false);
    }
  };

  // Handle upgrade to monthly
  const handleUpgradeMonthly = async () => {
    if (!stripeInitialized) {
      toast.error("Stripe non configuré");
      return;
    }
    if (!nexusAuthenticated) {
      toast.error("Connectez-vous d'abord");
      return;
    }
    try {
      setSubscriptionLoading(true);
      toast.info("Redirection vers Stripe...");
      await stripeService.redirectToCheckout(PRICE_IDS.PRO_MONTHLY);
    } catch (error: any) {
      console.error("Upgrade error:", error);
      toast.error("Erreur", { description: error.message });
    } finally {
      setSubscriptionLoading(false);
    }
  };

  // Handle upgrade to yearly
  const handleUpgradeYearly = async () => {
    if (!stripeInitialized) {
      toast.error("Stripe non configuré");
      return;
    }
    if (!nexusAuthenticated) {
      toast.error("Connectez-vous d'abord");
      return;
    }
    try {
      setSubscriptionLoading(true);
      toast.info("Redirection vers Stripe...");
      await stripeService.redirectToCheckout(PRICE_IDS.PRO_YEARLY);
    } catch (error: any) {
      console.error("Upgrade error:", error);
      toast.error("Erreur", { description: error.message });
    } finally {
      setSubscriptionLoading(false);
    }
  };

  // Handle sync
  const handleStartSync = async () => {
    await startSync();
  };

  // Theme change handler
  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme as any);
    notifySuccess(`Thème ${newTheme} appliqué`);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden flex flex-col animate-in fade-in duration-300">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/50 border-b border-border/30">
        <div className="px-6 pt-6 pb-4">
          <h1 className="font-display text-2xl font-bold text-foreground">Paramètres</h1>
          <p className="text-sm text-muted-foreground mt-1">Personnalisez votre expérience NEXUS</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="audio" className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6">
          <TabsList className="bg-muted/30 p-1 h-auto">
            <TabsTrigger value="audio" className="gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Volume2 className="w-4 h-4" />
              Audio
            </TabsTrigger>
            <TabsTrigger value="library" className="gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Music className="w-4 h-4" />
              Bibliothèque
            </TabsTrigger>
            <TabsTrigger value="appearance" className="gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Palette className="w-4 h-4" />
              Affichage
            </TabsTrigger>
            <TabsTrigger value="cloud" className="gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Cloud className="w-4 h-4" />
              Cloud
            </TabsTrigger>
            <TabsTrigger value="subscription" className="gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Crown className="w-4 h-4" />
              Abonnements
            </TabsTrigger>
            <TabsTrigger value="account" className="gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <User className="w-4 h-4" />
              Compte
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {/* Audio Tab */}
          <TabsContent value="audio" className="mt-6 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SettingsCard title="Lecture" icon={Volume2}>
                <SettingRow label="Crossfade" description="Transition fluide entre les pistes">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={settings.crossfadeEnabled}
                      onCheckedChange={(v) => updateSetting("crossfadeEnabled", v)}
                    />
                    {settings.crossfadeEnabled && (
                      <>
                        <Slider
                          value={[settings.crossfadeDuration || 3]}
                          max={12}
                          step={1}
                          onValueChange={(v) => updateSetting("crossfadeDuration", v[0])}
                          className="w-20"
                        />
                        <span className="text-xs text-muted-foreground w-6">{settings.crossfadeDuration}s</span>
                      </>
                    )}
                  </div>
                </SettingRow>
                <SettingRow label="Lecture sans interruption" description="Supprime les silences entre les pistes">
                  <Switch checked={settings.gaplessPlayback} onCheckedChange={(v) => updateSetting("gaplessPlayback", v)} />
                </SettingRow>
                <SettingRow label="Normalisation" description="Égalise le volume des pistes">
                  <Switch checked={settings.normalizeVolume} onCheckedChange={(v) => updateSetting("normalizeVolume", v)} />
                </SettingRow>
                <SettingRow label="Égaliseur" description="Ajustez les fréquences">
                  <Switch checked={settings.equalizerEnabled} onCheckedChange={(v) => updateSetting("equalizerEnabled", v)} />
                </SettingRow>
              </SettingsCard>

              <SettingsCard title="Paroles" icon={Mic2}>
                <SettingRow label="Afficher les paroles" description="Récupère depuis LRCLIB">
                  <Switch checked={settings.showLyrics} onCheckedChange={(v) => updateSetting("showLyrics", v)} />
                </SettingRow>
                <SettingRow label="Paroles synchronisées" description="Défilement automatique">
                  <Switch checked={settings.showLyrics} disabled />
                  <span className="text-xs text-muted-foreground ml-2">Toujours activé</span>
                </SettingRow>
              </SettingsCard>

              <SettingsCard title="Scrobbling" icon={Sparkles} className="lg:col-span-2">
                <SettingRow label="Activer le scrobbling" description="Envoie vos écoutes à Last.fm/Libre.fm">
                  <Switch checked={settings.scrobblingEnabled} onCheckedChange={(v) => updateSetting("scrobblingEnabled", v)} disabled={!isElectron} />
                </SettingRow>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {/* Last.fm */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                        <span className="text-sm font-bold text-red-500">LF</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Last.fm</p>
                        {scrobblerStatus.lastFm.connected ? (
                          <p className="text-xs text-green-500 flex items-center gap-1">
                            <Check className="w-3 h-3" /> {scrobblerStatus.lastFm.username}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">Non connecté</p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant={scrobblerStatus.lastFm.connected ? "outline" : "default"}
                      size="sm"
                      onClick={scrobblerStatus.lastFm.connected ? () => handleDisconnectScrobbler("lastfm") : handleConnectLastFm}
                      disabled={!isElectron}
                    >
                      {scrobblerStatus.lastFm.connected ? "Déconnecter" : "Connecter"}
                    </Button>
                  </div>

                  {/* Libre.fm */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                        <span className="text-sm font-bold text-green-500">LB</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Libre.fm</p>
                        {scrobblerStatus.libreFm.connected ? (
                          <p className="text-xs text-green-500 flex items-center gap-1">
                            <Check className="w-3 h-3" /> {scrobblerStatus.libreFm.username}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">Non connecté</p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant={scrobblerStatus.libreFm.connected ? "outline" : "default"}
                      size="sm"
                      onClick={scrobblerStatus.libreFm.connected ? () => handleDisconnectScrobbler("librefm") : handleConnectLibreFm}
                      disabled={!isElectron}
                    >
                      {scrobblerStatus.libreFm.connected ? "Déconnecter" : "Connecter"}
                    </Button>
                  </div>
                </div>
              </SettingsCard>
            </div>
          </TabsContent>

          {/* Library Tab */}
          <TabsContent value="library" className="mt-6 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SettingsCard title="Dossiers de musique" icon={FolderOpen} className="lg:col-span-2">
                <div className="space-y-3">
                  {(settings.musicDirectories || []).length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">Aucun dossier configuré</p>
                      <p className="text-xs mt-1">Ajoutez des dossiers pour scanner votre musique</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {(settings.musicDirectories || []).map((folder) => (
                        <div key={folder} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 group">
                          <div className="flex items-center gap-2 overflow-hidden flex-1">
                            <FolderOpen className="w-4 h-4 text-primary flex-shrink-0" />
                            <span className="text-sm truncate">{folder}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleRemoveMusicFolder(folder)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-3 pt-2">
                    <Button variant="outline" size="sm" onClick={handleAddMusicFolder} disabled={!isElectron}>
                      <Plus className="w-4 h-4 mr-2" />
                      Ajouter un dossier
                    </Button>
                    <Button variant="default" size="sm" onClick={handleScanLibrary} disabled={scanning || (settings.musicDirectories || []).length === 0}>
                      <RefreshCw className={cn("w-4 h-4 mr-2", scanning && "animate-spin")} />
                      {scanning ? "Scan en cours..." : "Scanner"}
                    </Button>
                  </div>
                </div>

                {/* Scan progress */}
                {scanning && scanProgress && (
                  <div className="mt-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-muted-foreground">
                        {scanProgress.phase === "scanning" ? "Recherche..." : scanProgress.phase === "extracting" ? "Extraction..." : "Terminé"}
                      </span>
                      <span className="text-primary font-mono">{scanProgress.current} / {scanProgress.total}</span>
                    </div>
                    <Progress value={scanProgress.total > 0 ? (scanProgress.current / scanProgress.total) * 100 : 0} className="h-1.5" />
                    {scanProgress.file && <p className="text-xs text-muted-foreground truncate mt-2">{scanProgress.file}</p>}
                  </div>
                )}
              </SettingsCard>

              <SettingsCard title="Statistiques" icon={HardDrive}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Pistes</span>
                    <span className="text-sm font-mono text-foreground">{tracks.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Albums</span>
                    <span className="text-sm font-mono text-foreground">{new Set(tracks.map(t => t.album)).size}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Artistes</span>
                    <span className="text-sm font-mono text-foreground">{new Set(tracks.map(t => t.artist)).size}</span>
                  </div>
                </div>
              </SettingsCard>

              <SettingsCard title="Options" icon={Music}>
                <SettingRow label="Scanner au démarrage" description="Recherche automatique des nouveaux fichiers">
                  <Switch checked={settings.autoScanOnStartup} onCheckedChange={(v) => updateSetting("autoScanOnStartup", v)} />
                </SettingRow>
                <SettingRow label="Surveiller les dossiers" description="Détection en temps réel">
                  <Switch checked={false} disabled />
                  <span className="text-xs text-muted-foreground ml-2">Bientôt disponible</span>
                </SettingRow>
              </SettingsCard>
            </div>
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance" className="mt-6 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SettingsCard title="Thème" icon={Palette}>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    { id: "dark", label: "Sombre", color: "bg-gradient-to-br from-zinc-900 to-zinc-950", border: "border-cyan-500" },
                    { id: "light", label: "Clair", color: "bg-gradient-to-br from-zinc-50 to-zinc-100", border: "border-blue-500" },
                    { id: "cyberpunk", label: "Cyberpunk", color: "bg-gradient-to-br from-purple-900 via-yellow-600 to-purple-800", border: "border-yellow-500" },
                    { id: "minimal", label: "Minimal", color: "bg-gradient-to-br from-zinc-900 to-black", border: "border-white" },
                    { id: "spotify", label: "Spotify", color: "bg-gradient-to-br from-[#121212] via-[#1DB954] to-[#191414]", border: "border-[#1DB954]" },
                    { id: "apple-music", label: "Apple Music", color: "bg-gradient-to-br from-[#1a0f0f] via-[#FC3C44] to-[#2a1515]", border: "border-[#FC3C44]" },
                    { id: "youtube-music", label: "YouTube Music", color: "bg-gradient-to-br from-[#121212] via-[#FF0000] to-[#1a0a0a]", border: "border-[#FF0000]" },
                    { id: "tidal", label: "Tidal", color: "bg-gradient-to-br from-[#0a1a1f] via-[#00FFFF] to-[#0f1f2a]", border: "border-[#00FFFF]" },
                    { id: "deezer", label: "Deezer", color: "bg-gradient-to-br from-[#00C7F2] via-[#FF0090] to-[#0a1a1f]", border: "border-[#00C7F2]" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleThemeChange(t.id)}
                      className={cn(
                        "p-4 rounded-xl border-2 transition-all duration-200",
                        theme === t.id
                          ? `${t.border} bg-primary/10`
                          : "border-transparent bg-muted/30 hover:bg-muted/50"
                      )}
                    >
                      <div className={cn("w-full h-8 rounded-lg mb-2", t.color)} />
                      <span className="text-sm font-medium">{t.label}</span>
                      {theme === t.id && (
                        <Check className="w-4 h-4 text-primary inline ml-2" />
                      )}
                    </button>
                  ))}
                </div>
              </SettingsCard>

              <SettingsCard title="Notifications" icon={Bell}>
                <SettingRow label="Notifications de bureau" description="Affiche le titre en cours">
                  <Switch 
                    checked={notificationsEnabled} 
                    onCheckedChange={(v) => {
                      setNotificationsEnabled(v);
                      if (v) notifySuccess("Notifications activées");
                    }} 
                  />
                </SettingRow>
                <SettingRow label="Son de notification" description="Joue un son">
                  <Switch checked={false} disabled />
                  <span className="text-xs text-muted-foreground ml-2">Bientôt disponible</span>
                </SettingRow>
              </SettingsCard>

              <SettingsCard title="Raccourcis clavier" icon={Keyboard} className="lg:col-span-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                  {[
                    { action: "Lecture/Pause", shortcut: "Espace" },
                    { action: "Titre suivant", shortcut: "Ctrl + →" },
                    { action: "Titre précédent", shortcut: "Ctrl + ←" },
                    { action: "Volume +", shortcut: "Ctrl + ↑" },
                    { action: "Volume -", shortcut: "Ctrl + ↓" },
                    { action: "Muet", shortcut: "Ctrl + M" },
                    { action: "Plein écran", shortcut: "F11" },
                    { action: "Fermer", shortcut: "Échap" },
                  ].map(({ action, shortcut }) => (
                    <SettingRow key={action} label={action}>
                      <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono text-muted-foreground">{shortcut}</kbd>
                    </SettingRow>
                  ))}
                </div>
              </SettingsCard>
            </div>
          </TabsContent>

          {/* Cloud Tab */}
          <TabsContent value="cloud" className="mt-6 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Cloudinary */}
              <SettingsCard title="Cloudinary" icon={Cloud}>
                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <p className="text-sm text-blue-400 flex items-center gap-2">
                      <Info className="w-4 h-4" />
                      Gratuit - 25 Go de stockage
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Configurez vos propres credentials Cloudinary
                    </p>
                  </div>
                  
                  {cloudinaryConfigured ? (
                    <div className="space-y-3">
                      <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                        <p className="text-sm text-green-400 flex items-center gap-2">
                          <Check className="w-4 h-4" />
                          Configuré: {cloudinaryConfig?.cloudName}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" className="w-full" onClick={handleClearCloudinary}>
                        <X className="w-4 h-4 mr-2" />
                        Supprimer la configuration
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs">Cloud Name *</Label>
                        <Input
                          value={cloudinaryForm.cloudName}
                          onChange={(e) => setCloudinaryForm(prev => ({ ...prev, cloudName: e.target.value }))}
                          placeholder="votre-cloud-name"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">API Key (optionnel)</Label>
                        <div className="relative mt-1">
                          <Input
                            type={showCloudinaryKey ? "text" : "password"}
                            value={cloudinaryForm.apiKey}
                            onChange={(e) => setCloudinaryForm(prev => ({ ...prev, apiKey: e.target.value }))}
                            placeholder="••••••••••••"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCloudinaryKey(!showCloudinaryKey)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showCloudinaryKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Upload Preset (unsigned) *</Label>
                        <Input
                          value={cloudinaryForm.uploadPreset}
                          onChange={(e) => setCloudinaryForm(prev => ({ ...prev, uploadPreset: e.target.value }))}
                          placeholder="preset-name"
                          className="mt-1"
                        />
                      </div>
                      <Button 
                        variant="default" 
                        size="sm" 
                        className="w-full" 
                        onClick={handleSaveCloudinary}
                        disabled={savingCloudinary || !cloudinaryForm.cloudName || !cloudinaryForm.uploadPreset}
                      >
                        {savingCloudinary ? (
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4 mr-2" />
                        )}
                        Sauvegarder
                      </Button>
                    </div>
                  )}
                </div>
              </SettingsCard>

              {/* Bunny Storage - Pro Only */}
              <SettingsCard title="Bunny Storage" icon={Zap}>
                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20">
                    <p className="text-sm text-yellow-400 flex items-center gap-2">
                      <Crown className="w-4 h-4" />
                      Exclusif aux utilisateurs Pro
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      CDN ultra-rapide avec stockage illimité
                    </p>
                  </div>

                  {nexusIsPro ? (
                    <div className="space-y-3">
                      <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                        <p className="text-sm text-green-400 flex items-center gap-2">
                          <Check className="w-4 h-4" />
                          Bunny Storage activé
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Vos uploads utilisent automatiquement Bunny CDN
                        </p>
                      </div>
                      
                      <div className="space-y-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Check className="w-3 h-3 text-green-500" />
                          Upload jusqu'à 500MB par fichier
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="w-3 h-3 text-green-500" />
                          CDN mondial pour lecture ultra-rapide
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="w-3 h-3 text-green-500" />
                          Stockage illimité
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="w-3 h-3 text-green-500" />
                          Streaming optimisé audio/vidéo
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                        <p className="text-sm text-muted-foreground">
                          Passez au plan Pro pour accéder à Bunny Storage
                        </p>
                      </div>
                      <Button 
                        variant="default" 
                        size="sm" 
                        className="w-full" 
                        onClick={handleUpgradeToPro}
                        disabled={!stripeInitialized || !nexusAuthenticated}
                      >
                        <Crown className="w-4 h-4 mr-2" />
                        Passer au Pro
                      </Button>
                    </div>
                  )}
                </div>
              </SettingsCard>

              {/* Nexus Server with Firebase Auth */}
              <SettingsCard title="Serveur NEXUS" icon={Shield}>
                <ConfigAlert configured={!!authService.getGoogleClientIdSync()} service="Google OAuth" />
                
                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20">
                    <p className="text-sm text-primary flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Stockage illimité à vie
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Disponible avec le plan Pro
                    </p>
                  </div>

                  {nexusAuthenticated && nexusUser ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center overflow-hidden">
                          {nexusUser.photoURL ? (
                            <img src={nexusUser.photoURL} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-6 h-6 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{nexusUser.displayName}</p>
                          <p className="text-xs text-muted-foreground">{nexusUser.email}</p>
                          <span className={cn(
                            "inline-block px-2 py-0.5 rounded text-xs mt-1",
                            nexusIsPro ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                          )}>
                            {nexusIsPro ? "Pro" : "Gratuit"}
                          </span>
                        </div>
                      </div>

                      {nexusIsPro ? (
                        <Button variant="outline" size="sm" className="w-full" onClick={handleManageBilling} disabled={!stripeInitialized}>
                          <CreditCard className="w-4 h-4 mr-2" />
                          Gérer l'abonnement
                        </Button>
                      ) : (
                        <Button variant="default" size="sm" className="w-full" onClick={handleUpgradeToPro} disabled={!stripeInitialized}>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Passer au Pro - €9.99/mois
                        </Button>
                      )}

                      <Button variant="ghost" size="sm" className="w-full text-destructive" onClick={handleLogout} disabled={authLoading}>
                        {authLoading ? (
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <LogOut className="w-4 h-4 mr-2" />
                        )}
                        Se déconnecter
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="text-center py-4">
                        <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-3">
                          <User className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">Connectez-vous pour synchroniser</p>
                        
                        <Button 
                          variant="default" 
                          size="sm" 
                          className="w-full gap-2"
                          onClick={handleGoogleSignIn}
                          disabled={authLoading || !authService.getGoogleClientIdSync()}
                        >
                          {authLoading ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <svg className="w-4 h-4" viewBox="0 0 24 24">
                              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                          )}
                          Continuer avec Google
                        </Button>
                      </div>

                      <div className="border-t border-border/30 pt-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Plan Pro</span>
                          <span className="text-xs text-primary">€9.99/mois</span>
                        </div>
                        <ul className="space-y-1.5 text-xs text-muted-foreground">
                          <li className="flex items-center gap-2"><Check className="w-3 h-3 text-green-500" /> Stockage illimité</li>
                          <li className="flex items-center gap-2"><Check className="w-3 h-3 text-green-500" /> Sync multi-appareils</li>
                          <li className="flex items-center gap-2"><Check className="w-3 h-3 text-green-500" /> Support prioritaire</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </SettingsCard>

              {/* Sync Status */}
              <SettingsCard title="Synchronisation" icon={RefreshCw} className="lg:col-span-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="p-4 rounded-lg bg-muted/30 text-center">
                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-2xl font-bold font-mono">{syncStatus.tracksUploaded}</p>
                    <p className="text-xs text-muted-foreground">Fichiers uploadés</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30 text-center">
                    <Download className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-2xl font-bold font-mono">{syncStatus.tracksDownloaded}</p>
                    <p className="text-xs text-muted-foreground">Fichiers téléchargés</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30 text-center">
                    <HardDrive className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-2xl font-bold font-mono">
                      {nexusUser ? `${Math.round(nexusUser.storageUsed / (1024 * 1024))} Mo` : "0 Mo"}
                    </p>
                    <p className="text-xs text-muted-foreground">Espace utilisé</p>
                  </div>
                </div>

                {isUploading && (
                  <div className="mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Upload en cours...</span>
                      <span className="text-primary font-mono">{overallProgress}%</span>
                    </div>
                    <Progress value={overallProgress} className="h-1.5" />
                  </div>
                )}

                <div className="flex gap-3">
                  <Button 
                    variant="default" 
                    size="sm" 
                    onClick={handleStartSync}
                    disabled={(!nexusAuthenticated && !cloudinaryConfigured) || syncLoading}
                  >
                    <RefreshCw className={cn("w-4 h-4 mr-2", syncLoading && "animate-spin")} />
                    {syncLoading ? "Synchronisation..." : "Synchroniser maintenant"}
                  </Button>
                  {syncStatus.lastSyncAt && (
                    <p className="text-xs text-muted-foreground self-center">
                      Dernière sync: {new Date(syncStatus.lastSyncAt).toLocaleString()}
                    </p>
                  )}
                </div>
              </SettingsCard>
            </div>
          </TabsContent>

          {/* Subscription Tab */}
          <TabsContent value="subscription" className="mt-6 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SettingsCard title="Plan actuel" icon={Crown}>
                {subscriptionLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : subscriptionStatus ? (
                  <div className="space-y-4">
                    <div className="text-center py-4">
                      <div className={cn(
                        "inline-block px-4 py-2 rounded-lg text-sm font-medium mb-3",
                        subscriptionStatus.isActive && subscriptionStatus.plan === "pro"
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}>
                        {subscriptionStatus.isActive && subscriptionStatus.plan === "pro" ? "Plan Pro" : "Plan Gratuit"}
                      </div>
                      {subscriptionStatus.isActive && subscriptionStatus.currentPeriodEnd && (
                        <div className="mt-4 space-y-2">
                          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4" />
                            <span>
                              Prochain renouvellement: {new Date(subscriptionStatus.currentPeriodEnd).toLocaleDateString("fr-FR")}
                            </span>
                          </div>
                          {subscriptionStatus.cancelAtPeriodEnd && (
                            <div className="flex items-center justify-center gap-2 text-sm text-yellow-500">
                              <AlertCircle className="w-4 h-4" />
                              <span>Annulation programmée à la fin de la période</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {subscriptionStatus.isActive && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={handleManageBilling}
                        disabled={subscriptionLoading}
                      >
                        <CreditCard className="w-4 h-4 mr-2" />
                        Gérer l'abonnement
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-sm text-muted-foreground">
                      {nexusAuthenticated
                        ? "Chargement du statut d'abonnement..."
                        : "Connectez-vous pour voir votre abonnement"}
                    </p>
                  </div>
                )}
              </SettingsCard>

              <SettingsCard title="Passer au Pro" icon={Sparkles}>
                {!nexusAuthenticated ? (
                  <div className="text-center py-6">
                    <p className="text-sm text-muted-foreground mb-4">
                      Connectez-vous pour accéder aux plans Pro
                    </p>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleGoogleSignIn}
                      disabled={authLoading}
                    >
                      Se connecter
                    </Button>
                  </div>
                ) : !stripeInitialized ? (
                  <div className="text-center py-6">
                    <ConfigAlert configured={false} service="Stripe" />
                    <p className="text-sm text-muted-foreground">
                      Stripe n'est pas configuré
                    </p>
                  </div>
                ) : !API_BASE_URL || API_BASE_URL === "" ? (
                  <div className="text-center py-6">
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 mb-4">
                      <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                      <p className="text-xs text-yellow-500">
                        Backend API non configuré. Ajoutez NEXT_PUBLIC_API_URL dans .env pour activer les abonnements.
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Les fonctionnalités d'abonnement nécessitent un backend API configuré.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <div className="p-4 rounded-lg border border-border/50 bg-card/50">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h4 className="font-medium">Plan Mensuel</h4>
                            <p className="text-xs text-muted-foreground">Facturé chaque mois</p>
                          </div>
                          <Crown className="w-5 h-5 text-primary" />
                        </div>
                        <div className="mt-3">
                          <Button
                            variant={subscriptionStatus?.plan === "pro" ? "outline" : "default"}
                            size="sm"
                            className="w-full"
                            onClick={handleUpgradeMonthly}
                            disabled={subscriptionLoading || (subscriptionStatus?.plan === "pro" && !subscriptionStatus?.cancelAtPeriodEnd)}
                          >
                            {subscriptionStatus?.plan === "pro" && !subscriptionStatus?.cancelAtPeriodEnd
                              ? "Plan actuel"
                              : "Choisir ce plan"}
                          </Button>
                        </div>
                      </div>

                      <div className="p-4 rounded-lg border-2 border-primary/50 bg-primary/5">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h4 className="font-medium">Plan Annuel</h4>
                            <p className="text-xs text-muted-foreground">Facturé chaque année</p>
                            <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-primary/20 text-primary rounded">
                              Économisez 20%
                            </span>
                          </div>
                          <Crown className="w-5 h-5 text-primary" />
                        </div>
                        <div className="mt-3">
                          <Button
                            variant={subscriptionStatus?.plan === "pro" ? "outline" : "default"}
                            size="sm"
                            className="w-full"
                            onClick={handleUpgradeYearly}
                            disabled={subscriptionLoading || (subscriptionStatus?.plan === "pro" && !subscriptionStatus?.cancelAtPeriodEnd)}
                          >
                            {subscriptionStatus?.plan === "pro" && !subscriptionStatus?.cancelAtPeriodEnd
                              ? "Plan actuel"
                              : "Choisir ce plan"}
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-border/30">
                      <h5 className="text-sm font-medium mb-2">Avantages du Plan Pro :</h5>
                      <ul className="space-y-1.5 text-xs text-muted-foreground">
                        <li className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-primary" />
                          Stockage cloud illimité
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-primary" />
                          Synchronisation automatique
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-primary" />
                          Support prioritaire
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-primary" />
                          Accès aux fonctionnalités avancées
                        </li>
                      </ul>
                    </div>
                  </div>
                )}
              </SettingsCard>
            </div>
          </TabsContent>

          {/* Account Tab */}
          <TabsContent value="account" className="mt-6 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SettingsCard title="Profil" icon={User}>
                {nexusAuthenticated && nexusUser ? (
                  <div className="space-y-4">
                    <div className="text-center py-4">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mx-auto mb-4 overflow-hidden">
                        {nexusUser.photoURL ? (
                          <img src={nexusUser.photoURL} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-10 h-10 text-muted-foreground" />
                        )}
                      </div>
                      <p className="text-lg font-medium">{nexusUser.displayName}</p>
                      <p className="text-sm text-muted-foreground">{nexusUser.email}</p>
                      <div className="mt-2">
                        <span className={cn(
                          "inline-block px-3 py-1 rounded-full text-sm",
                          nexusIsPro ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                        )}>
                          {nexusIsPro ? "Plan Pro" : "Plan Gratuit"}
                        </span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="w-full" onClick={handleLogout} disabled={authLoading}>
                      {authLoading ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <LogOut className="w-4 h-4 mr-2" />
                      )}
                      Se déconnecter
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mx-auto mb-4">
                      <User className="w-10 h-10 text-muted-foreground" />
                    </div>
                    <p className="text-lg font-medium">Utilisateur local</p>
                    <p className="text-sm text-muted-foreground">Mode hors ligne</p>
                    <Button 
                      variant="default" 
                      size="sm" 
                      className="mt-4 gap-2"
                      onClick={handleGoogleSignIn}
                      disabled={authLoading || !firebaseInitialized}
                    >
                      {authLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                          <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                      )}
                      Créer un compte
                    </Button>
                  </div>
                )}
              </SettingsCard>

              <SettingsCard title="À propos" icon={Info}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Version</span>
                    <span className="text-sm font-mono">1.0.0</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Build</span>
                    <span className="text-sm font-mono">2024.12.08</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Mode</span>
                    <span className="text-sm">{isElectron ? "Desktop" : "Web"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Firebase</span>
                    <span className={cn("text-sm", authService.getGoogleClientIdSync() ? "text-green-500" : "text-yellow-500")}>
                      {authService.getGoogleClientIdSync() ? "Configuré" : "Non configuré"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Stripe</span>
                    <span className={cn("text-sm", stripeInitialized ? "text-green-500" : "text-yellow-500")}>
                      {stripeInitialized ? "Connecté" : "Non configuré"}
                    </span>
                  </div>
                  <div className="pt-3 flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => notifySuccess("Vous êtes à jour !")}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Mises à jour
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => window.open("https://github.com/nexus-audio", "_blank")}>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      GitHub
                    </Button>
                  </div>
                </div>
              </SettingsCard>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};
