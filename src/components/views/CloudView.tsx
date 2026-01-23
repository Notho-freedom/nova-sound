import { useState, useEffect, useCallback } from "react";
import { 
  Cloud,
  Server,
  HardDrive,
  RefreshCw,
  Upload,
  Download,
  Trash2,
  MoreVertical,
  File,
  Music,
  Video as VideoIcon,
  Image,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  AlertCircle,
  ExternalLink,
  Copy,
  Eye,
  Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { HelpButton, HelpIcon } from "@/components/ui/HelpButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { firebaseService } from "@/services/firebase";
import { Skeleton } from "@/components/ui/skeleton";
import { FileTableSkeleton } from "@/components/ui/skeletons";
import { useCloudSync } from "@/hooks/useCloudSync";
import { getUploadedFiles, getCachedUploads, invalidateUploadsCache, updateUploadsCache } from "@/data/uploads.session";
import { useCloudinaryUpload } from "@/hooks/useCloudinaryUpload";
import { useBunnyUpload } from "@/hooks/useBunnyUpload";
import { useNexusUpload } from "@/hooks/useNexusUpload";
import { useVideoUpload } from "@/hooks/useVideoUpload";
import { useLibrary } from "@/hooks/useLibrary";
import { useVideoLibrary } from "@/hooks/useVideoLibrary";
import { PageHeader } from "@/components/PageHeader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Track } from "@/types/music";
import type { Video } from "@/types/music";
import { useI18n } from "@/i18n";

interface UploadedFile {
  id: string;
  name: string;
  uploadedAt: string;
  cloudProvider?: "cloudinary" | "nexus" | "bunny" | "planethoster";
  url?: string;
  size?: number;
  type?: "audio" | "video" | "image" | "other";
  cloudId?: string;
}


type ServerType = "cloudinary" | "bunny" | "planethoster" | "nexus";

interface ServerInfo {
  id: ServerType;
  name: string;
  description: string;
  icon: typeof Cloud;
  color: string;
  isPro: boolean;
  serverNumber: number;
  configured: boolean;
}

export const CloudView = () => {
  const { t } = useI18n();
  const { 
    nexusAuthenticated, 
    nexusIsPro, 
    nexusUser,
    cloudinaryConfigured,
    cloudinaryConfig,
  } = useCloudSync();
  
  const { tracks } = useLibrary();
  const { videos } = useVideoLibrary();
  const { uploadTrack: uploadTrackToCloudinary, uploadProgress: cloudinaryProgress, isUploading: isUploadingToCloudinary } = useCloudinaryUpload();
  const { uploadTrack: uploadTrackToBunny, uploadProgress: bunnyProgress, isUploading: isUploadingToBunny } = useBunnyUpload();
  const { uploadTrack: uploadTrackToNexus, uploadProgress: nexusProgress, isUploading: isUploadingToNexus } = useNexusUpload();
  const { 
    uploadVideoToCloudinary, 
    uploadVideoToBunny, 
    uploadVideoToNexus,
    cloudinaryProgress: cloudinaryVideoProgress,
    bunnyProgress: bunnyVideoProgress,
    nexusProgress: nexusVideoProgress,
    isUploadingToCloudinary: isUploadingVideoToCloudinary,
    isUploadingToBunny: isUploadingVideoToBunny,
    isUploadingToNexus: isUploadingVideoToNexus,
  } = useVideoUpload();

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [loadingUploaded, setLoadingUploaded] = useState(true);
  const [selectedServer, setSelectedServer] = useState<ServerType>("cloudinary");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedTracks, setSelectedTracks] = useState<Track[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<Video[]>([]);
  const [uploadType, setUploadType] = useState<"audio" | "video">("audio");

  // Server information
  const servers: ServerInfo[] = [
    {
      id: "cloudinary",
      name: "Cloudinary",
      description: t("cloudServer0"),
      icon: Cloud,
      color: "text-purple-500",
      isPro: true,
      serverNumber: 0,
      configured: cloudinaryConfigured,
    },
    {
      id: "bunny",
      name: "Bunny CDN",
      description: t("cloudServer1"),
      icon: Cloud,
      color: "text-blue-500",
      isPro: true,
      serverNumber: 1,
      configured: nexusIsPro && nexusAuthenticated,
    },
    {
      id: "planethoster",
      name: "PlanetHoster SFTP",
      description: t("cloudServer2"),
      icon: Server,
      color: "text-orange-500",
      isPro: true,
      serverNumber: 2,
      configured: nexusIsPro && nexusAuthenticated,
    },
    {
      id: "nexus",
      name: t("cloudServerNexusLocal"),
      description: t("cloudServer3Local"),
      icon: HardDrive,
      color: "text-green-500",
      isPro: false,
      serverNumber: -1,
      configured: nexusAuthenticated,
    },
  ];

  // Load uploaded files (hook passif - utilise la session de données)
  const loadUploadedFiles = useCallback(async () => {
    setLoadingUploaded(true);
    try {
      const userId = nexusUser?.uid || null;
      
      // Vérifier le cache d'abord
      const cached = getCachedUploads(userId);
      if (cached) {
        setUploadedFiles(cached);
        setLoadingUploaded(false);
        return;
      }
      
      // Charger depuis la session de données (cache + promesse partagée)
      const uploadedMedia = await getUploadedFiles(userId);
      setUploadedFiles(uploadedMedia);
    } catch (error) {
      console.error("[CloudView] Failed to load uploaded files:", error);
    } finally {
      setLoadingUploaded(false);
    }
  }, [nexusUser]);

  useEffect(() => {
    loadUploadedFiles();
    
    // Retry loading files when authentication changes
    const retryTimer = setTimeout(() => {
      if (nexusAuthenticated) {
        console.log("[CloudView] Retrying file load after authentication");
        loadUploadedFiles();
      }
    }, 2000);
    
    return () => clearTimeout(retryTimer);
  }, [loadUploadedFiles, nexusAuthenticated]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStorageChange = async (e: StorageEvent) => {
      if (e.key && e.key.includes('uploaded-media')) {
        console.log("Storage change detected for uploaded media:", e.key);
        await loadUploadedFiles();
      }
    };

    const handleCustomEvent = async (e: CustomEvent) => {
      console.log("Custom event detected for uploaded media:", e.detail);
      await loadUploadedFiles();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("uploadedMediaChanged", handleCustomEvent as unknown as EventListener);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("uploadedMediaChanged", handleCustomEvent as unknown as EventListener);
    };
  }, [loadUploadedFiles]);

  const getFileType = (filename: string): "audio" | "video" | "image" | "other" => {
    const ext = filename.split(".").pop()?.toLowerCase();
    if (["mp3", "wav", "flac", "aac", "ogg", "m4a"].includes(ext || "")) {
      return "audio";
    }
    if (["mp4", "avi", "mkv", "webm", "mov"].includes(ext || "")) {
      return "video";
    }
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "")) {
      return "image";
    }
    return "other";
  };

  const getFileIcon = (type: "audio" | "video" | "image" | "other") => {
    switch (type) {
      case "audio":
        return <Music className="w-5 h-5" />;
      case "video":
        return <VideoIcon className="w-5 h-5" />;
      case "image":
        return <Image className="w-5 h-5" />;
      default:
        return <File className="w-5 h-5" />;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const formatDuration = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return t("cloudTimeAgoDays", { count: days, suffix: days > 1 ? "s" : "" });
    if (hours > 0) return t("cloudTimeAgoHours", { count: hours, suffix: hours > 1 ? "s" : "" });
    if (minutes > 0) return t("cloudTimeAgoMinutes", { count: minutes, suffix: minutes > 1 ? "s" : "" });
    return t("cloudTimeJustNow");
  };

  const getProviderIcon = (provider?: string) => {
    switch (provider) {
      case "bunny":
        return <Cloud className="w-4 h-4 text-blue-500" />;
      case "cloudinary":
        return <Cloud className="w-4 h-4 text-purple-500" />;
      case "planethoster":
        return <Cloud className="w-4 h-4 text-orange-500" />;
      case "nexus":
        return <Server className="w-4 h-4 text-green-500" />;
      default:
        return <HardDrive className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getProviderName = (provider?: string) => {
    switch (provider) {
      case "cloudinary":
        return t("cloudProviderCloudinary");
      case "bunny":
        return t("cloudProviderBunny");
      case "planethoster":
        return t("cloudProviderPlanethoster");
      case "nexus":
        return t("cloudProviderNexus");
      default:
        return t("cloudProviderLocal");
    }
  };

  const isProProvider = (provider?: string) => {
    return provider === "cloudinary" || provider === "bunny" || provider === "planethoster";
  };

  const refreshUploadedFiles = async () => {
    await loadUploadedFiles();
    toast.success(t("cloudToastFilesRefreshed"));
  };

  // Group files by provider
  const filesByProvider = uploadedFiles.reduce((acc, file) => {
    const provider = file.cloudProvider || "local";
    if (!acc[provider]) {
      acc[provider] = [];
    }
    acc[provider].push(file);
    return acc;
  }, {} as Record<string, UploadedFile[]>);

  const providerOrder: ServerType[] = ["cloudinary", "bunny", "planethoster", "nexus"];

  // Upload functions
  const handleUploadTracks = async (server: ServerType) => {
    if (selectedTracks.length === 0) {
      toast.error(t("cloudToastNoTracksSelected"));
      return;
    }

    try {
      for (const track of selectedTracks) {
        switch (server) {
          case "cloudinary":
            await uploadTrackToCloudinary(track);
            break;
          case "bunny":
            await uploadTrackToBunny(track);
            break;
          case "nexus":
            await uploadTrackToNexus(track, "local");
            break;
          case "planethoster":
            // PlanetHoster uses the same endpoint as Nexus
            await uploadTrackToNexus(track, "planethoster");
            break;
        }
      }
      setUploadDialogOpen(false);
      setSelectedTracks([]);
      toast.success(`${selectedTracks.length} piste(s) en cours d'upload vers ${servers.find(s => s.id === server)?.name}`);
    } catch (error: any) {
      toast.error(`Erreur lors de l'upload: ${error.message}`);
    }
  };

  const handleUploadVideos = async (server: ServerType) => {
    if (selectedVideos.length === 0) {
      toast.error(t("cloudToastNoVideosSelected"));
      return;
    }

    try {
      for (const video of selectedVideos) {
        switch (server) {
          case "cloudinary":
            await uploadVideoToCloudinary(video);
            break;
          case "bunny":
            await uploadVideoToBunny(video);
            break;
          case "nexus":
            await uploadVideoToNexus(video, "local");
            break;
          case "planethoster":
            // PlanetHoster uses the same endpoint as Nexus
            await uploadVideoToNexus(video, "planethoster");
            break;
        }
      }
      setUploadDialogOpen(false);
      setSelectedVideos([]);
      toast.success(`${selectedVideos.length} vidéo(s) en cours d'upload vers ${servers.find(s => s.id === server)?.name}`);
    } catch (error: any) {
      toast.error(`Erreur lors de l'upload: ${error.message}`);
    }
  };

  const startDownload = async (url: string, filename: string) => {
    try {
      // For PlanetHoster URLs, ensure we use the secure proxy with authentication
      let downloadUrl = url;
      
      // If it's a PlanetHoster URL, ensure it uses the secure proxy
      if (url.includes('planethoster') || url.includes('nexus/')) {
        const { getSecurePlanetHosterUrl } = await import('@/lib/planethoster-url');
        downloadUrl = getSecurePlanetHosterUrl(url);
      }

      // Get authentication token
      let accessToken: string | null = null;
      try {
        const { firebaseService } = await import('@/services/firebase');
        if (firebaseService.isInitialized() && firebaseService.getCurrentUser()) {
          accessToken = await firebaseService.getIdToken();
        }
      } catch (error) {
        console.error('Failed to get Firebase token:', error);
      }

      const response = await fetch(downloadUrl, {
        headers: accessToken ? {
          'Authorization': `Bearer ${accessToken}`,
        } : {},
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      toast.success(`Téléchargement terminé: ${filename}`);
    } catch (error: any) {
      toast.error(`Échec du téléchargement: ${error.message}`);
    }
  };

  const deleteFile = async (file: UploadedFile) => {
    const updated = uploadedFiles.filter(f => f.id !== file.id);
    setUploadedFiles(updated);
    
    // Invalider le cache et mettre à jour via la session
    const userId = nexusUser?.uid || null;
    invalidateUploadsCache(userId);
    updateUploadsCache(userId, updated);
    
    // Sauvegarder dans localStorage (la session gère déjà ça, mais on le fait ici pour compatibilité)
    const { getCurrentUserId, getUserStorageKey } = await import('@/lib/storage-utils');
    const actualUserId = userId || await getCurrentUserId();
    const storageKey = await getUserStorageKey('nexus-uploaded-media', actualUserId);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    
    try {
      const { firebaseSyncService } = await import('@/services/firebase-sync');
      firebaseSyncService.queueSync('uploadedMedia', updated);
    } catch (error) {
      // Silently fail if Firebase sync is not available
    }
    
    toast.success(t("cloudToastFileRemoved"));
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success(t("cloudToastUrlCopied"));
  };

  const openUrl = (url: string) => {
    window.open(url, '_blank');
  };

  // Get files for selected server
  const getServerFiles = (serverId: ServerType): UploadedFile[] => {
    return filesByProvider[serverId] || [];
  };

  // Get upload progress for server
  const getServerUploadProgress = (serverId: ServerType): number => {
    switch (serverId) {
      case "cloudinary":
        return Array.from(cloudinaryProgress.values()).reduce((sum, p) => sum + p.progress, 0) / cloudinaryProgress.size || 0;
      case "bunny":
        return Array.from(bunnyProgress.values()).reduce((sum, p) => sum + p.progress, 0) / bunnyProgress.size || 0;
      case "nexus":
      case "planethoster":
        return Array.from(nexusProgress.values()).reduce((sum, p) => sum + p.progress, 0) / nexusProgress.size || 0;
      default:
        return 0;
    }
  };

  const isServerUploading = (serverId: ServerType): boolean => {
    switch (serverId) {
      case "cloudinary":
        return isUploadingToCloudinary || isUploadingVideoToCloudinary;
      case "bunny":
        return isUploadingToBunny || isUploadingVideoToBunny;
      case "nexus":
      case "planethoster":
        return isUploadingToNexus || isUploadingVideoToNexus;
      default:
        return false;
    }
  };

  // Calculate server statistics
  const getServerStats = (serverId: ServerType) => {
    const files = getServerFiles(serverId);
    const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);
    return {
      fileCount: files.length,
      totalSize,
      formattedSize: formatFileSize(totalSize),
    };
  };

  return (
    <div className="p-6 h-full min-h-0 w-full flex flex-col overflow-hidden animate-in fade-in duration-300">
      <PageHeader
        title={t("cloudTitle")}
        subtitle={t("cloudSubtitle")}
        rightContent={
          <div className="flex items-center gap-2">
            <HelpButton
              title={t("cloudHelpTitle")}
              description={t("cloudHelpDescription")}
              size="icon-sm"
            />
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Upload className="w-4 h-4" />
                  {t("cloudUploadButton")}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{t("cloudUploadDialogTitle")}</DialogTitle>
                  <DialogDescription>
                    {t("cloudUploadDialogDescription")}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t("cloudUploadFileTypeLabel")}</Label>
                    <Tabs value={uploadType} onValueChange={(v) => setUploadType(v as "audio" | "video")}>
                      <TabsList>
                        <TabsTrigger value="audio">{t("cloudUploadAudioTab")}</TabsTrigger>
                        <TabsTrigger value="video">{t("cloudUploadVideoTab")}</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>{t("cloudUploadServerLabel")}</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {servers.filter(s => s.configured).map((server) => (
                        <Button
                          key={server.id}
                          variant={selectedServer === server.id ? "default" : "outline"}
                          onClick={() => setSelectedServer(server.id)}
                          className="justify-start"
                        >
                          <server.icon className={cn("w-4 h-4 mr-2", server.color)} />
                          {server.name}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>
                      {uploadType === "audio" ? t("cloudUploadAudioLabel") : t("cloudUploadVideoLabel")}
                    </Label>
                    <ScrollArea className="h-64 border rounded-lg p-2">
                      {uploadType === "audio" ? (
                        <div className="space-y-2">
                          {tracks.map((track) => (
                            <div
                              key={track.id}
                              className={cn(
                                "flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer min-w-0",
                                selectedTracks.some(t => t.id === track.id) && "bg-primary/10"
                              )}
                              onClick={() => {
                                if (selectedTracks.some(t => t.id === track.id)) {
                                  setSelectedTracks(selectedTracks.filter(t => t.id !== track.id));
                                } else {
                                  setSelectedTracks([...selectedTracks, track]);
                                }
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={selectedTracks.some(t => t.id === track.id)}
                                onChange={() => {}}
                                className="rounded"
                              />
                              <Music className="w-4 h-4" />
                              <span className="flex-1 min-w-0 truncate max-w-lg">{track.title}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {videos.map((video) => (
                            <div
                              key={video.id}
                              className={cn(
                                "flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer",
                                selectedVideos.some(v => v.id === video.id) && "bg-primary/10"
                              )}
                              onClick={() => {
                                if (selectedVideos.some(v => v.id === video.id)) {
                                  setSelectedVideos(selectedVideos.filter(v => v.id !== video.id));
                                } else {
                                  setSelectedVideos([...selectedVideos, video]);
                                }
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={selectedVideos.some(v => v.id === video.id)}
                                onChange={() => {}}
                                className="rounded"
                              />
                              <VideoIcon className="w-4 h-4" />
                              <span className="flex-1 min-w-0 truncate max-w-xs">{video.title}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
                      {t("cloudCancel")}
                    </Button>
                    <Button
                      onClick={() => {
                        if (uploadType === "audio") {
                          handleUploadTracks(selectedServer);
                        } else {
                          handleUploadVideos(selectedServer);
                        }
                      }}
                      disabled={
                        (uploadType === "audio" ? selectedTracks.length : selectedVideos.length) === 0
                      }
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {t("cloudUploadCount", { count: uploadType === "audio" ? selectedTracks.length : selectedVideos.length })}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            
            <Button variant="outline" size="sm" onClick={refreshUploadedFiles} disabled={loadingUploaded}>
              <RefreshCw className={cn("w-4 h-4", loadingUploaded && "opacity-50")} />
            </Button>
          </div>
        }
      />

      {/* Server Tabs */}
      <Tabs value={selectedServer} onValueChange={(v) => setSelectedServer(v as ServerType)} className="flex-1 flex flex-col overflow-hidden mt-6">
        <TabsList className="mb-4 bg-muted/30">
          {servers.map((server) => {
            const stats = getServerStats(server.id);
            const isUploading = isServerUploading(server.id);
            const files = getServerFiles(server.id);
            
            return (
              <TabsTrigger
                key={server.id}
                value={server.id}
                className="gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary relative"
                disabled={!server.configured}
              >
                <server.icon className={cn("w-4 h-4", server.color)} />
                <span>{server.name}</span>
                {server.isPro && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                {stats.fileCount > 0 && (
                  <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                    {stats.fileCount}
                  </span>
                )}
                {isUploading && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full animate-pulse" />
                )}
                {!server.configured && (
                  <AlertCircle className="w-3 h-3 text-muted-foreground ml-1" />
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {servers.map((server) => {
          const files = getServerFiles(server.id);
          const stats = getServerStats(server.id);
          const isUploading = isServerUploading(server.id);
          const uploadProgress = getServerUploadProgress(server.id);

          return (
            <TabsContent key={server.id} value={server.id} className="flex-1 flex flex-col overflow-hidden mt-0">
              {/* Server Info Card */}
              <div className="mb-4 p-4 rounded-xl bg-card/30 backdrop-blur-sm border border-border/30">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={cn("p-2 rounded-lg bg-muted/50", server.color.replace("text-", "bg-").replace("-500", "-500/20"))}>
                      <server.icon className={cn("w-6 h-6", server.color)} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        {server.name}
                        {server.isPro && <Crown className="w-4 h-4 text-amber-400" />}
                      </h3>
                      <p className="text-sm text-muted-foreground">{server.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <span className="text-muted-foreground">
                          {stats.fileCount} fichier{stats.fileCount > 1 ? "s" : ""}
                        </span>
                        <span className="text-muted-foreground">
                          {stats.formattedSize}
                        </span>
                      </div>
                    </div>
                  </div>
                  {!server.configured && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <AlertCircle className="w-4 h-4" />
                      <span>{server.isPro ? t("cloudServerProRequired") : t("cloudServerNotConfigured")}</span>
                    </div>
                  )}
                </div>
                
                {isUploading && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">{t("cloudUploading")}</span>
                      <span className="text-sm font-medium">{Math.round(uploadProgress)}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-2" />
                  </div>
                )}
              </div>

              {/* Files List */}
              {loadingUploaded ? (
                <div className="flex-1 overflow-y-auto">
                  <FileTableSkeleton count={5} />
                </div>
              ) : files.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center max-w-md">
                    <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center mb-4 mx-auto">
                      <server.icon className={cn("w-10 h-10", server.color)} />
                    </div>
                    <h3 className="text-lg font-medium mb-2">{t("cloudNoFilesTitle", { server: server.name })}</h3>
                    <p className="text-muted-foreground text-sm mb-4">
                      {server.configured
                        ? t("cloudNoFilesStartUpload")
                        : server.isPro
                        ? t("cloudNoFilesProRequired")
                        : t("cloudNoFilesConfigure")}
                    </p>
                    {server.configured && (
                      <Button onClick={() => setUploadDialogOpen(true)}>
                        <Upload className="w-4 h-4 mr-2" />
                        {t("cloudUploadFilesButton")}
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  <div className="bg-card/30 backdrop-blur-sm rounded-xl border border-border/30 overflow-hidden">
                    <div className="overflow-y-auto max-h-full">
                      <table className="w-full">
                        <thead className="sticky top-0 z-10 bg-background/80 backdrop-blur-md">
                          <tr className="border-b border-border/30">
                            <th className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground">
                              {t("cloudTableFile")}
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground hidden md:table-cell">
                              {t("cloudTableType")}
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground hidden lg:table-cell">
                              {t("cloudTableSize")}
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-display uppercase tracking-widest text-muted-foreground hidden md:table-cell">
                              {t("cloudTableUploaded")}
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-display uppercase tracking-widest text-muted-foreground">
                              {t("cloudTableActions")}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {files.map((file) => {
                            const fileType = file.type || getFileType(file.name);
                            return (
                              <tr
                                key={file.id}
                                className="group cursor-pointer transition-all duration-200 ease-out hover:bg-muted/40 active:bg-muted/50"
                              >
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                                      {getFileIcon(fileType)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-medium truncate text-foreground">
                                        {file.name}
                                      </p>
                                      <div className="flex items-center gap-2 mt-1">
                                        {getProviderIcon(file.cloudProvider)}
                                        <span className="text-xs text-muted-foreground inline-flex items-center">
                                          {getProviderName(file.cloudProvider)}
                                          {isProProvider(file.cloudProvider) && (
                                            <Crown className="w-3.5 h-3.5 ml-1 text-amber-400" />
                                          )}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 hidden md:table-cell">
                                  <span className="text-sm text-muted-foreground capitalize">
                                    {fileType}
                                  </span>
                                </td>
                                <td className="px-4 py-3 hidden lg:table-cell">
                                  <span className="text-sm text-muted-foreground font-mono">
                                    {file.size ? formatFileSize(file.size) : "-"}
                                  </span>
                                </td>
                                <td className="px-4 py-3 hidden md:table-cell">
                                  <span className="text-sm text-muted-foreground">
                                    {formatDuration(new Date(file.uploadedAt))}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    {file.url && (
                                      <>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            startDownload(file.url!, file.name);
                                          }}
                                        >
                                          <Download className="w-4 h-4 mr-2" />
                                          {t("cloudDownload")}
                                        </Button>
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button 
                                              variant="ghost" 
                                              size="sm"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              <MoreVertical className="w-4 h-4" />
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end">
                                            <DropdownMenuItem
                                              onClick={() => openUrl(file.url!)}
                                            >
                                              <ExternalLink className="w-4 h-4 mr-2" />
                                              {t("cloudOpenInNewTab")}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                              onClick={() => copyUrl(file.url!)}
                                            >
                                              <Copy className="w-4 h-4 mr-2" />
                                              {t("cloudCopyUrl")}
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                              onClick={() => deleteFile(file)}
                                              className="text-destructive"
                                            >
                                              <Trash2 className="w-4 h-4 mr-2" />
                                              {t("cloudDeleteFromList")}
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
};

