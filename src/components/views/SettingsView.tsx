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
  Download,
  Upload,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  LogOut,
  Chrome,
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
import { useCloudSync } from "@/hooks/useCloudSync";
import { useTheme } from "@/hooks/useTheme";
import { useNotifications } from "@/hooks/useNotifications";
import { toast } from "sonner";
import type { Settings } from "@/types/music";

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

export const SettingsView = () => {
  const { tracks, scanning, scanProgress, scanLibrary, selectMusicFolders } = useLibrary();
  const { theme, setTheme, themes } = useTheme();
  const { enabled: notificationsEnabled, setEnabled: setNotificationsEnabled, notifySuccess, notifyError } = useNotifications();
  const {
    cloudinaryConfigured,
    cloudinaryConfig,
    saveCloudinaryConfig,
    clearCloudinaryConfig,
    nexusUser,
    nexusAuthenticated,
    nexusIsPro,
    nexusLogin,
    nexusLogout,
    nexusUpgradeToPro,
    nexusManageBilling,
    overallProgress,
    isUploading,
    syncStatus,
    startSync,
  } = useCloudSync();

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
            window.electronAPI!.getScrobblerStatus?.() || Promise.resolve({ lastFm: { connected: false }, libreFm: { connected: false } }),
          ]);
          setSettings(loadedSettings);
          setScrobblerStatus(status);
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

  const updateSetting = async <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    if (isElectron) {
      await window.electronAPI!.updateSettings({ [key]: value });
    }
    // Update local storage as backup
    localStorage.setItem(`nexus-setting-${key}`, JSON.stringify(value));
  };

  const handleAddMusicFolder = async () => {
    const folders = await selectMusicFolders();
    if (folders.length > 0) {
      const newDirs = [...(settings.musicDirectories || []), ...folders];
      await updateSetting("musicDirectories", newDirs);
      notifySuccess(`${folders.length} dossier(s) ajouté(s)`);
    }
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
    setAuthLoading(true);
    try {
      // Demo mode - simulate Google OAuth
      // In production, you would:
      // 1. Set up Google OAuth credentials in Google Cloud Console
      // 2. Use Google Identity Services for web
      // 3. Use electron-oauth2 for Electron
      
      // Simulate authentication delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Create a mock Google user
      const mockCredential = btoa(JSON.stringify({
        email: "demo.user@gmail.com",
        name: "Demo User",
        picture: "https://ui-avatars.com/api/?name=Demo+User&background=4285F4&color=fff",
      }));
      
      await nexusLogin(mockCredential, "google");
      toast.success("Connecté avec Google", {
        description: "Mode démo - authentification simulée",
      });
    } catch (err) {
      console.error("Google sign in error:", err);
      notifyError("Erreur lors de la connexion Google");
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle logout
  const handleLogout = () => {
    nexusLogout();
    notifySuccess("Déconnecté");
  };

  // Handle upgrade to pro
  const handleUpgradeToPro = async () => {
    try {
      await nexusUpgradeToPro();
      notifySuccess("Redirection vers le paiement...");
    } catch (err) {
      notifyError("Erreur lors de la redirection");
    }
  };

  // Handle manage billing
  const handleManageBilling = async () => {
    try {
      await nexusManageBilling();
      notifySuccess("Ouverture du portail de facturation...");
    } catch (err) {
      notifyError("Erreur lors de l'ouverture du portail");
    }
  };

  // Handle sync
  const handleStartSync = async () => {
    try {
      await startSync();
      notifySuccess("Synchronisation démarrée");
    } catch (err) {
      notifyError("Erreur lors de la synchronisation");
    }
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
      <div className="px-6 pt-6 pb-4">
        <h1 className="font-display text-2xl font-bold text-foreground">Paramètres</h1>
        <p className="text-sm text-muted-foreground mt-1">Personnalisez votre expérience NEXUS</p>
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
                  <Switch checked={true} disabled />
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
                  <Switch checked={true} disabled />
                </SettingRow>
              </SettingsCard>
            </div>
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance" className="mt-6 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SettingsCard title="Thème" icon={Palette}>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: "dark", label: "Sombre", color: "bg-zinc-900", border: "border-cyan-500" },
                    { id: "light", label: "Clair", color: "bg-zinc-100", border: "border-blue-500" },
                    { id: "cyberpunk", label: "Cyberpunk", color: "bg-gradient-to-br from-purple-900 to-yellow-500", border: "border-yellow-500" },
                    { id: "minimal", label: "Minimal", color: "bg-zinc-800", border: "border-white" },
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

              {/* Nexus Server */}
              <SettingsCard title="Serveur NEXUS" icon={Shield}>
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
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                          {nexusUser.avatarUrl ? (
                            <img src={nexusUser.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                          ) : (
                            <User className="w-6 h-6 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{nexusUser.name}</p>
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
                        <Button variant="outline" size="sm" className="w-full" onClick={handleManageBilling}>
                          <CreditCard className="w-4 h-4 mr-2" />
                          Gérer l'abonnement
                        </Button>
                      ) : (
                        <Button variant="default" size="sm" className="w-full" onClick={handleUpgradeToPro}>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Passer au Pro - €9.99/mois
                        </Button>
                      )}

                      <Button variant="ghost" size="sm" className="w-full text-destructive" onClick={handleLogout}>
                        <LogOut className="w-4 h-4 mr-2" />
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
                          disabled={authLoading}
                        >
                          {authLoading ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Chrome className="w-4 h-4" />
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
                    disabled={!nexusAuthenticated && !cloudinaryConfigured}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Synchroniser maintenant
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

          {/* Account Tab */}
          <TabsContent value="account" className="mt-6 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SettingsCard title="Profil" icon={User}>
                {nexusAuthenticated && nexusUser ? (
                  <div className="space-y-4">
                    <div className="text-center py-4">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mx-auto mb-4 overflow-hidden">
                        {nexusUser.avatarUrl ? (
                          <img src={nexusUser.avatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-10 h-10 text-muted-foreground" />
                        )}
                      </div>
                      <p className="text-lg font-medium">{nexusUser.name}</p>
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
                    <Button variant="outline" size="sm" className="w-full" onClick={handleLogout}>
                      <LogOut className="w-4 h-4 mr-2" />
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
                      disabled={authLoading}
                    >
                      {authLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Chrome className="w-4 h-4" />
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
