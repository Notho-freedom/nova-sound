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
  ChevronRight,
  FolderOpen,
  RefreshCw,
  Radio,
  Mic2,
  Sliders,
  Trash2,
  Plus,
  X,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useLibrary } from "@/hooks/useLibrary";
import type { Settings } from "@/types/music";

interface SettingsSectionProps {
  icon: typeof Volume2;
  title: string;
  description?: string;
  children: React.ReactNode;
}

const SettingsSection = ({
  icon: Icon,
  title,
  description,
  children,
}: SettingsSectionProps) => (
  <div className="glass rounded-xl p-6">
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1">
        <h3 className="font-display text-lg font-medium text-foreground mb-1">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-muted-foreground mb-4">{description}</p>
        )}
        {children}
      </div>
    </div>
  </div>
);

interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

const SettingRow = ({ label, description, children }: SettingRowProps) => (
  <div className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
    <div>
      <p className="text-sm font-medium text-foreground">{label}</p>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
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

  const updateSetting = async <K extends keyof Settings>(
    key: K,
    value: Settings[K]
  ) => {
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
    const newDirs = (settings.musicDirectories || []).filter(
      (d) => d !== folder
    );
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
      <div className="p-6 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-3xl font-bold mb-2 text-foreground">
          Paramètres
        </h1>
        <p className="text-muted-foreground">
          Personnalisez votre expérience NEXUS
        </p>
      </div>

      {/* Music Library */}
      <SettingsSection
        icon={Music}
        title="Bibliothèque musicale"
        description="Gérez vos dossiers de musique"
      >
        <div className="space-y-4">
          {/* Music folders list */}
          <div className="space-y-2">
            {(settings.musicDirectories || []).length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                Aucun dossier de musique configuré
              </p>
            ) : (
              (settings.musicDirectories || []).map((folder) => (
                <div
                  key={folder}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FolderOpen className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm truncate">{folder}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0"
                    onClick={() => handleRemoveMusicFolder(folder)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
          </div>

          {/* Add folder button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddMusicFolder}
            disabled={!isElectron}
          >
            <Plus className="w-4 h-4 mr-2" />
            Ajouter un dossier
          </Button>

          {/* Scan progress */}
          {scanning && scanProgress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {scanProgress.phase === "scanning"
                    ? "Recherche des fichiers..."
                    : scanProgress.phase === "extracting"
                    ? "Extraction des métadonnées..."
                    : scanProgress.phase === "indexing"
                    ? "Indexation..."
                    : "Terminé"}
                </span>
                <span className="text-primary">
                  {scanProgress.current} / {scanProgress.total}
                </span>
              </div>
              <Progress
                value={
                  scanProgress.total > 0
                    ? (scanProgress.current / scanProgress.total) * 100
                    : 0
                }
              />
              {scanProgress.file && (
                <p className="text-xs text-muted-foreground truncate">
                  {scanProgress.file}
                </p>
              )}
            </div>
          )}

          {/* Library stats and scan button */}
          <div className="flex items-center justify-between pt-2">
            <div className="text-sm text-muted-foreground">
              {tracks.length} pistes dans la bibliothèque
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={handleScanLibrary}
              disabled={
                scanning || (settings.musicDirectories || []).length === 0
              }
            >
              <RefreshCw
                className={cn("w-4 h-4 mr-2", scanning && "animate-spin")}
              />
              {scanning ? "Scan en cours..." : "Scanner la bibliothèque"}
            </Button>
          </div>

          {/* Auto scan setting */}
          <SettingRow
            label="Scanner au démarrage"
            description="Recherche automatiquement les nouveaux fichiers"
          >
            <Switch
              checked={settings.autoScanOnStartup}
              onCheckedChange={(v) => updateSetting("autoScanOnStartup", v)}
            />
          </SettingRow>
        </div>
      </SettingsSection>

      {/* Audio Settings */}
      <SettingsSection
        icon={Volume2}
        title="Audio"
        description="Configurez la lecture audio"
      >
        <div className="space-y-1">
          <SettingRow
            label="Crossfade"
            description="Transition fluide entre les pistes"
          >
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
                    onValueChange={(v) =>
                      updateSetting("crossfadeDuration", v[0])
                    }
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground w-8">
                    {settings.crossfadeDuration}s
                  </span>
                </>
              )}
            </div>
          </SettingRow>

          <SettingRow
            label="Lecture sans interruption"
            description="Supprime les silences entre les pistes"
          >
            <Switch
              checked={settings.gaplessPlayback}
              onCheckedChange={(v) => updateSetting("gaplessPlayback", v)}
            />
          </SettingRow>

          <SettingRow
            label="Normalisation du volume"
            description="Égalise le volume de toutes les pistes"
          >
            <Switch
              checked={settings.normalizeVolume}
              onCheckedChange={(v) => updateSetting("normalizeVolume", v)}
            />
          </SettingRow>

          <SettingRow
            label="Égaliseur"
            description="Ajustez les fréquences audio"
          >
            <Switch
              checked={settings.equalizerEnabled}
              onCheckedChange={(v) => updateSetting("equalizerEnabled", v)}
            />
          </SettingRow>
        </div>
      </SettingsSection>

      {/* Lyrics Settings */}
      <SettingsSection
        icon={Mic2}
        title="Paroles"
        description="Affichage des paroles synchronisées"
      >
        <div className="space-y-1">
          <SettingRow
            label="Afficher les paroles"
            description="Récupère automatiquement les paroles depuis LRCLIB"
          >
            <Switch
              checked={settings.showLyrics}
              onCheckedChange={(v) => updateSetting("showLyrics", v)}
            />
          </SettingRow>
        </div>
      </SettingsSection>

      {/* Scrobbling Settings */}
      <SettingsSection
        icon={Radio}
        title="Scrobbling"
        description="Partagez ce que vous écoutez"
      >
        <div className="space-y-4">
          <SettingRow
            label="Activer le scrobbling"
            description="Envoie vos écoutes à Last.fm et Libre.fm"
          >
            <Switch
              checked={settings.scrobblingEnabled}
              onCheckedChange={(v) => updateSetting("scrobblingEnabled", v)}
              disabled={!isElectron}
            />
          </SettingRow>

          {/* Last.fm */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-red-500/20 flex items-center justify-center">
                <span className="text-xs font-bold text-red-500">LF</span>
              </div>
              <div>
                <p className="text-sm font-medium">Last.fm</p>
                {scrobblerStatus.lastFm.connected ? (
                  <p className="text-xs text-green-500">
                    Connecté: {scrobblerStatus.lastFm.username}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Non connecté</p>
                )}
              </div>
            </div>
            {scrobblerStatus.lastFm.connected ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDisconnectScrobbler("lastfm")}
              >
                Déconnecter
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={handleConnectLastFm}
                disabled={!isElectron}
              >
                Connecter
              </Button>
            )}
          </div>

          {/* Libre.fm */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-green-500/20 flex items-center justify-center">
                <span className="text-xs font-bold text-green-500">LB</span>
              </div>
              <div>
                <p className="text-sm font-medium">Libre.fm</p>
                {scrobblerStatus.libreFm.connected ? (
                  <p className="text-xs text-green-500">
                    Connecté: {scrobblerStatus.libreFm.username}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Non connecté</p>
                )}
              </div>
            </div>
            {scrobblerStatus.libreFm.connected ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDisconnectScrobbler("librefm")}
              >
                Déconnecter
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={handleConnectLibreFm}
                disabled={!isElectron}
              >
                Connecter
              </Button>
            )}
          </div>
        </div>
      </SettingsSection>

      {/* Display Settings */}
      <SettingsSection
        icon={Palette}
        title="Affichage"
        description="Personnalisez l'apparence"
      >
        <div className="space-y-1">
          <SettingRow label="Thème">
            <div className="flex gap-2">
              {(["dark", "light", "system"] as const).map((theme) => (
                <button
                  key={theme}
                  onClick={() => updateSetting("theme", theme)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm transition-colors capitalize",
                    settings.theme === theme
                      ? "bg-primary/20 text-primary border border-primary/50"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {theme === "dark"
                    ? "Sombre"
                    : theme === "light"
                    ? "Clair"
                    : "Système"}
                </button>
              ))}
            </div>
          </SettingRow>
        </div>
      </SettingsSection>

      {/* Application Settings */}
      <SettingsSection
        icon={Monitor}
        title="Application"
        description="Comportement de l'application"
      >
        <div className="space-y-1">
          <SettingRow
            label="Notifications de bureau"
            description="Affiche les infos du titre en cours"
          >
            <Switch
              checked={settings.notificationsEnabled}
              onCheckedChange={(v) => updateSetting("notificationsEnabled", v)}
            />
          </SettingRow>
        </div>
      </SettingsSection>

      {/* Keyboard Shortcuts */}
      <SettingsSection icon={Keyboard} title="Raccourcis clavier">
        <div className="space-y-1">
          {[
            { action: "Lecture/Pause", shortcut: "Espace" },
            { action: "Titre suivant", shortcut: "Ctrl + →" },
            { action: "Titre précédent", shortcut: "Ctrl + ←" },
            { action: "Augmenter le volume", shortcut: "Ctrl + ↑" },
            { action: "Baisser le volume", shortcut: "Ctrl + ↓" },
            { action: "Muet", shortcut: "Ctrl + M" },
            { action: "Plein écran", shortcut: "F11" },
          ].map(({ action, shortcut }) => (
            <SettingRow key={action} label={action}>
              <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono text-muted-foreground">
                {shortcut}
              </kbd>
            </SettingRow>
          ))}
        </div>
      </SettingsSection>

      {/* About */}
      <SettingsSection icon={Info} title="À propos">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Version</span>
            <span className="text-sm text-foreground">1.0.0</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Build</span>
            <span className="text-sm text-foreground font-mono">2024.12.08</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Mode</span>
            <span className="text-sm text-foreground">
              {isElectron ? "Application Desktop" : "Web"}
            </span>
          </div>
          <div className="pt-3 flex gap-3">
            <Button variant="outline" size="sm">
              Rechercher des mises à jour
            </Button>
            <Button variant="link" size="sm">
              Licences
            </Button>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
};
