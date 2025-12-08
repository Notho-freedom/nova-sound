import { useState, useEffect } from "react";
import {
  Volume2,
  Palette,
  Music,
  Bell,
  Keyboard,
  HardDrive,
  Monitor,
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
  const [cloudinaryConfig, setCloudinaryConfig] = useState({
    cloudName: "",
    apiKey: "",
    uploadPreset: "",
  });
  const isElectron = !!window.electronAPI;

  // Load settings from backend
  useEffect(() => {
    const loadSettings = async () => {
      if (isElectron) {
        try {
          const [loadedSettings, status] = await Promise.all([
            window.electronAPI!.getSettings(),
            window.electronAPI!.getScrobblerStatus(),
          ]);
          setSettings(loadedSettings);
          setScrobblerStatus(status);
        } catch (err) {
          console.error("Failed to load settings:", err);
        }
      }
      setLoading(false);
    };
    loadSettings();
  }, [isElectron]);

  const updateSetting = async <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    if (isElectron) {
      await window.electronAPI!.updateSettings({ [key]: value });
    }
  };

  const handleAddMusicFolder = async () => {
    const folders = await selectMusicFolders();
    if (folders.length > 0) {
      const newDirs = [...(settings.musicDirectories || []), ...folders];
      await updateSetting("musicDirectories", newDirs);
    }
  };

  const handleRemoveMusicFolder = async (folder: string) => {
    const newDirs = (settings.musicDirectories || []).filter((d) => d !== folder);
    await updateSetting("musicDirectories", newDirs);
  };

  const handleScanLibrary = async () => {
    await scanLibrary(settings.musicDirectories);
  };

  const handleConnectLastFm = async () => {
    if (isElectron) {
      await window.electronAPI!.authenticateLastFm();
    }
  };

  const handleConnectLibreFm = async () => {
    if (isElectron) {
      await window.electronAPI!.authenticateLibreFm();
    }
  };

  const handleDisconnectScrobbler = async (service: "lastfm" | "librefm") => {
    if (isElectron) {
      await window.electronAPI!.disconnectScrobbler(service);
      setScrobblerStatus((prev) => ({
        ...prev,
        [service === "lastfm" ? "lastFm" : "libreFm"]: {
          connected: false,
          username: undefined,
        },
      }));
    }
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
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: "dark", label: "Sombre", color: "bg-zinc-900" },
                    { id: "light", label: "Clair", color: "bg-zinc-100" },
                    { id: "system", label: "Système", color: "bg-gradient-to-r from-zinc-900 to-zinc-100" },
                  ].map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => updateSetting("theme", theme.id as any)}
                      className={cn(
                        "p-4 rounded-xl border-2 transition-all duration-200",
                        settings.theme === theme.id
                          ? "border-primary bg-primary/10"
                          : "border-transparent bg-muted/30 hover:bg-muted/50"
                      )}
                    >
                      <div className={cn("w-full h-8 rounded-lg mb-2", theme.color)} />
                      <span className="text-sm font-medium">{theme.label}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-border/30">
                  <p className="text-xs text-muted-foreground mb-3">Thèmes personnalisés (bientôt)</p>
                  <div className="grid grid-cols-4 gap-2 opacity-50">
                    {["Cyberpunk", "Ocean", "Forest", "Sunset"].map((name) => (
                      <div key={name} className="p-2 rounded-lg bg-muted/30 text-center">
                        <div className="w-full h-4 rounded bg-gradient-to-r from-primary/50 to-secondary/50 mb-1" />
                        <span className="text-[10px]">{name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </SettingsCard>

              <SettingsCard title="Notifications" icon={Bell}>
                <SettingRow label="Notifications de bureau" description="Affiche le titre en cours">
                  <Switch checked={settings.notificationsEnabled} onCheckedChange={(v) => updateSetting("notificationsEnabled", v)} />
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
                  
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Cloud Name</Label>
                      <Input
                        value={cloudinaryConfig.cloudName}
                        onChange={(e) => setCloudinaryConfig(prev => ({ ...prev, cloudName: e.target.value }))}
                        placeholder="votre-cloud-name"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">API Key</Label>
                      <div className="relative mt-1">
                        <Input
                          type={showCloudinaryKey ? "text" : "password"}
                          value={cloudinaryConfig.apiKey}
                          onChange={(e) => setCloudinaryConfig(prev => ({ ...prev, apiKey: e.target.value }))}
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
                      <Label className="text-xs">Upload Preset (unsigned)</Label>
                      <Input
                        value={cloudinaryConfig.uploadPreset}
                        onChange={(e) => setCloudinaryConfig(prev => ({ ...prev, uploadPreset: e.target.value }))}
                        placeholder="preset-name"
                        className="mt-1"
                      />
                    </div>
                    <Button variant="default" size="sm" className="w-full">
                      <Check className="w-4 h-4 mr-2" />
                      Sauvegarder
                    </Button>
                  </div>
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

                  <div className="text-center py-4">
                    <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-3">
                      <User className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">Non connecté</p>
                    <Button variant="default" size="sm">
                      <User className="w-4 h-4 mr-2" />
                      Se connecter
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
                    <Button variant="outline" size="sm" className="w-full mt-3">
                      <CreditCard className="w-4 h-4 mr-2" />
                      Passer au Pro
                    </Button>
                  </div>
                </div>
              </SettingsCard>

              {/* Sync Status */}
              <SettingsCard title="Synchronisation" icon={RefreshCw} className="lg:col-span-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-muted/30 text-center">
                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-2xl font-bold font-mono">0</p>
                    <p className="text-xs text-muted-foreground">Fichiers uploadés</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30 text-center">
                    <Download className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-2xl font-bold font-mono">0</p>
                    <p className="text-xs text-muted-foreground">Fichiers téléchargés</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30 text-center">
                    <HardDrive className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-2xl font-bold font-mono">0 Mo</p>
                    <p className="text-xs text-muted-foreground">Espace utilisé</p>
                  </div>
                </div>
              </SettingsCard>
            </div>
          </TabsContent>

          {/* Account Tab */}
          <TabsContent value="account" className="mt-6 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SettingsCard title="Profil" icon={User}>
                <div className="text-center py-6">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mx-auto mb-4">
                    <User className="w-10 h-10 text-muted-foreground" />
                  </div>
                  <p className="text-lg font-medium">Utilisateur local</p>
                  <p className="text-sm text-muted-foreground">Mode hors ligne</p>
                  <Button variant="outline" size="sm" className="mt-4">
                    Créer un compte
                  </Button>
                </div>
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
                    <Button variant="outline" size="sm">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Mises à jour
                    </Button>
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Licences
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
