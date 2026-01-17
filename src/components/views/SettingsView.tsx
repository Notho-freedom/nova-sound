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
  Wand2,
  CheckCircle2,
  Loader2,
  Copy,
  Search,
  Tag,
  Clock,
} from "lucide-react";
import { Youtube } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { HelpButton, HelpIcon } from "@/components/ui/HelpButton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useLibrary } from "@/hooks/useLibrary";
import { useLibraryTools } from "@/hooks/useLibraryTools";
import { useVideos } from "@/hooks/useVideos";
import { useCloudSync } from "@/hooks/useCloudSync";
import { SyncStatusIndicator } from "@/components/SyncStatusIndicator";
import { firebaseService } from "@/services/firebase";
import { authService } from "@/services/auth";
import { useTheme, type Theme } from "@/hooks/useTheme";
import { useNotifications } from "@/hooks/useNotifications";
import { toast } from "sonner";
import type { Settings, RecognitionResult, DetectedGroup, Track } from "@/types/music";
import { stripeService, PRICE_IDS } from "@/services/stripe";
import type { SubscriptionStatus } from "@/services/stripe";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsViewSkeleton } from "@/components/ui/skeletons";
import { testYouTubeApiKey } from "@/lib/youtube-api-test";
import { redisCache } from "@/services/redis-cache";
import { CoachmarkTrigger } from "@/features/coachmarks";
import { useI18n } from "@/i18n";

// Next.js: Use NEXT_PUBLIC_ prefix for client-side env vars
const API_BASE_URL = typeof window !== 'undefined' 
  ? (process.env.NEXT_PUBLIC_API_URL || "") 
  : "";

interface SettingRowProps {
  label: string
  description?: string
  children: React.ReactNode
  icon?: React.ElementType
  helpText?: string
  helpTitle?: string
}

const SettingRow = ({ label, description, children, icon: Icon, helpText, helpTitle }: SettingRowProps) => (
  <div className="flex items-center justify-between py-4 group hover:bg-white/[0.02] -mx-4 px-4 rounded-lg transition-colors">
    <div className="flex items-center gap-3 flex-1 min-w-0 pr-4">
      {Icon && (
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/10 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-primary/80" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground">{label}</p>
          {helpText && <HelpIcon title={helpTitle || label} description={helpText} />}
        </div>
        {description && <p className="text-xs text-muted-foreground/70 mt-0.5 line-clamp-1">{description}</p>}
      </div>
    </div>
    <div className="flex-shrink-0">{children}</div>
  </div>
)

interface SettingsCardProps {
  title: string
  icon: typeof Volume2
  children: React.ReactNode
  className?: string
  accentColor?: string
  badge?: string
}

const SettingsCard = ({
  title,
  icon: Icon,
  children,
  className,
  accentColor = "from-primary/20 to-secondary/10",
  badge,
}: SettingsCardProps) => (
  <div
    className={cn(
      "relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-transparent backdrop-blur-xl",
      "shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_40px_rgba(0,0,0,0.4)] transition-all duration-300",
      "before:absolute before:inset-0 before:rounded-2xl before:p-[1px] before:bg-gradient-to-b before:from-white/10 before:to-transparent before:-z-10",
      className,
    )}
  >
    {/* Ambient glow effect */}
    <div
      className={cn(
        "absolute -top-20 -right-20 w-40 h-40 rounded-full bg-gradient-to-br opacity-20 blur-3xl pointer-events-none",
        accentColor,
      )}
    />

    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg",
              accentColor,
            )}
          >
            <Icon className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-foreground tracking-tight">{title}</h3>
            {badge && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/20 text-primary mt-0.5">
                {badge}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="divide-y divide-white/[0.05]">{children}</div>
    </div>
  </div>
)

// Config status alert
// Recognition Card Component
const RecognitionCard = ({ tracks, refreshLibrary }: { tracks: Track[]; refreshLibrary: () => Promise<void> }) => {
  const { t } = useI18n();
  const [recognizing, setRecognizing] = useState(false);
  const [results, setResults] = useState<RecognitionResult[]>([]);
  const [patterns, setPatterns] = useState<DetectedGroup[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [showPatterns, setShowPatterns] = useState(false);
  // Use centralized Electron detection
  const isElectron = typeof window !== 'undefined' && typeof window.electronAPI !== 'undefined';

  const unknownTracks = tracks.filter(t => t.artist === 'Artiste inconnu' || t.album === 'Album inconnu');

  const handleRecognize = async () => {
    if (!isElectron || !window.electronAPI?.recognizeAll) {
      toast.error(t("infoDesktopOnly"));
      return;
    }

    setRecognizing(true);
    try {
      const recognitionResults = await window.electronAPI.recognizeAll();
      setResults(recognitionResults);
      setShowResults(true);
      toast.success(
        t("settingsRecognitionTracksRecognized", {
          count: recognitionResults.length,
          suffix: recognitionResults.length > 1 ? "s" : "",
        })
      );
    } catch (error) {
      console.error('Erreur lors de la reconnaissance:', error);
      toast.error(t("settingsRecognitionError"));
    } finally {
      setRecognizing(false);
    }
  };

  const handleApplyResults = async () => {
    if (!isElectron || !window.electronAPI?.applyRecognition) {
      return;
    }

    try {
      const updated = await window.electronAPI.applyRecognition(results);
      toast.success(
        t("settingsRecognitionTracksUpdated", {
          count: updated,
          suffix: updated > 1 ? "s" : "",
        })
      );
      setResults([]);
      setShowResults(false);
      // Attendre un peu pour que les événements soient traités
      await new Promise(resolve => setTimeout(resolve, 500));
      // Rafraîchir la bibliothèque
      await refreshLibrary();
    } catch (error) {
      console.error('Erreur lors de l\'application:', error);
      toast.error(t("settingsRecognitionApplyError"));
    }
  };

  const handleDetectPatterns = async () => {
    if (!isElectron || !window.electronAPI?.detectPatterns) {
      toast.error(t("infoDesktopOnly"));
      return;
    }

    setRecognizing(true);
    try {
      const detectedPatterns = await window.electronAPI.detectPatterns();
      setPatterns(detectedPatterns);
      setShowPatterns(true);
      toast.success(
        t("settingsRecognitionPatternsDetected", {
          count: detectedPatterns.length,
          suffix: detectedPatterns.length > 1 ? "s" : "",
        })
      );
    } catch (error) {
      console.error('Erreur lors de la détection:', error);
      toast.error(t("settingsRecognitionPatternsError"));
    } finally {
      setRecognizing(false);
    }
  };

  const handleApplyPattern = async (group: DetectedGroup) => {
    if (!isElectron || !window.electronAPI?.applyDetectedGroup) {
      return;
    }

    try {
      const updated = await window.electronAPI.applyDetectedGroup(group);
      toast.success(
        t("settingsRecognitionTracksUpdated", {
          count: updated,
          suffix: updated > 1 ? "s" : "",
        })
      );
      // Attendre un peu pour que les événements soient traités
      await new Promise(resolve => setTimeout(resolve, 500));
      // Rafraîchir la bibliothèque
      await refreshLibrary();
      // Recharger les patterns
      const newPatterns = await window.electronAPI?.detectPatterns?.();
      if (newPatterns) setPatterns(newPatterns);
    } catch (error) {
      console.error('Erreur lors de l\'application:', error);
      toast.error(t("settingsRecognitionPatternApplyError"));
    }
  };

  if (!isElectron) {
    return null;
  }

  return (
    <SettingsCard title={t("settingsCardRecognitionAuto")} icon={Wand2} className="lg:col-span-2">
      <div className="space-y-4">
        <div className="p-3 rounded-lg bg-muted/30">
          <p className="text-sm text-muted-foreground">
            {unknownTracks.length > 0 
              ? t("settingsRecognitionMissingMetadata", {
                  count: unknownTracks.length,
                  suffix: unknownTracks.length > 1 ? "s" : "",
                })
              : t("settingsRecognitionAllIdentified")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={handleRecognize}
            disabled={recognizing || unknownTracks.length === 0}
          >
            {recognizing ? (
              <>
                <Wand2 className="w-4 h-4 mr-2" />
                {t("settingsRecognitionAnalyzing")}
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 mr-2" />
                {t("settingsRecognitionAnalyzeAll")}
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDetectPatterns}
            disabled={recognizing || unknownTracks.length === 0}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {t("settingsRecognitionDetectPatterns")}
          </Button>
        </div>

        {showResults && results.length > 0 && (
          <div className="mt-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium">
                {t("settingsRecognitionResultsTitle", { count: results.length })}
              </h4>
              <Button variant="ghost" size="sm" onClick={() => setShowResults(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {results.slice(0, 10).map((result) => (
                <div key={result.trackId} className="p-2 rounded bg-muted/30 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {result.originalArtist} - {result.originalAlbum}
                    </span>
                    <span className="text-primary">→</span>
                    <span className="font-medium">
                      {result.suggestedArtist} - {result.suggestedAlbum}
                    </span>
                    <span className="text-muted-foreground ml-auto">
                      {Math.round(result.confidence * 100)}%
                    </span>
                  </div>
                </div>
              ))}
              {results.length > 10 && (
                <p className="text-xs text-muted-foreground text-center">
                  {t("settingsRecognitionResultsMore", { count: results.length - 10 })}
                </p>
              )}
            </div>
            <Button
              variant="default"
              size="sm"
              className="w-full mt-3"
              onClick={handleApplyResults}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {t("settingsRecognitionApplyResults", {
                count: results.length,
                suffix: results.length > 1 ? "s" : "",
              })}
            </Button>
          </div>
        )}

        {showPatterns && patterns.length > 0 && (
          <div className="mt-4 p-4 rounded-lg bg-accent/5 border border-accent/20">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium">
                {t("settingsRecognitionPatternsTitle", { count: patterns.length })}
              </h4>
              <Button variant="ghost" size="sm" onClick={() => setShowPatterns(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {patterns.map((pattern, idx) => (
                <div key={idx} className="p-3 rounded bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium">{pattern.artist}</p>
                      <p className="text-xs text-muted-foreground">{pattern.album}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-mono">
                        {t("settingsRecognitionTracksCount", {
                          count: pattern.tracks.length,
                          suffix: pattern.tracks.length > 1 ? "s" : "",
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("settingsRecognitionConfidence", {
                          value: Math.round(pattern.confidence * 100),
                        })}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => handleApplyPattern(pattern)}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    {t("settingsRecognitionApplyPattern")}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SettingsCard>
  );
};

const ConfigAlert = ({ configured, service }: { configured: boolean; service: string }) => {
  const { t } = useI18n();
  if (configured) return null;
  return (
    <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 mb-4">
      <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
      <p className="text-xs text-yellow-500">
        {t("settingsConfigAlert", { service })}
      </p>
    </div>
  );
};

export const SettingsView = () => {
  const { tracks, scanning, scanProgress, scanLibrary, selectMusicFolders, refreshLibrary } = useLibrary();
  const { t, locale } = useI18n();
  const themeOptions = [
    { id: "dark", label: t("settingsThemeDark"), color: "bg-gradient-to-br from-zinc-900 to-zinc-950", border: "border-cyan-500" },
    { id: "light", label: t("settingsThemeLight"), color: "bg-gradient-to-br from-zinc-50 to-zinc-100", border: "border-blue-500" },
    { id: "cyberpunk", label: t("settingsThemeCyberpunk"), color: "bg-gradient-to-br from-purple-900 via-yellow-600 to-purple-800", border: "border-yellow-500" },
    { id: "minimal", label: t("settingsThemeMinimal"), color: "bg-gradient-to-br from-zinc-900 to-black", border: "border-white" },
    { id: "spotify", label: t("settingsThemeSpotify"), color: "bg-gradient-to-br from-[#121212] via-[#1DB954] to-[#191414]", border: "border-[#1DB954]" },
    { id: "apple-music", label: t("settingsThemeAppleMusic"), color: "bg-gradient-to-br from-[#1a0f0f] via-[#FC3C44] to-[#2a1515]", border: "border-[#FC3C44]" },
    { id: "youtube-music", label: t("settingsThemeYouTubeMusic"), color: "bg-gradient-to-br from-[#121212] via-[#FF0000] to-[#1a0a0a]", border: "border-[#FF0000]" },
    { id: "tidal", label: t("settingsThemeTidal"), color: "bg-gradient-to-br from-[#0a1a1f] via-[#00FFFF] to-[#0f1f2a]", border: "border-[#00FFFF]" },
    { id: "deezer", label: t("settingsThemeDeezer"), color: "bg-gradient-to-br from-[#00C7F2] via-[#FF0090] to-[#0a1a1f]", border: "border-[#00C7F2]" },
  ];
  const {
    qualityAnalysis,
    qualityLoading,
    analyzeQuality,
    duplicates,
    duplicatesLoading,
    detectDuplicates,
    integrityResult,
    integrityLoading,
    checkIntegrity,
    cleanupMissing,
    cleanupLoading,
    metadataReport,
    metadataLoading,
    analyzeMetadata,
  } = useLibraryTools();
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
  const [redisConnected, setRedisConnected] = useState<boolean | null>(null);
  const [redisChecking, setRedisChecking] = useState(false);
  // Initialize settings with current theme from useTheme hook
  const [settings, setSettings] = useState<Partial<Settings>>(() => {
    const savedTheme = typeof window !== 'undefined' 
      ? (localStorage.getItem("nexus-theme") as any) || theme 
      : theme;
    return {
      musicDirectories: [],
      crossfadeDuration: 5,
      gaplessPlayback: true,
      normalizeVolume: true,
      audioQuality: "high",
      notificationsEnabled: true,
      scrobblingEnabled: false,
      equalizerEnabled: false,
      theme: savedTheme,
      showLyrics: true,
      autoScanOnStartup: true,
    };
  });
  const [scrobblerStatus, setScrobblerStatus] = useState({
    lastFm: { connected: false, username: undefined as string | undefined },
    libreFm: { connected: false, username: undefined as string | undefined },
  });
  const [loading, setLoading] = useState(true);
  const [showCloudinaryKey, setShowCloudinaryKey] = useState(false);
  const [showYouTubeKey, setShowYouTubeKey] = useState(false);
  const [youtubeApiKey, setYoutubeApiKey] = useState("");
  const [savingYouTube, setSavingYouTube] = useState(false);
  const [testingYouTube, setTestingYouTube] = useState(false);
  const [youtubeTestResult, setYoutubeTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showYouTubeConfig, setShowYouTubeConfig] = useState(false);
  const [cloudinaryForm, setCloudinaryForm] = useState({
    cloudName: "",
    apiKey: "",
    uploadPreset: "",
  });
  const [savingCloudinary, setSavingCloudinary] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [bunnyStatus, setBunnyStatus] = useState<{ configured: boolean; message?: string } | null>(null);
  const [bunnyStatusLoading, setBunnyStatusLoading] = useState(false);
  // Check if running in Electron - use reliable detection
  const isElectron = typeof window !== 'undefined' && typeof window.electronAPI !== 'undefined';

  // Debug: Log scanning state changes
  useEffect(() => {
    console.log('🔍 [SettingsView] Scanning state:', { scanning, scanProgress });
  }, [scanning, scanProgress]);

  // Load Bunny status when user is Pro
  useEffect(() => {
    const loadBunnyStatus = async () => {
      if (!nexusIsPro || !nexusAuthenticated) {
        setBunnyStatus(null);
        return;
      }
      
      setBunnyStatusLoading(true);
      try {
        const { firebaseService } = await import('@/services/firebase');
        const token = await firebaseService.getIdToken();
        if (!token) {
          setBunnyStatus({ configured: false, message: t("settingsBunnyTokenUnavailable") });
          return;
        }
        
        const response = await fetch('/api/storage/bunny-status', {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (response.ok) {
          const data = await response.json();
          setBunnyStatus(data);
        } else {
          setBunnyStatus({ configured: false, message: t("settingsBunnyCheckError") });
        }
      } catch (error) {
        console.error('Error loading Bunny status:', error);
        setBunnyStatus({ configured: false, message: t("settingsBunnyConnectionError") });
      } finally {
        setBunnyStatusLoading(false);
      }
    };
    
    loadBunnyStatus();
  }, [nexusIsPro, nexusAuthenticated]);

  // Load settings from backend, localStorage, and Firebase
  useEffect(() => {
    const loadSettings = async () => {
      let loadedSettings: Partial<Settings> = {
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
      };
      
      if (isElectron) {
        try {
          if (!window.electronAPI) return;
          const [electronSettings, status] = await Promise.all([
            window.electronAPI.getSettings(),
            window.electronAPI.getScrobblerStatus?.() || Promise.resolve({ lastFm: { connected: false, username: undefined }, libreFm: { connected: false, username: undefined } }),
          ]);
          loadedSettings = { ...loadedSettings, ...electronSettings };
          setScrobblerStatus({
            lastFm: { connected: status.lastFm.connected, username: 'username' in status.lastFm ? status.lastFm.username : undefined },
            libreFm: { connected: status.libreFm.connected, username: 'username' in status.libreFm ? status.libreFm.username : undefined },
          });
        } catch (err) {
          console.error("Failed to load settings from Electron:", err);
        }
      }
      
      // Load theme from localStorage (don't override the current theme from useTheme)
      const savedTheme = localStorage.getItem("nexus-theme") as Theme | null;
      if (savedTheme) {
        loadedSettings.theme = savedTheme;
      }

      // Load from localStorage (for web or as fallback)
      try {
        const settingsKeys: (keyof Settings)[] = [
          'crossfadeEnabled', 'crossfadeDuration', 'gaplessPlayback', 'normalizeVolume',
          'audioQuality', 'equalizerEnabled', 'showLyrics', 'scrobblingEnabled',
          'autoScanOnStartup', 'notificationsEnabled'
        ];
        
        settingsKeys.forEach((key) => {
          const stored = localStorage.getItem(`nexus-setting-${key}`);
          if (stored !== null) {
            try {
              const parsed = JSON.parse(stored);
              (loadedSettings as Record<string, unknown>)[key] = parsed;
            } catch (e) {
              // Invalid JSON, skip
            }
          }
        });
      } catch (err) {
        console.error("Failed to load settings from localStorage:", err);
      }
      
      // Load from Firebase sync (if authenticated)
      if (nexusAuthenticated) {
        try {
          const { firebaseSyncService } = await import('@/services/firebase-sync');
          const firestoreData = await firebaseSyncService.loadFromFirestore();
          if (firestoreData?.settings) {
            loadedSettings = { ...loadedSettings, ...firestoreData.settings };
          }
          // Also check for theme directly in firestoreData (Firebase takes priority)
          if (firestoreData?.theme) {
            loadedSettings.theme = firestoreData.theme;
          }
        } catch (err) {
          // Silently fail if Firebase sync is not available
          console.warn("Failed to load settings from Firebase:", err);
        }
      }
      
      // Always use the current theme from useTheme hook as the source of truth
      // This prevents the theme from being reset when opening settings
      if (theme) {
        loadedSettings.theme = theme;
      }
      
      setSettings(prevSettings => ({
        ...loadedSettings,
        // Preserve theme from useTheme hook to prevent reset
        theme: theme || prevSettings.theme || loadedSettings.theme
      }));
      
      // Load cloudinary config
      if (cloudinaryConfig) {
        setCloudinaryForm({
          cloudName: cloudinaryConfig.cloudName || "",
          apiKey: cloudinaryConfig.apiKey || "",
          uploadPreset: cloudinaryConfig.uploadPreset || "",
        });
      }
      
      // Load YouTube API key from Firebase, localStorage, or env
      let savedYouTubeKey = "";
      if (nexusAuthenticated) {
        try {
          const { firebaseSyncService } = await import('@/services/firebase-sync');
          const firestoreData = await firebaseSyncService.loadFromFirestore();
          if (firestoreData?.youtubeApiKey) {
            savedYouTubeKey = firestoreData.youtubeApiKey;
          }
        } catch (err) {
          console.warn("Failed to load YouTube API key from Firebase:", err);
        }
      }
      // Fallback to localStorage
      if (!savedYouTubeKey) {
        savedYouTubeKey = localStorage.getItem("nexus-youtube-api-key") || "";
      }
      // Fallback to env
      if (!savedYouTubeKey) {
        savedYouTubeKey = process.env.YOUTUBE_API_KEY || "";
      }
      setYoutubeApiKey(savedYouTubeKey);
      // Cacher la config si une clé existe déjà
      setShowYouTubeConfig(!savedYouTubeKey);
      
      // Check Redis connection status
      try {
        const isRedisConnected = await redisCache.isConnected();
        setRedisConnected(isRedisConnected);
      } catch (error) {
        console.error('[Settings] Failed to check Redis status:', error);
        setRedisConnected(false);
      }
      
      setLoading(false);
    };
    loadSettings();
    
    // Écouter les mises à jour de la clé YouTube depuis Firebase
    const handleYouTubeKeyUpdate = (event: CustomEvent) => {
      const newKey = event.detail;
      if (newKey !== youtubeApiKey) {
        setYoutubeApiKey(newKey || "");
        // Cacher la config si une clé existe, l'afficher sinon
        setShowYouTubeConfig(!newKey);
      }
    };
    
    window.addEventListener('youtube-api-key-updated', handleYouTubeKeyUpdate as EventListener);
    
    return () => {
      window.removeEventListener('youtube-api-key-updated', handleYouTubeKeyUpdate as EventListener);
    };
  }, [isElectron, cloudinaryConfig, nexusAuthenticated, theme, youtubeApiKey]);

  // Load subscription status - TOUJOURS depuis Stripe (source de vérité)
  useEffect(() => {
    const loadSubscriptionStatus = async () => {
      if (nexusAuthenticated && stripeInitialized) {
        setSubscriptionLoading(true);
        try {
          console.log('🔄 SettingsView: Chargement du statut d\'abonnement depuis Stripe...');
          // Récupérer les VRAIES données depuis Stripe (pas de simulation)
          const status = await stripeService.getSubscriptionStatus();
          console.log('✅ SettingsView: Statut d\'abonnement récupéré depuis Stripe:', status);
          setSubscriptionStatus(status);
        } catch (error) {
          console.error("❌ SettingsView: Erreur lors du chargement du statut depuis Stripe:", error);
          // En cas d'erreur, ne pas utiliser de données simulées
          setSubscriptionStatus(null);
        } finally {
          setSubscriptionLoading(false);
        }
      }
    };
    loadSubscriptionStatus();
  }, [nexusAuthenticated, stripeInitialized]);

  // Écouter les changements du profil utilisateur en temps réel et récupérer les VRAIES données depuis Stripe
  useEffect(() => {
    if (!nexusAuthenticated || !stripeInitialized) return;

    // Fonction pour charger les données réelles depuis Stripe
    const loadRealStripeData = async () => {
      try {
        console.log('🔄 SettingsView: Chargement des données réelles depuis Stripe...');
        const stripeStatus = await stripeService.getSubscriptionStatus();
        console.log('✅ SettingsView: Données Stripe récupérées:', stripeStatus);
        
        // Vérifier l'incohérence avec Firestore
        const profile = firebaseService.getUserProfile();
        if (profile) {
          const firestorePlan = profile.plan;
          const firestoreStatus = profile.subscriptionStatus;
          const stripePlan = stripeStatus.plan;
          const stripeStatusValue = stripeStatus.status;
          
          // Détecter une incohérence
          if (
            (stripePlan === 'pro' && firestorePlan !== 'pro') ||
            (stripePlan === 'free' && firestorePlan === 'pro') ||
            (stripeStatusValue !== firestoreStatus && stripeStatusValue !== 'none')
          ) {
            console.warn('⚠️ INCOHÉRENCE DÉTECTÉE entre Stripe et Firestore:');
            console.warn('   Stripe:', { plan: stripePlan, status: stripeStatusValue });
            console.warn('   Firestore:', { plan: firestorePlan, status: firestoreStatus });
            console.log('🔄 Synchronisation de Firestore avec Stripe...');
            
            // Synchroniser Firestore avec les données Stripe réelles
            try {
              const { firebaseService: fbService } = await import('@/services/firebase');
              const currentUser = fbService.getCurrentUser();
              if (currentUser && !currentUser.isAnonymous) {
                const idToken = await fbService.getIdToken();
                if (idToken) {
                  const syncResponse = await fetch('/api/stripe/sync-profile', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${idToken}`,
                    },
                  });
                  
                  if (syncResponse.ok) {
                    console.log('✅ Firestore synchronisé avec Stripe');
                    // Forcer le rafraîchissement du profil
                    await fbService.refreshProfile();
                  } else {
                    console.error('❌ Erreur lors de la synchronisation:', await syncResponse.text());
                  }
                }
              }
            } catch (syncError) {
              console.error('❌ Erreur lors de la synchronisation Firestore:', syncError);
            }
          }
        }
        
        // Utiliser UNIQUEMENT les données Stripe (source de vérité)
        setSubscriptionStatus(stripeStatus);
      } catch (error) {
        console.error('❌ SettingsView: Erreur lors du chargement des données Stripe:', error);
        // En cas d'erreur, ne pas utiliser de données simulées
      }
    };

    // Charger immédiatement
    loadRealStripeData();

    // Écouter les changements du profil Firebase (pour déclencher un rechargement depuis Stripe)
    // Le webhook Stripe met à jour Firestore, ce qui déclenche ce listener
    const unsubscribe = firebaseService.onAuthStateChange(async (user) => {
      if (user && !user.isAnonymous) {
        const profile = firebaseService.getUserProfile();
        if (profile) {
          console.log('🔄 SettingsView: Profil Firestore mis à jour (webhook Stripe), rechargement depuis Stripe...', {
            plan: profile.plan,
            subscriptionStatus: profile.subscriptionStatus,
          });
          
          // Recharger TOUJOURS depuis Stripe pour obtenir les VRAIES données
          // Firestore est juste un indicateur qu'il y a eu un changement
          await loadRealStripeData();
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [nexusAuthenticated, stripeInitialized]);

  // Handle URL params for Stripe success/cancel
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get("success");
    const canceled = urlParams.get("canceled");

    if (success === "true") {
      toast.success(t("settingsPaymentSuccess"), {
        description: t("settingsPaymentWelcomePro"),
      });
      // Reload subscription status
      if (nexusAuthenticated && stripeInitialized) {
        stripeService.getSubscriptionStatus().then(setSubscriptionStatus);
      }
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (canceled === "true") {
      toast.info(t("settingsPaymentCanceled"));
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const updateSetting = async <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))

    // Save to localStorage immediately
    if (typeof window !== "undefined") {
      localStorage.setItem(`nexus-${key}`, JSON.stringify(value)) // Use nexus- prefix
    }

    // Save to Electron storage if in Electron
    if (isElectron && window.electronAPI) {
      try {
        // Electron needs a specific method to update settings
        window.electronAPI.updateSettings({ [key]: value })
      } catch (err) {
        console.error("Failed to save setting to Electron:", err)
      }
    }

    // Sync to Firebase if authenticated
    if (nexusAuthenticated) {
      try {
        const { firebaseSyncService } = await import("@/services/firebase-sync")
        // Update settings object and sync
        // Merge the new value with existing settings
        const updatedSettings = { ...settings, [key]: value }
        firebaseSyncService.queueSync('settings', updatedSettings)
      } catch (err) {
        // Silently fail if Firebase sync is not available
        console.warn("Failed to sync setting to Firebase:", err)
      }
    }
  }

  const handleAddMusicFolder = async () => {
    const folders = await selectMusicFolders();
    if (folders.length > 0) {
      const newDirs = [...(settings.musicDirectories || []), ...folders];
      await updateSetting("musicDirectories", newDirs);
      notifySuccess(
        t("settingsFoldersAdded", {
          count: folders.length,
          suffix: folders.length > 1 ? "s" : "",
        })
      );
      // Déclencher le scan automatique
      await scanLibrary(newDirs);
    }
  };

  const handleAddVideoFolder = async () => {
    const folders = await selectVideoFolders();
    if (folders.length > 0) {
      const newDirs = [...(settings.videoDirectories || []), ...folders];
      await updateSetting("videoDirectories", newDirs);
      notifySuccess(
        t("settingsVideoFoldersAdded", {
          count: folders.length,
          suffix: folders.length > 1 ? "s" : "",
        })
      );
      // Déclencher le scan automatique
      await scanVideos(newDirs);
    }
  };

  const handleRemoveVideoFolder = async (folder: string) => {
    const newDirs = (settings.videoDirectories || []).filter((d) => d !== folder);
    await updateSetting("videoDirectories", newDirs);
    notifySuccess(t("settingsVideoFolderRemoved"));
  };

  const handleScanVideos = async () => {
    await scanVideos(settings.videoDirectories);
  };

  const handleRemoveMusicFolder = async (folder: string) => {
    const newDirs = (settings.musicDirectories || []).filter((d) => d !== folder);
    await updateSetting("musicDirectories", newDirs);
    notifySuccess(t("settingsFolderRemoved"));
  };

  const handleScanLibrary = async () => {
    await scanLibrary(settings.musicDirectories);
  };

  const handleConnectLastFm = async () => {
    if (isElectron && window.electronAPI?.authenticateLastFm) {
      try {
        await window.electronAPI.authenticateLastFm();
        notifySuccess(t("settingsConnectedToService", { service: t("settingsScrobblingLastFm") }));
      } catch (err) {
        notifyError(t("settingsConnectionFailedService", { service: t("settingsScrobblingLastFm") }));
      }
    }
  };

  const handleConnectLibreFm = async () => {
    if (isElectron && window.electronAPI?.authenticateLibreFm) {
      try {
        await window.electronAPI.authenticateLibreFm();
        notifySuccess(t("settingsConnectedToService", { service: t("settingsScrobblingLibreFm") }));
      } catch (err) {
        notifyError(t("settingsConnectionFailedService", { service: t("settingsScrobblingLibreFm") }));
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
      notifySuccess(
        t("settingsDisconnectedFromService", {
          service:
            service === "lastfm" ? t("settingsScrobblingLastFm") : t("settingsScrobblingLibreFm"),
        })
      );
    }
  };

  // Test YouTube API key
  const handleTestYouTube = async () => {
    if (!youtubeApiKey.trim()) {
      notifyError(t("settingsYouTubeEnterKeyToTest"));
      return;
    }

    setTestingYouTube(true);
    setYoutubeTestResult(null);
    
    try {
      const result = await testYouTubeApiKey(youtubeApiKey.trim());
      setYoutubeTestResult(result);
      
      if (result.success) {
        notifySuccess(result.message);
      } else {
        notifyError(result.message);
      }
    } catch (err: any) {
      const errorResult = {
        success: false,
        message: err.message || t("settingsYouTubeTestError"),
      };
      setYoutubeTestResult(errorResult);
      notifyError(errorResult.message);
    } finally {
      setTestingYouTube(false);
    }
  };

  // Save YouTube API key
  const handleSaveYouTube = async () => {
    setSavingYouTube(true);
    try {
      const keyToSave = youtubeApiKey.trim();
      
      // Save to localStorage
      if (keyToSave) {
        localStorage.setItem("nexus-youtube-api-key", keyToSave);
      } else {
        localStorage.removeItem("nexus-youtube-api-key");
      }
      
      // Save to Firebase if authenticated
      if (nexusAuthenticated) {
        try {
          const { firebaseSyncService } = await import('@/services/firebase-sync');
          await firebaseSyncService.queueSync('youtubeApiKey', keyToSave || null);
        } catch (err) {
          console.warn("Failed to sync YouTube API key to Firebase:", err);
          // Continue anyway - localStorage is saved
        }
      }
      
      notifySuccess(keyToSave ? t("settingsYouTubeKeySaved") : t("settingsYouTubeKeyRemoved"));
      setYoutubeTestResult(null);
      // Cacher la zone de config après sauvegarde réussie
      if (keyToSave) {
        setShowYouTubeConfig(false);
      } else {
        setShowYouTubeConfig(true);
      }
    } catch (err) {
      console.error("Failed to save YouTube API key:", err);
      notifyError(t("settingsYouTubeKeySaveError"));
    } finally {
      setSavingYouTube(false);
    }
  };

  // Save Cloudinary config
  const handleSaveCloudinary = async () => {
    if (!cloudinaryForm.cloudName || !cloudinaryForm.uploadPreset) {
      notifyError(t("settingsCloudinaryMissingFields"));
      return;
    }
    
    setSavingCloudinary(true);
    try {
      saveCloudinaryConfig({
        cloudName: cloudinaryForm.cloudName,
        apiKey: cloudinaryForm.apiKey,
        uploadPreset: cloudinaryForm.uploadPreset,
      });
      notifySuccess(t("settingsCloudinaryConfigSaved"));
    } catch (err) {
      notifyError(t("settingsCloudinaryConfigError"));
    } finally {
      setSavingCloudinary(false);
    }
  };

  // Clear Cloudinary config
  const handleClearCloudinary = () => {
    clearCloudinaryConfig();
    setCloudinaryForm({ cloudName: "", apiKey: "", uploadPreset: "" });
    notifySuccess(t("settingsCloudinaryConfigDeleted"));
  };

  // Google Sign In
  const handleGoogleSignIn = async () => {
    // Check if Google OAuth Client ID is configured
    const clientId = await authService.getGoogleClientId();
    if (!clientId) {
      toast.error(t("settingsGoogleOAuthNotConfigured"), {
        description: t("settingsGoogleOAuthNotConfiguredDescription"),
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

  // Handle cleanup of orphaned references
  const handleCleanupOrphaned = async () => {
    try {
      const result = await cleanupMissing();
      if (result) {
        toast.success(t("settingsCleanupDoneTitle"), {
          description: t("settingsCleanupDoneDescription", {
            removed: result.removed,
            remaining: result.remaining,
          }),
        });
      }
    } catch (error) {
      console.error("Cleanup error:", error);
      toast.error(t("settingsCleanupError"));
    }
  };

  // Handle upgrade to pro
  const handleUpgradeToPro = async () => {
    if (!stripeInitialized) {
      toast.error(t("settingsStripeNotConfigured"), {
        description: t("settingsStripePublishableKeyMissing"),
      });
      return;
    }
    await nexusUpgradeToPro();
  };

  // Handle manage billing
  const handleManageBilling = async () => {
    if (!stripeInitialized) {
      toast.error(t("settingsStripeNotConfigured"));
      return;
    }
    if (!nexusAuthenticated) {
      toast.error(t("settingsSignInFirst"));
      return;
    }
    try {
      setSubscriptionLoading(true);
      await nexusManageBilling();
    } catch (error: unknown) {
      console.error("Manage billing error:", error);
      const err = error as { message?: string };
      const errorMessage = err.message || t("settingsBillingPortalAccessError");
      
      // Check if it's a portal configuration error
      if (errorMessage.includes("Billing Portal") || errorMessage.includes("portal")) {
        toast.error(t("settingsBillingPortalNotConfigured"), {
          description: t("settingsBillingPortalNotConfiguredDescription"),
        });
      } else {
        toast.error(t("settingsBillingPortalError"), { description: errorMessage });
      }
    } finally {
      setSubscriptionLoading(false);
    }
  };

  // Handle upgrade to monthly
  const handleUpgradeMonthly = async () => {
    if (!stripeInitialized) {
      toast.error(t("settingsStripeNotConfigured"));
      return;
    }
    if (!nexusAuthenticated) {
      toast.error(t("settingsSignInFirst"));
      return;
    }
    try {
      setSubscriptionLoading(true);
      
      // Ensure Stripe config is loaded and wait for it
      await stripeService.ensureInitialized();
      
      // Small delay to ensure config is fully loaded
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Get the actual price ID after config is loaded
      const monthlyPriceId = PRICE_IDS.PRO_MONTHLY;
      
      console.log('[SettingsView] Monthly price ID:', monthlyPriceId);
      
      // Validate that we have a real price ID (not the default fallback)
      if (monthlyPriceId === 'price_pro_monthly' || !monthlyPriceId.startsWith('price_')) {
        console.error('[SettingsView] Invalid price ID:', monthlyPriceId);
        toast.error(t("settingsStripeConfigIncomplete"), {
          description: t("settingsStripePriceIdMissing", { value: monthlyPriceId }),
        });
        return;
      }
      
      toast.info(t("settingsStripeRedirecting"));
      await stripeService.redirectToCheckout(monthlyPriceId);
    } catch (error: any) {
      console.error("Upgrade error:", error);
      toast.error(t("settingsBillingPortalError"), { description: error.message });
    } finally {
      setSubscriptionLoading(false);
    }
  };

  // Handle upgrade to yearly
  const handleUpgradeYearly = async () => {
    if (!stripeInitialized) {
      toast.error(t("settingsStripeNotConfigured"));
      return;
    }
    if (!nexusAuthenticated) {
      toast.error(t("settingsSignInFirst"));
      return;
    }
    try {
      setSubscriptionLoading(true);
      
      // Ensure Stripe config is loaded
      await stripeService.ensureInitialized();
      
      // Get the actual price ID
      const yearlyPriceId = PRICE_IDS.PRO_YEARLY;
      
      // Validate that we have a real price ID (not the default fallback)
      if (yearlyPriceId === 'price_pro_yearly' || !yearlyPriceId.startsWith('price_')) {
        toast.error(t("settingsStripeConfigIncomplete"), {
          description: t("settingsStripePriceIdMissingYearly"),
        });
        return;
      }
      
      toast.info(t("settingsStripeRedirecting"));
      await stripeService.redirectToCheckout(yearlyPriceId);
    } catch (error: any) {
      console.error("Upgrade error:", error);
      toast.error(t("settingsBillingPortalError"), { description: error.message });
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
    const themeLabel = themeOptions.find((option) => option.id === newTheme)?.label ?? newTheme;
    notifySuccess(t("settingsThemeApplied", { theme: themeLabel }));
  };

  if (loading) {
    return <SettingsViewSkeleton />;
  }

  return (
    <div className="h-full min-h-0 w-full overflow-hidden flex flex-col animate-in fade-in duration-200">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/50 border-b border-border/30">
        <div className="px-6 py-4">
          <h1 className="font-display text-2xl font-bold text-foreground">{t("settingsTitle")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("settingsSubtitle")}</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="audio" className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6">
          <TabsList className="bg-muted/30 p-1 h-auto">
            <TabsTrigger value="audio" className="gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Volume2 className="w-4 h-4" />
              {t("settingsTabAudio")}
            </TabsTrigger>
            <TabsTrigger value="library" className="gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Music className="w-4 h-4" />
              {t("settingsTabLibrary")}
            </TabsTrigger>
            <TabsTrigger value="appearance" className="gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Palette className="w-4 h-4" />
              {t("settingsTabAppearance")}
            </TabsTrigger>
            <TabsTrigger value="cloud" className="gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Cloud className="w-4 h-4" />
              {t("settingsTabCloud")}
            </TabsTrigger>
            <TabsTrigger value="subscription" className="gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Crown className="w-4 h-4" />
              {t("settingsTabSubscription")}
            </TabsTrigger>
            <TabsTrigger value="account" className="gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <User className="w-4 h-4" />
              {t("settingsTabAccount")}
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {/* Audio Tab */}
          <TabsContent value="audio" className="mt-6 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SettingsCard title={t("settingsCardPlayback")} icon={Volume2}>
                <SettingRow 
                  label={t("settingsAudioCrossfadeLabel")} 
                  description={t("settingsAudioCrossfadeDescription")}
                  helpText={t("settingsAudioCrossfadeHelp")}
                  helpTitle={t("settingsAudioCrossfadeLabel")}
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
                          onValueChange={(v) => updateSetting("crossfadeDuration", v[0])}
                          className="w-20"
                        />
                        <span className="text-xs text-muted-foreground w-6">
                          {settings.crossfadeDuration}s
                        </span>
                      </>
                    )}
                  </div>
                </SettingRow>
                <SettingRow 
                  label={t("settingsAudioGaplessLabel")} 
                  description={t("settingsAudioGaplessDescription")}
                  helpText={t("settingsAudioGaplessHelp")}
                >
                  <Switch checked={settings.gaplessPlayback} onCheckedChange={(v) => updateSetting("gaplessPlayback", v)} />
                </SettingRow>
                <SettingRow 
                  label={t("settingsAudioNormalizeLabel")} 
                  description={t("settingsAudioNormalizeDescription")}
                  helpText={t("settingsAudioNormalizeHelp")}
                >
                  <Switch checked={settings.normalizeVolume} onCheckedChange={(v) => updateSetting("normalizeVolume", v)} />
                </SettingRow>
                <SettingRow 
                  label={t("settingsAudioEqualizerLabel")} 
                  description={t("settingsAudioEqualizerDescription")}
                  helpText={t("settingsAudioEqualizerHelp")}
                >
                  <Switch checked={settings.equalizerEnabled} onCheckedChange={(v) => updateSetting("equalizerEnabled", v)} />
                </SettingRow>
              </SettingsCard>

              <SettingsCard title={t("settingsCardLyrics")} icon={Mic2}>
                <SettingRow 
                  label={t("settingsLyricsShowLabel")} 
                  description={t("settingsLyricsShowDescription")}
                  helpText={t("settingsLyricsShowHelp")}
                >
                  <Switch checked={settings.showLyrics} onCheckedChange={(v) => updateSetting("showLyrics", v)} />
                </SettingRow>
                <SettingRow 
                  label={t("settingsLyricsSyncedLabel")} 
                  description={t("settingsLyricsSyncedDescription")}
                  helpText={t("settingsLyricsSyncedHelp")}
                >
                  <Switch checked={settings.showLyrics} disabled />
                  <span className="text-xs text-muted-foreground ml-2">{t("settingsLyricsAlwaysOn")}</span>
                </SettingRow>
              </SettingsCard>

              <SettingsCard title={t("settingsCardScrobbling")} icon={Sparkles} className="lg:col-span-2">
                <SettingRow 
                  label={t("settingsScrobblingEnableLabel")} 
                  description={t("settingsScrobblingEnableDescription")}
                  helpText={t("settingsScrobblingEnableHelp")}
                >
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
                          <p className="text-xs text-muted-foreground">{t("settingsScrobblingNotConnected")}</p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant={scrobblerStatus.lastFm.connected ? "outline" : "default"}
                      size="sm"
                      onClick={scrobblerStatus.lastFm.connected ? () => handleDisconnectScrobbler("lastfm") : handleConnectLastFm}
                      disabled={!isElectron}
                    >
                      {scrobblerStatus.lastFm.connected ? t("settingsScrobblingDisconnect") : t("settingsScrobblingConnect")}
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
                          <p className="text-xs text-muted-foreground">{t("settingsScrobblingNotConnected")}</p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant={scrobblerStatus.libreFm.connected ? "outline" : "default"}
                      size="sm"
                      onClick={scrobblerStatus.libreFm.connected ? () => handleDisconnectScrobbler("librefm") : handleConnectLibreFm}
                      disabled={!isElectron}
                    >
                      {scrobblerStatus.libreFm.connected ? t("settingsScrobblingDisconnect") : t("settingsScrobblingConnect")}
                    </Button>
                  </div>
                </div>
              </SettingsCard>
            </div>
          </TabsContent>

          {/* Library Tab */}
          <TabsContent value="library" className="mt-6 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SettingsCard title={t("settingsCardMusicFolders")} icon={FolderOpen} className="lg:col-span-2">
                <div className="space-y-3">
                  {(settings.musicDirectories || []).length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">{t("settingsLibraryEmptyTitle")}</p>
                      <p className="text-xs mt-1">{t("settingsLibraryEmptyDescription")}</p>
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
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-out"
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
                      {t("settingsLibraryAddFolder")}
                    </Button>
                    <Button variant="default" size="sm" onClick={handleScanLibrary} disabled={scanning || (settings.musicDirectories || []).length === 0}>
                      <RefreshCw className={cn("w-4 h-4 mr-2", scanning && "animate-spin")} />
                      {scanning ? t("settingsLibraryScanInProgress") : t("settingsLibraryScan")}
                    </Button>
                  </div>
                </div>

                {/* Scan progress */}
                {scanning && scanProgress && (
                  <div className="mt-4 space-y-3">
                    <div className="p-4 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                      <div className="flex items-center justify-between text-sm mb-3">
                        <div className="flex items-center gap-2">
                          <div className="relative flex items-center justify-center">
                            <RefreshCw className="w-4 h-4 text-primary animate-spin" />
                          </div>
                          <span className="font-medium text-foreground">
                            {scanProgress.phase === "scanning" ? t("settingsLibraryScanPhaseScanning") : 
                             scanProgress.phase === "extracting" ? t("settingsLibraryScanPhaseExtracting") : 
                             scanProgress.phase === "indexing" ? t("settingsLibraryScanPhaseIndexing") : t("settingsLibraryScanPhaseDone")}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-primary font-mono font-semibold">{scanProgress.current} / {scanProgress.total}</span>
                          <span className="text-xs text-muted-foreground">
                            {scanProgress.total > 0 ? `${Math.round((scanProgress.current / scanProgress.total) * 100)}%` : '0%'}
                          </span>
                        </div>
                      </div>
                      
                      <Progress 
                        value={scanProgress.total > 0 ? (scanProgress.current / scanProgress.total) * 100 : 0} 
                        className="h-2 mb-3" 
                      />
                      
                      {scanProgress.file && (
                        <div className="flex items-center gap-2 text-xs">
                          <Music className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                          <p className="text-muted-foreground truncate">{scanProgress.file}</p>
                        </div>
                      )}
                    </div>
                    
                    {/* Statistiques temps réel */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div className="p-3 rounded-lg bg-card border border-border/50">
                        <p className="text-xs text-muted-foreground mb-1">{t("settingsLibraryFilesFound")}</p>
                        <p className="text-lg font-bold text-foreground">{scanProgress.total}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-card border border-border/50">
                        <p className="text-xs text-muted-foreground mb-1">{t("settingsLibraryFilesProcessed")}</p>
                        <p className="text-lg font-bold text-primary">{scanProgress.current}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-card border border-border/50">
                        <p className="text-xs text-muted-foreground mb-1">{t("settingsLibraryFilesRemaining")}</p>
                        <p className="text-lg font-bold text-orange-500">{Math.max(0, scanProgress.total - scanProgress.current)}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-card border border-border/50">
                        <p className="text-xs text-muted-foreground mb-1">{t("settingsLibraryPhase")}</p>
                        <p className="text-sm font-semibold text-foreground capitalize">
                          {scanProgress.phase === "scanning" ? t("settingsLibraryScanPhaseLabelScanning") : 
                           scanProgress.phase === "extracting" ? t("settingsLibraryScanPhaseLabelExtracting") : 
                           scanProgress.phase === "indexing" ? t("settingsLibraryScanPhaseLabelIndexing") : t("settingsLibraryScanPhaseLabelDone")}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </SettingsCard>

              <SettingsCard title={t("settingsCardLibraryStats")} icon={HardDrive}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t("settingsLibraryStatsTracks")}</span>
                    <span className="text-sm font-mono text-foreground font-semibold">{tracks.length.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t("settingsLibraryStatsAlbums")}</span>
                    <span className="text-sm font-mono text-foreground">{new Set(tracks.map(t => t.album)).size.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t("settingsLibraryStatsArtists")}</span>
                    <span className="text-sm font-mono text-foreground">{new Set(tracks.map(t => t.artist)).size.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <span className="text-sm text-muted-foreground">{t("settingsLibraryStatsGenres")}</span>
                    <span className="text-sm font-mono text-foreground">{new Set(tracks.filter(t => t.genre).map(t => t.genre)).size.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t("settingsLibraryStatsTotalSize")}</span>
                    <span className="text-sm font-mono text-foreground">
                      {(() => {
                        const totalBytes = tracks.reduce((sum, t) => sum + (t.fileSize || 0), 0);
                        const gb = totalBytes / (1024 * 1024 * 1024);
                        return gb >= 1
                          ? `${gb.toFixed(2)} ${t("settingsLibraryUnitGB")}`
                          : `${(totalBytes / (1024 * 1024)).toFixed(0)} ${t("settingsLibraryUnitMB")}`;
                      })()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t("settingsLibraryStatsTotalDuration")}</span>
                    <span className="text-sm font-mono text-foreground">
                      {(() => {
                        const totalSeconds = tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
                        const hours = Math.floor(totalSeconds / 3600);
                        const minutes = Math.floor((totalSeconds % 3600) / 60);
                        return hours > 0
                          ? t("settingsLibraryDurationHoursMinutes", { hours, minutes })
                          : t("settingsLibraryDurationMinutes", { minutes });
                      })()}
                    </span>
                  </div>
                </div>
              </SettingsCard>

              <SettingsCard title={t("settingsCardScanOptions")} icon={Music}>
                <SettingRow
                  label={t("settingsLibraryScanOnStartupLabel")}
                  description={t("settingsLibraryScanOnStartupDescription")}
                >
                  <Switch checked={settings.autoScanOnStartup} onCheckedChange={(v) => updateSetting("autoScanOnStartup", v)} />
                </SettingRow>
                <SettingRow
                  label={t("settingsLibraryWatchFoldersLabel")}
                  description={t("settingsLibraryWatchFoldersDescription")}
                >
                  <Switch checked={false} disabled />
                  <span className="text-xs text-muted-foreground ml-2">{t("settingsComingSoon")}</span>
                </SettingRow>
              </SettingsCard>

              <SettingsCard title={t("settingsCardAdvancedTools")} icon={Sparkles} className="lg:col-span-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Analyse de qualité */}
                  <div className="p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-blue-500" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm">{t("settingsAdvancedQualityTitle")}</h4>
                        <p className="text-xs text-muted-foreground">{t("settingsAdvancedQualitySubtitle")}</p>
                      </div>
                    </div>
                    <div className="space-y-2 text-xs text-muted-foreground mb-3">
                      <div className="flex items-center justify-between">
                        <span>{t("settingsAdvancedQualityHigh")}</span>
                        <span className="font-mono text-foreground">
                          {tracks.filter(t => (t.bitrate || 0) >= 320).length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>{t("settingsAdvancedQualityMedium")}</span>
                        <span className="font-mono text-foreground">
                          {tracks.filter(t => (t.bitrate || 0) >= 128 && (t.bitrate || 0) < 320).length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>{t("settingsAdvancedQualityLow")}</span>
                        <span className="font-mono text-orange-500">
                          {tracks.filter(t => (t.bitrate || 0) > 0 && (t.bitrate || 0) < 128).length}
                        </span>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full" 
                      onClick={analyzeQuality}
                      disabled={qualityLoading}
                    >
                      {qualityLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          {t("settingsAdvancedAnalyzeInProgress")}
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          {t("settingsAdvancedAnalyzeQuality")}
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Détection de doublons */}
                  <div className="p-4 rounded-lg bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                        <Copy className="w-5 h-5 text-purple-500" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm">{t("settingsAdvancedDuplicatesTitle")}</h4>
                        <p className="text-xs text-muted-foreground">{t("settingsAdvancedDuplicatesSubtitle")}</p>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mb-3">
                      <p>{t("settingsAdvancedDuplicatesIntro")}</p>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        <li>{t("settingsAdvancedDuplicatesCriteria1")}</li>
                        <li>{t("settingsAdvancedDuplicatesCriteria2")}</li>
                        <li>{t("settingsAdvancedDuplicatesCriteria3")}</li>
                      </ul>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full" 
                      onClick={detectDuplicates}
                      disabled={duplicatesLoading}
                    >
                      {duplicatesLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          {t("settingsAdvancedDuplicatesSearching")}
                        </>
                      ) : (
                        <>
                          <Search className="w-4 h-4 mr-2" />
                          {t("settingsAdvancedDuplicatesSearch")}
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Fichiers manquants */}
                  <div className="p-4 rounded-lg bg-gradient-to-br from-orange-500/10 to-orange-500/5 border border-orange-500/20">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                        <AlertCircle className="w-5 h-5 text-orange-500" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm">{t("settingsAdvancedMissingFilesTitle")}</h4>
                        <p className="text-xs text-muted-foreground">{t("settingsAdvancedMissingFilesSubtitle")}</p>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mb-3">
                      <p>{t("settingsAdvancedMissingFilesDescription")}</p>
                      <p className="mt-1 text-orange-500">{t("settingsAdvancedMissingFilesCleanupNote")}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1" 
                        onClick={checkIntegrity}
                        disabled={integrityLoading}
                      >
                        {integrityLoading ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            {t("settingsAdvancedIntegrityChecking")}
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            {t("settingsAdvancedIntegrityCheck")}
                          </>
                        )}
                      </Button>
                      {integrityResult && integrityResult.stats.missing > 0 && (
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          className="flex-1"
                          onClick={cleanupMissing}
                          disabled={cleanupLoading}
                        >
                          {cleanupLoading ? (
                            <>
                              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                              {t("settingsAdvancedIntegrityCleaning")}
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-4 h-4 mr-2" />
                              {t("settingsAdvancedIntegrityCleanup", {
                                count: integrityResult.stats.missing,
                              })}
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Métadonnées manquantes */}
                  <div className="p-4 rounded-lg bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                        <Tag className="w-5 h-5 text-green-500" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm">{t("settingsAdvancedMetadataTitle")}</h4>
                        <p className="text-xs text-muted-foreground">{t("settingsAdvancedMetadataSubtitle")}</p>
                      </div>
                    </div>
                    <div className="space-y-2 text-xs text-muted-foreground mb-3">
                      <div className="flex items-center justify-between">
                        <span>{t("settingsAdvancedMetadataMissingCover")}</span>
                        <span className="font-mono text-foreground">
                          {tracks.filter(t => !t.coverUrl).length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>{t("settingsAdvancedMetadataMissingGenre")}</span>
                        <span className="font-mono text-foreground">
                          {tracks.filter(t => !t.genre).length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>{t("settingsAdvancedMetadataMissingYear")}</span>
                        <span className="font-mono text-foreground">
                          {tracks.filter(t => !t.year).length}
                        </span>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full" 
                      onClick={analyzeMetadata}
                      disabled={metadataLoading}
                    >
                      {metadataLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          {t("settingsAdvancedMetadataAnalyzing")}
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-2" />
                          {t("settingsAdvancedMetadataAnalyze")}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </SettingsCard>

              <RecognitionCard tracks={tracks} refreshLibrary={refreshLibrary} />

              {/* Quality Analysis Results */}
              {qualityAnalysis && (
                <SettingsCard title={t("settingsCardQualityResults")} icon={Sparkles} className="lg:col-span-2">
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                      <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                        <p className="text-xs text-muted-foreground">{t("settingsQualityHigh")}</p>
                        <p className="text-lg font-bold text-green-500">{qualityAnalysis.stats.highQualityCount}</p>
                        <p className="text-xs text-muted-foreground">≥ 320 kbps</p>
                      </div>
                      <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <p className="text-xs text-muted-foreground">{t("settingsQualityMedium")}</p>
                        <p className="text-lg font-bold text-blue-500">{qualityAnalysis.stats.mediumQualityCount}</p>
                        <p className="text-xs text-muted-foreground">128-320 kbps</p>
                      </div>
                      <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                        <p className="text-xs text-muted-foreground">{t("settingsQualityLow")}</p>
                        <p className="text-lg font-bold text-orange-500">{qualityAnalysis.stats.lowQualityCount}</p>
                        <p className="text-xs text-muted-foreground">&lt; 128 kbps</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                        <p className="text-xs text-muted-foreground">{t("settingsQualityUnknown")}</p>
                        <p className="text-lg font-bold text-foreground">{qualityAnalysis.stats.unknownCount}</p>
                        <p className="text-xs text-muted-foreground">{t("settingsQualityUnknownBitrate")}</p>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                      <p className="text-sm font-semibold mb-2">
                        {t("settingsQualityAverageBitrate", { value: qualityAnalysis.stats.averageBitrate })}
                      </p>
                      <p className="text-xs text-muted-foreground">{t("settingsQualityFormatsDetected")}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {Object.entries(qualityAnalysis.stats.formats).map(([format, count]) => (
                          <span key={format} className="text-xs bg-primary/10 px-2 py-1 rounded">
                            {format}: {count}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </SettingsCard>
              )}

              {/* Integrity Check Results */}
              {integrityResult && (
                <SettingsCard title={t("settingsCardIntegrityResults")} icon={Check} className="lg:col-span-2">
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                        <p className="text-xs text-muted-foreground">{t("settingsIntegrityValidFiles")}</p>
                        <p className="text-lg font-bold text-green-500">{integrityResult.stats.valid}</p>
                        <p className="text-xs text-muted-foreground">{integrityResult.stats.percentage}%</p>
                      </div>
                      <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                        <p className="text-xs text-muted-foreground">{t("settingsIntegrityMissingFiles")}</p>
                        <p className="text-lg font-bold text-red-500">{integrityResult.stats.missing}</p>
                        <p className="text-xs text-muted-foreground">{100 - integrityResult.stats.percentage}%</p>
                      </div>
                      <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <p className="text-xs text-muted-foreground">{t("settingsIntegrityTotal")}</p>
                        <p className="text-lg font-bold text-blue-500">{integrityResult.totalTracks}</p>
                        <p className="text-xs text-muted-foreground">{t("settingsIntegrityTracksLabel")}</p>
                      </div>
                    </div>
                    {integrityResult.missingFiles.length > 0 && (
                      <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                        <p className="text-sm font-semibold text-red-500 mb-2">
                          {t("settingsIntegrityMissingFilesTitle", {
                            count: integrityResult.missingFiles.length,
                          })}
                        </p>
                        <div className="max-h-32 overflow-y-auto">
                          <ul className="text-xs space-y-1">
                            {integrityResult.missingFiles.slice(0, 5).map((track) => (
                              <li key={track.id} className="text-muted-foreground truncate">
                                • {track.title} - {track.artist}
                              </li>
                            ))}
                            {integrityResult.missingFiles.length > 5 && (
                              <li className="text-muted-foreground italic">
                                {t("settingsIntegrityMoreMissing", {
                                  count: integrityResult.missingFiles.length - 5,
                                })}
                              </li>
                            )}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                </SettingsCard>
              )}

              {/* Metadata Analysis Results */}
              {metadataReport && (
                <SettingsCard title={t("settingsCardMetadataCompleteness")} icon={Tag} className="lg:col-span-2">
                  <div className="space-y-3">
                    <div className="relative h-2 rounded-full bg-muted/30 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all"
                        style={{ width: `${metadataReport.stats.completionPercentage}%` }}
                      />
                    </div>
                    <p className="text-sm text-center font-semibold text-foreground">
                      {t("settingsMetadataCompletion", {
                        percentage: metadataReport.stats.completionPercentage,
                      })}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                        <p className="text-xs text-muted-foreground">{t("settingsMetadataMissingCover")}</p>
                        <p className="text-lg font-bold text-yellow-500">{metadataReport.stats.missingCover}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                        <p className="text-xs text-muted-foreground">{t("settingsMetadataMissingGenre")}</p>
                        <p className="text-lg font-bold text-purple-500">{metadataReport.stats.missingGenre}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-pink-500/10 border border-pink-500/20">
                        <p className="text-xs text-muted-foreground">{t("settingsMetadataMissingYear")}</p>
                        <p className="text-lg font-bold text-pink-500">{metadataReport.stats.missingYear}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                        <p className="text-xs text-muted-foreground">{t("settingsMetadataMissingArtist")}</p>
                        <p className="text-lg font-bold text-indigo-500">{metadataReport.stats.missingArtist}</p>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                      <p className="text-sm font-semibold text-green-500">
                        {t("settingsMetadataCompleteTracks", {
                          count: metadataReport.stats.complete,
                          suffix: metadataReport.stats.complete > 1 ? "s" : "",
                        })}
                      </p>
                    </div>
                  </div>
                </SettingsCard>
              )}

              {/* Duplicate Results */}
              {duplicates && duplicates.length > 0 && (
                <SettingsCard title={t("settingsCardDuplicatesDetected")} icon={Copy} className="lg:col-span-2">
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {t("settingsDuplicatesGroupsDetected", {
                        count: duplicates.length,
                        suffix: duplicates.length > 1 ? "s" : "",
                      })}
                    </p>
                    {duplicates.map((group, idx) => (
                      <div key={idx} className="p-3 rounded-lg bg-muted/30 border border-border/50">
                        <p className="text-xs font-semibold text-muted-foreground mb-2">
                          {group.reason === 'exact-match'
                            ? t("settingsDuplicatesReasonExact")
                            : group.reason === 'similar-duration'
                              ? t("settingsDuplicatesReasonSimilarDuration")
                              : t("settingsDuplicatesReasonSimilarTitleArtist")} {t("settingsDuplicatesConfidence", { value: group.confidence })}
                        </p>
                        <ul className="space-y-1">
                          {group.tracks.map((track) => (
                            <li key={track.id} className="text-xs text-foreground">
                              {track.title} - {track.artist}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </SettingsCard>
              )}
            </div>
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance" className="mt-6 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SettingsCard title={t("settingsCardTheme")} icon={Palette}>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  {themeOptions.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleThemeChange(t.id)}
                      className={cn(
                        "p-4 rounded-xl border-2 transition-all duration-200 ease-out active:scale-95",
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

              <SettingsCard title={t("settingsCardNotifications")} icon={Bell}>
                <SettingRow
                  label={t("settingsNotificationsDesktopLabel")}
                  description={t("settingsNotificationsDesktopDescription")}
                >
                  <Switch 
                    checked={notificationsEnabled} 
                    onCheckedChange={(v) => {
                      setNotificationsEnabled(v);
                      if (v) notifySuccess(t("settingsNotificationsEnabled"));
                      else notifySuccess(t("settingsNotificationsDisabled"));
                    }} 
                  />
                </SettingRow>
                <SettingRow
                  label={t("settingsNotificationsSoundLabel")}
                  description={t("settingsNotificationsSoundDescription")}
                >
                  <Switch checked={false} disabled />
                  <span className="text-xs text-muted-foreground ml-2">{t("settingsComingSoon")}</span>
                </SettingRow>
                <div className="mt-3 pt-3 border-t border-border/30">
                  <p className="text-xs text-muted-foreground">
                    {t("settingsNotificationsHistoryHint")}
                  </p>
                </div>
              </SettingsCard>

              <SettingsCard title={t("settingsCardShortcuts")} icon={Keyboard} className="lg:col-span-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                  {[
                    { action: t("settingsShortcutPlayPause"), shortcut: t("settingsShortcutKeySpace") },
                    { action: t("settingsShortcutNextTrack"), shortcut: t("settingsShortcutKeyCtrlRight") },
                    { action: t("settingsShortcutPrevTrack"), shortcut: t("settingsShortcutKeyCtrlLeft") },
                    { action: t("settingsShortcutVolumeUp"), shortcut: t("settingsShortcutKeyCtrlUp") },
                    { action: t("settingsShortcutVolumeDown"), shortcut: t("settingsShortcutKeyCtrlDown") },
                    { action: t("settingsShortcutMute"), shortcut: t("settingsShortcutKeyCtrlM") },
                    { action: t("settingsShortcutFullscreen"), shortcut: t("settingsShortcutKeyF11") },
                    { action: t("settingsShortcutClose"), shortcut: t("settingsShortcutKeyEsc") },
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
              <SettingsCard title={t("settingsCardCloudinary")} icon={Cloud}>
                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <p className="text-sm text-blue-400 flex items-center gap-2">
                      <Info className="w-4 h-4" />
                      {t("settingsCloudinaryPublicServer")}
                      <Crown className="w-3.5 h-3.5 text-amber-400" />
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("settingsCloudinaryFreeStorageHint")}
                    </p>
                  </div>
                  
                  {cloudinaryConfigured ? (
                    <div className="space-y-3">
                      <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                        <p className="text-sm text-green-400 flex items-center gap-2">
                          <Check className="w-4 h-4" />
                          {t("settingsCloudinaryConfigured", { name: cloudinaryConfig?.cloudName || "" })}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" className="w-full" onClick={handleClearCloudinary}>
                        <X className="w-4 h-4 mr-2" />
                        {t("settingsCloudinaryRemoveConfig")}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs">{t("settingsCloudinaryCloudNameLabel")}</Label>
                        <Input
                          value={cloudinaryForm.cloudName}
                          onChange={(e) => setCloudinaryForm(prev => ({ ...prev, cloudName: e.target.value }))}
                          placeholder={t("settingsCloudinaryCloudNamePlaceholder")}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">{t("settingsCloudinaryApiKeyLabel")}</Label>
                        <div className="relative mt-1">
                          <Input
                            type={showCloudinaryKey ? "text" : "password"}
                            value={cloudinaryForm.apiKey}
                            onChange={(e) => setCloudinaryForm(prev => ({ ...prev, apiKey: e.target.value }))}
                            placeholder={t("settingsCloudinaryApiKeyPlaceholder")}
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
                        <Label className="text-xs">{t("settingsCloudinaryUploadPresetLabel")}</Label>
                        <Input
                          value={cloudinaryForm.uploadPreset}
                          onChange={(e) => setCloudinaryForm(prev => ({ ...prev, uploadPreset: e.target.value }))}
                          placeholder={t("settingsCloudinaryUploadPresetPlaceholder")}
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
                        {t("settingsSave")}
                      </Button>
                    </div>
                  )}
                </div>
              </SettingsCard>

              {/* YouTube API */}
              <SettingsCard title={t("settingsCardYouTubeApi")} icon={Youtube}>
                <div className="space-y-4">
                  {youtubeApiKey && !showYouTubeConfig ? (
                    // Affichage compact quand la clé est configurée
                    <div className="space-y-3">
                      <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                        <p className="text-sm text-green-400 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" />
                          {t("settingsYouTubeKeyConfigured")}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t("settingsYouTubeSearchEnabled")}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => setShowYouTubeConfig(true)}
                      >
                        <Youtube className="w-4 h-4 mr-2" />
                        {t("settingsYouTubeEditKey")}
                      </Button>
                    </div>
                  ) : (
                    // Formulaire complet de configuration
                    <>
                      <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                        <p className="text-sm text-red-400 flex items-center gap-2">
                          <Info className="w-4 h-4" />
                          {t("settingsYouTubeFreeQuota")}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t("settingsYouTubeRequired")}
                        </p>
                      </div>

                      <div className="space-y-3">
                    {/* Indicateur si clé déjà configurée */}
                    {youtubeApiKey && (
                      <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                        <p className="text-sm text-green-400 flex items-center gap-2">
                          <Check className="w-4 h-4" />
                          {t("settingsYouTubeKeyConfiguredShort")}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t("settingsYouTubeSearchEnabled")}
                        </p>
                      </div>
                    )}
                    
                    <div>
                      <Label className="text-xs">{t("settingsYouTubeKeyLabel")}</Label>
                      <div className="relative mt-1">
                        <Input
                          type={showYouTubeKey ? "text" : "password"}
                          value={youtubeApiKey}
                          onChange={(e) => {
                            setYoutubeApiKey(e.target.value);
                            setYoutubeTestResult(null); // Réinitialiser le résultat du test
                          }}
                          placeholder={t("settingsYouTubeKeyPlaceholder")}
                          className="font-mono text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowYouTubeKey(!showYouTubeKey)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showYouTubeKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        {t("settingsYouTubeGetKeyIntro")}{" "}
                        <a
                          href="https://console.cloud.google.com/apis/credentials"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          {t("settingsYouTubeGoogleConsole")}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </p>
                      
                      {/* Résultat du test */}
                      {youtubeTestResult && (
                        <div className={cn(
                          "mt-2 p-2 rounded text-xs",
                          youtubeTestResult.success
                            ? "bg-green-500/10 border border-green-500/20 text-green-400"
                            : "bg-destructive/10 border border-destructive/20 text-destructive"
                        )}>
                          {youtubeTestResult.success ? (
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{youtubeTestResult.message}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <AlertCircle className="w-3 h-3" />
                              <span>{youtubeTestResult.message}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                      <p className="text-xs font-medium mb-2">{t("settingsYouTubeInstructionsTitle")}</p>
                      <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                        <li>{t("settingsYouTubeInstructionsStep1")}</li>
                        <li>{t("settingsYouTubeInstructionsStep2")}</li>
                        <li>{t("settingsYouTubeInstructionsStep3")}</li>
                        <li>{t("settingsYouTubeInstructionsStep4")}</li>
                      </ol>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1" 
                        onClick={handleTestYouTube}
                        disabled={testingYouTube || !youtubeApiKey.trim()}
                      >
                        {testingYouTube ? (
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Zap className="w-4 h-4 mr-2" />
                        )}
                        {t("settingsTest")}
                      </Button>
                      <Button 
                        variant="default" 
                        size="sm" 
                        className="flex-1" 
                        onClick={handleSaveYouTube}
                        disabled={savingYouTube || !youtubeApiKey.trim()}
                      >
                        {savingYouTube ? (
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4 mr-2" />
                        )}
                        {t("settingsSave")}
                      </Button>
                    </div>
                    
                    {/* Bouton pour supprimer si clé existe */}
                        {youtubeApiKey && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={async () => {
                              setYoutubeApiKey("");
                              localStorage.removeItem("nexus-youtube-api-key");
                              // Supprimer aussi de Firebase
                              if (nexusAuthenticated) {
                                try {
                                  const { firebaseSyncService } = await import('@/services/firebase-sync');
                                  await firebaseSyncService.queueSync('youtubeApiKey', null);
                                } catch (err) {
                                  console.warn("Failed to remove YouTube API key from Firebase:", err);
                                }
                              }
                              setYoutubeTestResult(null);
                              setShowYouTubeConfig(true);
                              notifySuccess(t("settingsYouTubeKeyRemoved"));
                            }}
                          >
                            <X className="w-4 h-4 mr-2" />
                            {t("settingsYouTubeRemoveKey")}
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </SettingsCard>

              {/* Bunny Storage - Pro Only */}
              <SettingsCard title={t("settingsCardBunnyStorage")} icon={Zap}>
                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20">
                    <p className="text-sm text-yellow-400 flex items-center gap-2">
                      <Crown className="w-4 h-4" />
                      {t("settingsBunnyProOnly")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("settingsBunnySubtitle")}
                    </p>
                  </div>

                  {nexusIsPro ? (
                    <div className="space-y-3">
                      {/* Server-side Bunny configuration status */}
                      {bunnyStatusLoading ? (
                        <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-3/4" />
                          </div>
                        </div>
                      ) : bunnyStatus?.configured ? (
                        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                          <p className="text-sm text-green-400 flex items-center gap-2">
                            <Check className="w-4 h-4" />
                            {t("settingsBunnyConfigured")}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {t("settingsBunnyConfiguredHint")}
                          </p>
                        </div>
                      ) : (
                        <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                          <p className="text-sm text-yellow-400 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            {t("settingsBunnyMissingServerConfig")}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {bunnyStatus?.message || t("settingsBunnyMissingServerConfigHint")}
                          </p>
                        </div>
                      )}
                      
                      <div className="space-y-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Check className="w-3 h-3 text-green-500" />
                          {t("settingsBunnyFeatureUploadLimit")}
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="w-3 h-3 text-green-500" />
                          {t("settingsBunnyFeatureGlobalCdn")}
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="w-3 h-3 text-green-500" />
                          {t("settingsBunnyFeatureUnlimited")}
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="w-3 h-3 text-green-500" />
                          {t("settingsBunnyFeatureOptimizedStreaming")}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                        <p className="text-sm text-muted-foreground">
                          {t("settingsBunnyUpgradeHint")}
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
                        {t("settingsUpgradeToPro")}
                      </Button>
                    </div>
                  )}
                </div>
              </SettingsCard>

              {/* Nexus Server with Firebase Auth */}
              <SettingsCard title={t("settingsCardNexusServer")} icon={Shield}>
                <ConfigAlert configured={!!authService.getGoogleClientIdSync()} service="Google OAuth" />
                
                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20">
                    <p className="text-sm text-primary flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      {t("settingsNexusUnlimitedStorage")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("settingsNexusProOnly")}
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
                            {nexusIsPro ? t("settingsPlanPro") : t("settingsPlanFree")}
                          </span>
                        </div>
                      </div>

                      {nexusIsPro ? (
                        <Button variant="outline" size="sm" className="w-full" onClick={handleManageBilling} disabled={!stripeInitialized}>
                          <CreditCard className="w-4 h-4 mr-2" />
                          {t("settingsManageSubscription")}
                        </Button>
                      ) : (
                        <Button variant="default" size="sm" className="w-full" onClick={handleUpgradeToPro} disabled={!stripeInitialized}>
                          <Sparkles className="w-4 h-4 mr-2" />
                          <span className="inline-flex items-center gap-1">
                            {t("settingsUpgradeToProPrice")}
                            <Crown className="w-4 h-4" />
                          </span>
                        </Button>
                      )}

                      <Button variant="ghost" size="sm" className="w-full text-destructive" onClick={handleLogout} disabled={authLoading}>
                        {authLoading ? (
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <LogOut className="w-4 h-4 mr-2" />
                        )}
                        {t("settingsLogout")}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="text-center py-4">
                        <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-3">
                          <User className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">{t("settingsSignInToSync")}</p>
                        
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
                          {t("settingsContinueWithGoogle")}
                        </Button>
                      </div>

                      <div className="border-t border-border/30 pt-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">{t("settingsPlanPro")}</span>
                          <span className="text-xs text-primary">{t("settingsPlanProPrice")}</span>
                        </div>
                        <ul className="space-y-1.5 text-xs text-muted-foreground">
                          <li className="flex items-center gap-2"><Check className="w-3 h-3 text-green-500" /> {t("settingsPlanFeatureUnlimitedStorage")}</li>
                          <li className="flex items-center gap-2"><Check className="w-3 h-3 text-green-500" /> {t("settingsPlanFeatureMultiDeviceSync")}</li>
                          <li className="flex items-center gap-2"><Check className="w-3 h-3 text-green-500" /> {t("settingsPlanFeaturePrioritySupport")}</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </SettingsCard>

              {/* Firebase Sync Status */}
              <SettingsCard title={t("settingsCardFirebaseSync")} icon={Cloud} className="lg:col-span-2">
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-gradient-to-br from-primary/5 to-secondary/5 border border-primary/10">
                    <p className="text-sm text-muted-foreground mb-4">
                      {t("settingsFirebaseSyncDescription")}
                    </p>
                    <SyncStatusIndicator collapsed={false} className="w-full" />
                  </div>
                  
                  {/* Détails du processus */}
                  <div className="p-4 rounded-lg bg-muted/20 space-y-3">
                    <h4 className="text-sm font-medium text-foreground">{t("settingsFirebaseSyncProcessTitle")}</h4>
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <div className="flex items-start gap-2">
                        <div className="w-1 h-1 rounded-full bg-primary/60 mt-1.5" />
                        <div>
                          <span className="font-medium text-foreground">{t("settingsFirebaseSyncDirectionLabel")}</span> {t("settingsFirebaseSyncDirectionValue")}
                          <p className="text-[11px] mt-0.5">{t("settingsFirebaseSyncDirectionHint")}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-1 h-1 rounded-full bg-primary/60 mt-1.5" />
                        <div>
                          <span className="font-medium text-foreground">{t("settingsFirebaseSyncDataLabel")}</span> {t("settingsFirebaseSyncDataValue")}
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-1 h-1 rounded-full bg-primary/60 mt-1.5" />
                        <div>
                          <span className="font-medium text-foreground">{t("settingsFirebaseSyncCheckLabel")}</span> {t("settingsFirebaseSyncCheckValue")}
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-1 h-1 rounded-full bg-primary/60 mt-1.5" />
                        <div>
                          <span className="font-medium text-foreground">{t("settingsFirebaseSyncLogsLabel")}</span> {t("settingsFirebaseSyncLogsValue")}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Résumé sync */}
                  <div className="flex items-center justify-between text-sm px-2 py-1.5 rounded-lg bg-muted/20">
                    <div className="flex items-center gap-4">
                      <span className="text-muted-foreground">
                        <span className="font-mono text-foreground">{syncStatus.tracksUploaded}</span> {t("settingsFirebaseSyncFilesUploaded")}
                      </span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-muted-foreground">
                        <span className="font-mono text-foreground">
                          {Math.round((nexusUser?.storageUsed || 0) / (1024 * 1024))} {t("settingsUnitMB")}
                        </span> {t("settingsFirebaseSyncUsed")}
                      </span>
                    </div>
                    {syncStatus.lastSyncAt && (
                      <span className="text-xs text-muted-foreground">
                        {t("settingsFirebaseSyncLastSync", {
                          time: new Date(syncStatus.lastSyncAt).toLocaleTimeString(
                            locale === "fr" ? "fr-FR" : "en-US"
                          ),
                        })}
                      </span>
                    )}
                  </div>

                  {isUploading && (
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-muted-foreground">{t("settingsFirebaseSyncUploading")}</span>
                        <span className="text-primary font-mono">{overallProgress}%</span>
                      </div>
                      <Progress value={overallProgress} className="h-1.5" />
                    </div>
                  )}
                </div>
              </SettingsCard>
            </div>
          </TabsContent>

          {/* Subscription Tab */}
          <TabsContent value="subscription" className="mt-6 space-y-6">
            {/* Section supérieure moderne */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Carte Plan actuel */}
              <div className="lg:col-span-1">
                <div className="h-full rounded-xl border border-border/50 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm overflow-hidden">
                  <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        <Crown className="w-5 h-5 text-primary" />
                        {t("settingsSubscriptionYourPlan")}
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          if (!nexusAuthenticated) return;
                          setSubscriptionLoading(true);
                          try {
                            const { firebaseService: fbService } = await import('@/services/firebase');
                            const currentUser = fbService.getCurrentUser();
                            if (currentUser && !currentUser.isAnonymous) {
                              const idToken = await fbService.getIdToken();
                              if (idToken) {
                                const syncResponse = await fetch('/api/stripe/sync-profile', {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    Authorization: `Bearer ${idToken}`,
                                  },
                                });
                                
                                if (syncResponse.ok) {
                                  toast.success(t("settingsSubscriptionSyncSuccess"));
                                  await fbService.refreshProfile();
                                  const status = await stripeService.getSubscriptionStatus();
                                  setSubscriptionStatus(status);
                                } else {
                                  const error = await syncResponse.json();
                                  toast.error(t("settingsSubscriptionSyncError"), {
                                    description: error.error || t("settingsSubscriptionSyncErrorDescription"),
                                  });
                                }
                              }
                            }
                          } catch (error) {
                            console.error('Erreur sync:', error);
                            toast.error(t("settingsSubscriptionSyncFailure"));
                          } finally {
                            setSubscriptionLoading(false);
                          }
                        }}
                        disabled={subscriptionLoading || !nexusAuthenticated}
                        className="gap-1.5"
                      >
                        <RefreshCw className={cn("w-3.5 h-3.5", subscriptionLoading && "animate-spin")} />
                        <span className="text-xs">{t("settingsSubscriptionSync")}</span>
                      </Button>
                    </div>

                    {subscriptionLoading ? (
                      <div className="space-y-3 py-4">
                        <Skeleton className="h-6 w-24" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                    ) : subscriptionStatus ? (
                      <>
                        <div className="text-center py-6">
                          <div className={cn(
                            "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-3",
                            subscriptionStatus.isActive && subscriptionStatus.plan === "pro"
                              ? "bg-gradient-to-r from-primary/20 to-secondary/20 text-primary border-2 border-primary/30"
                              : "bg-muted/50 text-muted-foreground border-2 border-border/50"
                          )}>
                            {subscriptionStatus.isActive && subscriptionStatus.plan === "pro" ? (
                              <>
                                <Crown className="w-4 h-4" />
                                {t("settingsPlanPro")}
                              </>
                            ) : (
                              t("settingsPlanFree")
                            )}
                          </div>
                          
                          <div className="mt-4 space-y-2">
                            <div className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-muted/30">
                              <span className="text-muted-foreground">{t("settingsSubscriptionStatusLabel")}</span>
                              <span className={cn(
                                "font-medium flex items-center gap-1.5",
                                subscriptionStatus.status === "active" ? "text-green-500" :
                                subscriptionStatus.status === "canceled" ? "text-red-500" :
                                subscriptionStatus.status === "past_due" ? "text-yellow-500" :
                                "text-muted-foreground"
                              )}>
                                <div className={cn(
                                  "w-2 h-2 rounded-full",
                                  subscriptionStatus.status === "active" ? "bg-green-500" :
                                  subscriptionStatus.status === "canceled" ? "bg-red-500" :
                                  subscriptionStatus.status === "past_due" ? "bg-yellow-500" :
                                  "bg-muted-foreground"
                                )} />
                                {subscriptionStatus.status === "active"
                                  ? t("settingsSubscriptionStatusActive")
                                  : subscriptionStatus.status === "canceled"
                                    ? t("settingsSubscriptionStatusCanceled")
                                    : subscriptionStatus.status === "past_due"
                                      ? t("settingsSubscriptionStatusPastDue")
                                      : subscriptionStatus.status === "trialing"
                                        ? t("settingsSubscriptionStatusTrialing")
                                        : subscriptionStatus.status}
                              </span>
                            </div>
                            
                            {subscriptionStatus.isActive && subscriptionStatus.currentPeriodEnd && (
                              <>
                                <div className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-muted/30">
                                  <span className="text-muted-foreground flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5" />
                                    {t("settingsSubscriptionRenewal")}
                                  </span>
                                  <span className="font-medium text-xs">
                                    {new Date(subscriptionStatus.currentPeriodEnd).toLocaleDateString(
                                      locale === "fr" ? "fr-FR" : "en-US",
                                      {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric"
                                      }
                                    )}
                                  </span>
                                </div>
                                
                                <div className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-primary/5">
                                  <span className="text-muted-foreground">{t("settingsSubscriptionDaysLeft")}</span>
                                  <span className="font-bold text-primary">
                                    {t("settingsSubscriptionDaysValue", {
                                      count: Math.ceil(
                                        (new Date(subscriptionStatus.currentPeriodEnd).getTime() - Date.now()) /
                                          (1000 * 60 * 60 * 24)
                                      ),
                                    })}
                                  </span>
                                </div>
                              </>
                            )}
                            
                            {subscriptionStatus.cancelAtPeriodEnd && (
                              <div className="flex items-center gap-2 text-xs text-yellow-600 bg-yellow-500/10 p-3 rounded-lg border border-yellow-500/20 mt-3">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                <span>{t("settingsSubscriptionCancelAtPeriodEnd")}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {subscriptionStatus.isActive && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full mt-4"
                            onClick={handleManageBilling}
                            disabled={subscriptionLoading}
                          >
                            <CreditCard className="w-4 h-4 mr-2" />
                            {t("settingsSubscriptionManageBilling")}
                          </Button>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-sm text-muted-foreground">
                          {nexusAuthenticated
                            ? t("settingsLoading")
                            : t("settingsSubscriptionSignInToSeePlan")}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Cartes Plans Pro */}
              <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                {!nexusAuthenticated ? (
                  <div className="md:col-span-2 rounded-xl border border-border/50 bg-card/50 p-8 text-center">
                    <Sparkles className="w-12 h-12 mx-auto mb-4 text-primary" />
                    <h3 className="text-lg font-bold mb-2">{t("settingsSubscriptionUnlockProTitle")}</h3>
                    <p className="text-sm text-muted-foreground mb-6">
                      {t("settingsSubscriptionUnlockProDescription")}
                    </p>
                    <Button
                      variant="default"
                      size="lg"
                      onClick={handleGoogleSignIn}
                      disabled={authLoading}
                      className="gap-2"
                    >
                      <User className="w-4 h-4" />
                      {t("settingsSignIn")}
                    </Button>
                  </div>
                ) : !stripeInitialized || !API_BASE_URL ? (
                  <div className="md:col-span-2 rounded-xl border border-border/50 bg-card/50 p-8 text-center">
                    <AlertCircle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
                    <h3 className="text-lg font-bold mb-2">{t("settingsSubscriptionConfigRequired")}</h3>
                    <p className="text-sm text-muted-foreground">
                      {!stripeInitialized ? t("settingsStripeNotConfigured") : t("settingsBackendNotConfigured")}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Plan Mensuel */}
                    <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent overflow-hidden hover:shadow-lg transition-shadow">
                      <div className="p-6 space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Crown className="w-5 h-5 text-primary" />
                              <h3 className="text-lg font-bold">{t("settingsSubscriptionPlanMonthly")}</h3>
                            </div>
                            <p className="text-xs text-muted-foreground">{t("settingsSubscriptionMonthlyBilling")}</p>
                          </div>
                        </div>
                        
                        <div className="py-4">
                          <div className="text-4xl font-bold text-primary">{t("settingsSubscriptionMonthlyPrice")}</div>
                          <p className="text-xs text-muted-foreground mt-1">{t("settingsSubscriptionPerMonth")}</p>
                        </div>
                        
                        <ul className="space-y-2 text-xs">
                          <li className="flex items-center gap-2 text-muted-foreground">
                            <Check className="w-4 h-4 text-primary flex-shrink-0" />
                            {t("settingsPlanFeatureUnlimitedStorage")}
                          </li>
                          <li className="flex items-center gap-2 text-muted-foreground">
                            <Check className="w-4 h-4 text-primary flex-shrink-0" />
                            {t("settingsPlanFeatureAutoSync")}
                          </li>
                          <li className="flex items-center gap-2 text-muted-foreground">
                            <Check className="w-4 h-4 text-primary flex-shrink-0" />
                            {t("settingsPlanFeaturePrioritySupport")}
                          </li>
                        </ul>
                        
                        <Button
                          variant={subscriptionStatus?.plan === "pro" ? "outline" : "default"}
                          size="lg"
                          className="w-full"
                          onClick={handleUpgradeMonthly}
                          disabled={subscriptionLoading || (subscriptionStatus?.plan === "pro" && !subscriptionStatus?.cancelAtPeriodEnd)}
                        >
                          {subscriptionStatus?.plan === "pro" && !subscriptionStatus?.cancelAtPeriodEnd
                            ? t("settingsPlanCurrent")
                            : t("settingsPlanChoose")}
                        </Button>
                      </div>
                    </div>

                    {/* Plan Annuel */}
                    <div className="rounded-xl border-2 border-primary/50 bg-gradient-to-br from-primary/10 to-secondary/5 overflow-hidden hover:shadow-xl transition-shadow relative">
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                        <span className="inline-block px-4 py-1 text-xs font-bold bg-gradient-to-r from-primary to-secondary text-white rounded-full shadow-lg">
                          {t("settingsSubscriptionSave20")}
                        </span>
                      </div>
                      <div className="p-6 space-y-4 mt-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Crown className="w-5 h-5 text-primary" />
                              <h3 className="text-lg font-bold">{t("settingsSubscriptionPlanYearly")}</h3>
                            </div>
                            <p className="text-xs text-muted-foreground">{t("settingsSubscriptionYearlyBilling")}</p>
                          </div>
                        </div>
                        
                        <div className="py-4">
                          <div className="text-4xl font-bold text-primary">{t("settingsSubscriptionYearlyPrice")}</div>
                          <p className="text-xs text-muted-foreground line-through opacity-60 mt-1">{t("settingsSubscriptionYearlyOldPrice")}</p>
                          <p className="text-xs font-medium text-primary mt-1">{t("settingsSubscriptionYearlyMonthlyEquivalent")}</p>
                        </div>
                        
                        <ul className="space-y-2 text-xs">
                          <li className="flex items-center gap-2 text-muted-foreground">
                            <Check className="w-4 h-4 text-primary flex-shrink-0" />
                            {t("settingsSubscriptionAllProBenefits")}
                          </li>
                          <li className="flex items-center gap-2 text-muted-foreground">
                            <Check className="w-4 h-4 text-primary flex-shrink-0" />
                            <span className="font-medium text-primary">{t("settingsSubscriptionYearlySave")}</span>
                          </li>
                          <li className="flex items-center gap-2 text-muted-foreground">
                            <Check className="w-4 h-4 text-primary flex-shrink-0" />
                            {t("settingsSubscriptionEarlyAccess")}
                          </li>
                        </ul>
                        
                        <Button
                          variant={subscriptionStatus?.plan === "pro" ? "outline" : "default"}
                          size="lg"
                          className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                          onClick={handleUpgradeYearly}
                          disabled={subscriptionLoading || (subscriptionStatus?.plan === "pro" && !subscriptionStatus?.cancelAtPeriodEnd)}
                        >
                          <Sparkles className="w-4 h-4 mr-2" />
                          {subscriptionStatus?.plan === "pro" && !subscriptionStatus?.cancelAtPeriodEnd
                            ? t("settingsPlanCurrent")
                            : t("settingsSubscriptionChooseYearly")}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Comparaison des plans */}
            <div className="mt-6">
              <SettingsCard title={t("settingsCardCompareOffers")} icon={Sparkles} className="col-span-full">
                <div className="space-y-6">
                  {/* En-tête de comparaison */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Colonne vide pour aligner avec les noms de fonctionnalités */}
                    <div className="hidden md:block"></div>
                    
                    {/* Colonne Gratuit */}
                    <div className="text-center">
                      <div className="p-4 rounded-t-xl bg-gradient-to-b from-muted/50 to-muted/20 border border-border/50">
                        <h3 className="text-lg font-bold">{t("settingsPlanFree")}</h3>
                        <p className="text-2xl font-bold mt-2">{t("settingsSubscriptionFreePrice")}</p>
                        <p className="text-xs text-muted-foreground">{t("settingsSubscriptionForever")}</p>
                      </div>
                    </div>
                    
                    {/* Colonne Pro Mensuel */}
                    <div className="text-center">
                      <div className="p-4 rounded-t-xl bg-gradient-to-b from-primary/20 to-primary/5 border-2 border-primary/30">
                        <div className="flex items-center justify-center gap-2 mb-1">
                          <Crown className="w-4 h-4 text-primary" />
                          <h3 className="text-lg font-bold text-primary">{t("settingsSubscriptionPlanMonthly")}</h3>
                        </div>
                        <p className="text-2xl font-bold mt-2">{t("settingsSubscriptionMonthlyPrice")}</p>
                        <p className="text-xs text-muted-foreground">{t("settingsSubscriptionPerMonth")}</p>
                      </div>
                    </div>
                    
                    {/* Colonne Pro Annuel */}
                    <div className="text-center relative">
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                        <span className="inline-block px-3 py-1 text-xs font-bold bg-gradient-to-r from-primary to-secondary text-white rounded-full shadow-lg">
                          {t("settingsSubscriptionBestDeal")}
                        </span>
                      </div>
                      <div className="p-4 rounded-t-xl bg-gradient-to-b from-primary/30 to-primary/10 border-2 border-primary/50">
                        <div className="flex items-center justify-center gap-2 mb-1">
                          <Crown className="w-4 h-4 text-primary" />
                          <h3 className="text-lg font-bold text-primary">{t("settingsSubscriptionPlanYearly")}</h3>
                        </div>
                        <div className="mt-2">
                          <p className="text-2xl font-bold">{t("settingsSubscriptionYearlyPrice")}</p>
                          <p className="text-xs text-muted-foreground line-through opacity-60">{t("settingsSubscriptionYearlyOldPrice")}</p>
                        </div>
                        <p className="text-xs font-medium text-primary mt-1">{t("settingsSubscriptionYearlySave")}</p>
                      </div>
                    </div>
                  </div>

                  {/* Tableau de comparaison */}
                  <div className="space-y-1">
                    {/* Catégorie: Stockage & Sync */}
                    <div className="pt-4 pb-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-primary">{t("settingsComparisonStorageTitle")}</h4>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-3 border-t border-border/30">
                      <div className="text-sm font-medium">{t("settingsComparisonCloudStorage")}</div>
                      <div className="text-center text-sm text-muted-foreground">{t("settingsComparisonCloudStorageFree")}</div>
                      <div className="text-center text-sm font-medium text-primary">{t("settingsComparisonCloudStoragePro")}</div>
                      <div className="text-center text-sm font-medium text-primary">{t("settingsComparisonCloudStoragePro")}</div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-3 border-t border-border/30">
                      <div className="text-sm font-medium">{t("settingsComparisonAutoSync")}</div>
                      <div className="text-center"><X className="w-4 h-4 text-muted-foreground/50 mx-auto" /></div>
                      <div className="text-center"><Check className="w-5 h-5 text-primary mx-auto" /></div>
                      <div className="text-center"><Check className="w-5 h-5 text-primary mx-auto" /></div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-3 border-t border-border/30">
                      <div className="text-sm font-medium">{t("settingsComparisonFirebaseBackup")}</div>
                      <div className="text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></div>
                      <div className="text-center"><Check className="w-5 h-5 text-primary mx-auto" /></div>
                      <div className="text-center"><Check className="w-5 h-5 text-primary mx-auto" /></div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-3 border-t border-border/30">
                      <div className="text-sm font-medium">{t("settingsComparisonMediaUploads")}</div>
                      <div className="text-center text-sm text-muted-foreground">{t("settingsComparisonMediaUploadsFree")}</div>
                      <div className="text-center text-sm font-medium text-primary">{t("settingsComparisonUnlimited")}</div>
                      <div className="text-center text-sm font-medium text-primary">{t("settingsComparisonUnlimited")}</div>
                    </div>

                    {/* Catégorie: Fonctionnalités */}
                    <div className="pt-4 pb-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-primary">{t("settingsComparisonFeaturesTitle")}</h4>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-3 border-t border-border/30">
                      <div className="text-sm font-medium">{t("settingsComparisonLocalLibrary")}</div>
                      <div className="text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></div>
                      <div className="text-center"><Check className="w-5 h-5 text-primary mx-auto" /></div>
                      <div className="text-center"><Check className="w-5 h-5 text-primary mx-auto" /></div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-3 border-t border-border/30">
                      <div className="text-sm font-medium">{t("settingsComparisonYouTubeStreaming")}</div>
                      <div className="text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></div>
                      <div className="text-center"><Check className="w-5 h-5 text-primary mx-auto" /></div>
                      <div className="text-center"><Check className="w-5 h-5 text-primary mx-auto" /></div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-3 border-t border-border/30">
                      <div className="text-sm font-medium">{t("settingsComparisonCustomPlaylists")}</div>
                      <div className="text-center text-sm text-muted-foreground">{t("settingsComparisonCustomPlaylistsFree")}</div>
                      <div className="text-center text-sm font-medium text-primary">{t("settingsComparisonUnlimited")}</div>
                      <div className="text-center text-sm font-medium text-primary">{t("settingsComparisonUnlimited")}</div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-3 border-t border-border/30">
                      <div className="text-sm font-medium">{t("settingsComparisonAdvancedEqualizer")}</div>
                      <div className="text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></div>
                      <div className="text-center"><Check className="w-5 h-5 text-primary mx-auto" /></div>
                      <div className="text-center"><Check className="w-5 h-5 text-primary mx-auto" /></div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-3 border-t border-border/30">
                      <div className="text-sm font-medium">{t("settingsComparisonAudioVisualizer")}</div>
                      <div className="text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></div>
                      <div className="text-center"><Check className="w-5 h-5 text-primary mx-auto" /></div>
                      <div className="text-center"><Check className="w-5 h-5 text-primary mx-auto" /></div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-3 border-t border-border/30">
                      <div className="text-sm font-medium">{t("settingsComparisonKaraoke")}</div>
                      <div className="text-center"><X className="w-4 h-4 text-muted-foreground/50 mx-auto" /></div>
                      <div className="text-center"><Check className="w-5 h-5 text-primary mx-auto" /></div>
                      <div className="text-center"><Check className="w-5 h-5 text-primary mx-auto" /></div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-3 border-t border-border/30">
                      <div className="text-sm font-medium">{t("settingsComparisonOfflineDownload")}</div>
                      <div className="text-center"><X className="w-4 h-4 text-muted-foreground/50 mx-auto" /></div>
                      <div className="text-center"><Check className="w-5 h-5 text-primary mx-auto" /></div>
                      <div className="text-center"><Check className="w-5 h-5 text-primary mx-auto" /></div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-3 border-t border-border/30">
                      <div className="text-sm font-medium">{t("settingsComparisonAudioVibes")}</div>
                      <div className="text-center text-sm text-muted-foreground">{t("settingsComparisonAudioVibesFree")}</div>
                      <div className="text-center text-sm font-medium text-primary">{t("settingsComparisonAudioVibesPro")}</div>
                      <div className="text-center text-sm font-medium text-primary">{t("settingsComparisonAudioVibesPro")}</div>
                    </div>

                    {/* Catégorie: Support & Accès */}
                    <div className="pt-4 pb-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-primary">{t("settingsComparisonSupportTitle")}</h4>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-3 border-t border-border/30">
                      <div className="text-sm font-medium">{t("settingsComparisonSupport")}</div>
                      <div className="text-center text-sm text-muted-foreground">{t("settingsComparisonSupportFree")}</div>
                      <div className="text-center text-sm font-medium text-primary">{t("settingsComparisonSupportPro")}</div>
                      <div className="text-center text-sm font-medium text-primary">{t("settingsComparisonSupportPro")}</div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-3 border-t border-border/30">
                      <div className="text-sm font-medium">{t("settingsComparisonUpdates")}</div>
                      <div className="text-center text-sm text-muted-foreground">{t("settingsComparisonUpdatesFree")}</div>
                      <div className="text-center text-sm font-medium text-primary">{t("settingsComparisonUpdatesPro")}</div>
                      <div className="text-center text-sm font-medium text-primary">{t("settingsComparisonUpdatesPro")}</div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-3 border-t border-border/30">
                      <div className="text-sm font-medium">{t("settingsComparisonExclusiveBadge")}</div>
                      <div className="text-center"><X className="w-4 h-4 text-muted-foreground/50 mx-auto" /></div>
                      <div className="text-center text-sm font-medium text-primary">{t("settingsComparisonExclusiveBadgePro")}</div>
                      <div className="text-center text-sm font-medium text-primary">{t("settingsComparisonExclusiveBadgePro")}</div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-3 border-t border-border/30">
                      <div className="text-sm font-medium">{t("settingsComparisonBetaFeatures")}</div>
                      <div className="text-center"><X className="w-4 h-4 text-muted-foreground/50 mx-auto" /></div>
                      <div className="text-center"><Check className="w-5 h-5 text-primary mx-auto" /></div>
                      <div className="text-center"><Check className="w-5 h-5 text-primary mx-auto" /></div>
                    </div>
                  </div>

                  {/* Boutons d'action */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-6">
                    {/* Colonne vide pour aligner */}
                    <div className="hidden md:block"></div>
                    
                    <div className="text-center">
                      <Button variant="outline" size="lg" className="w-full" disabled>
                        {t("settingsPlanCurrent")}
                      </Button>
                    </div>
                    <div className="text-center">
                      <Button 
                        variant={subscriptionStatus?.plan === "pro" && !subscriptionStatus?.cancelAtPeriodEnd ? "outline" : "default"}
                        size="lg" 
                        className="w-full bg-primary hover:bg-primary/90"
                        onClick={handleUpgradeMonthly}
                        disabled={subscriptionLoading || !nexusAuthenticated || (subscriptionStatus?.plan === "pro" && !subscriptionStatus?.cancelAtPeriodEnd)}
                      >
                        <Crown className="w-4 h-4 mr-2" />
                        {subscriptionStatus?.plan === "pro" && !subscriptionStatus?.cancelAtPeriodEnd
                          ? t("settingsPlanCurrent")
                          : t("settingsUpgradeToPro")}
                      </Button>
                    </div>
                    <div className="text-center">
                      <Button 
                        variant={subscriptionStatus?.plan === "pro" && !subscriptionStatus?.cancelAtPeriodEnd ? "outline" : "default"}
                        size="lg" 
                        className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                        onClick={handleUpgradeYearly}
                        disabled={subscriptionLoading || !nexusAuthenticated || (subscriptionStatus?.plan === "pro" && !subscriptionStatus?.cancelAtPeriodEnd)}
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        {subscriptionStatus?.plan === "pro" && !subscriptionStatus?.cancelAtPeriodEnd
                          ? t("settingsPlanCurrent")
                          : t("settingsSubscriptionChooseYearly")}
                      </Button>
                    </div>
                  </div>

                  {/* Note de bas de page */}
                  <div className="pt-4 text-center border-t border-border/30">
                    <p className="text-xs text-muted-foreground">
                      {t("settingsSubscriptionFooterNote")}
                    </p>
                  </div>
                </div>
              </SettingsCard>
            </div>
          </TabsContent>

          {/* Account Tab */}
          <TabsContent value="account" className="mt-6 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SettingsCard title={t("settingsCardProfile")} icon={User}>
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
                          {nexusIsPro ? t("settingsPlanPro") : t("settingsPlanFree")}
                        </span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="w-full" onClick={handleLogout} disabled={authLoading}>
                      {authLoading ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <LogOut className="w-4 h-4 mr-2" />
                      )}
                      {t("settingsLogout")}
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mx-auto mb-4">
                      <User className="w-10 h-10 text-muted-foreground" />
                    </div>
                    <p className="text-lg font-medium">{t("settingsLocalUser")}</p>
                    <p className="text-sm text-muted-foreground">{t("settingsOfflineMode")}</p>
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
                      {t("settingsCreateAccount")}
                    </Button>
                  </div>
                )}
              </SettingsCard>

              <SettingsCard title={t("settingsCardAbout")} icon={Info}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t("settingsAboutVersion")}</span>
                    <span className="text-sm font-mono">1.0.0</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t("settingsAboutBuild")}</span>
                    <span className="text-sm font-mono">2024.12.08</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t("settingsAboutMode")}</span>
                    <span className="text-sm">{isElectron ? t("settingsAboutModeDesktop") : t("settingsAboutModeWeb")}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t("settingsAboutFirebase")}</span>
                    <span className={cn("text-sm", authService.getGoogleClientIdSync() ? "text-green-500" : "text-yellow-500")}>
                      {authService.getGoogleClientIdSync() ? t("settingsConfigured") : t("settingsNotConfigured")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t("settingsAboutStripe")}</span>
                    <span className={cn("text-sm", stripeInitialized ? "text-green-500" : "text-yellow-500")}>
                      {stripeInitialized ? t("settingsConnected") : t("settingsNotConfigured")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between group">
                    <span className="text-sm text-muted-foreground">{t("settingsAboutRedisCache")}</span>
                    <div className="flex items-center gap-2">
                      {redisChecking ? (
                        <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                      ) : (
                        <span className={cn(
                          "text-sm",
                          redisConnected === null ? "text-muted-foreground" :
                          redisConnected ? "text-green-500" : "text-yellow-500"
                        )}>
                          {redisConnected === null ? t("settingsChecking") :
                           redisConnected ? t("settingsConnected") : t("settingsNotConfigured")}
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={async () => {
                          setRedisChecking(true);
                          try {
                            const isConnected = await redisCache.isConnected();
                            setRedisConnected(isConnected);
                            toast.success(isConnected ? t("settingsRedisConnected") : t("settingsRedisNotConfigured"));
                          } catch (error) {
                            setRedisConnected(false);
                            toast.error(t("settingsRedisConnectionError"));
                          } finally {
                            setRedisChecking(false);
                          }
                        }}
                      >
                        <RefreshCw className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="pt-3 flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => notifySuccess(t("settingsAppUpToDate"))}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      {t("settingsCheckUpdates")}
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={handleCleanupOrphaned}
                      disabled={cleanupLoading}
                      className="flex items-center gap-2"
                    >
                      {cleanupLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Zap className="w-4 h-4" />
                      )}
                      {t("settingsCleanupOrphans")}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => window.open("https://github.com/nexus-audio", "_blank")}>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      {t("settingsOpenGithub")}
                    </Button>
                    <CoachmarkTrigger variant="ghost" size="sm" showIcon>
                      {t("settingsRestartCoachmark")}
                    </CoachmarkTrigger>
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
