import { useState, useEffect } from "react";
import { 
  Download, 
  Pause, 
  Play, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Clock,
  File,
  Music,
  Video,
  Image,
  FileText,
  MoreVertical,
  Cloud,
  Server,
  HardDrive,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { firebaseService } from "@/services/firebase";
import { getUserStorageKey, getCurrentUserId } from "@/lib/storage-utils";

interface DownloadItem {
  id: string;
  filename: string;
  url: string;
  size: number;
  status: "pending" | "downloading" | "paused" | "completed" | "failed";
  progress: number;
  type: "audio" | "video" | "image" | "other";
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

interface UploadedFile {
  id: string;
  name: string;
  uploadedAt: string;
  cloudProvider?: "cloudinary" | "nexus" | "bunny" | "planethoster";
  url?: string;
  size?: number;
}

const DOWNLOADS_STORAGE_KEY = "nexus-downloads";
const UPLOADED_MEDIA_KEY = "nexus-uploaded-media";

export const DownloadsView = () => {
  const [downloads, setDownloads] = useState<DownloadItem[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(DOWNLOADS_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          return parsed.map((d: any) => ({
            ...d,
            createdAt: new Date(d.createdAt),
            completedAt: d.completedAt ? new Date(d.completedAt) : undefined,
          }));
        }
      } catch (error) {
        console.error("Failed to load downloads from localStorage:", error);
      }
    }
    return [];
  });

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [loadingUploaded, setLoadingUploaded] = useState(true);
  const [activeTab, setActiveTab] = useState<"downloads" | "uploaded">("downloads");

  // Save to localStorage whenever downloads change
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(DOWNLOADS_STORAGE_KEY, JSON.stringify(downloads));
      } catch (error) {
        console.error("Failed to save downloads to localStorage:", error);
      }
    }
  }, [downloads]);

  // Load uploaded files from localStorage and API
  useEffect(() => {
    const loadUploadedFiles = async () => {
      setLoadingUploaded(true);
      try {
        // Get user-isolated storage key
        const userId = await getCurrentUserId();
        const storageKey = await getUserStorageKey(UPLOADED_MEDIA_KEY, userId);
        
        // Load from localStorage (user-isolated)
        const saved = localStorage.getItem(storageKey);
        const uploadedMedia: UploadedFile[] = saved ? JSON.parse(saved) : [];

        // Fetch files from Nexus API for local storage files
        try {
          const token = await firebaseService.getIdToken();
          if (token) {
            const response = await fetch("/api/storage/files", {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });
            if (response.ok) {
              const nexusFiles = await response.json();
              // Merge with uploadedMedia, avoiding duplicates
              const nexusFileIds = new Set(uploadedMedia.map(f => f.id));
              nexusFiles.forEach((file: any) => {
                if (!nexusFileIds.has(file.id)) {
                  uploadedMedia.push({
                    id: file.id,
                    name: file.name,
                    uploadedAt: file.uploadedAt,
                    cloudProvider: "nexus",
                    url: `/api/storage/download/${file.id}`,
                    size: file.size,
                  });
                } else {
                  // Update existing entry with URL if missing
                  const existing = uploadedMedia.find(f => f.id === file.id);
                  if (existing && !existing.url) {
                    existing.url = `/api/storage/download/${file.id}`;
                    existing.size = file.size;
                  }
                }
              });
            }
          }
        } catch (error) {
          console.error("Failed to fetch Nexus files:", error);
        }

        // Sort by upload date (newest first)
        uploadedMedia.sort((a, b) => 
          new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        );

        setUploadedFiles(uploadedMedia);
      } catch (error) {
        console.error("Failed to load uploaded files:", error);
      } finally {
        setLoadingUploaded(false);
      }
    };

    loadUploadedFiles();
  }, []);

  const getFileType = (filename: string): DownloadItem["type"] => {
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

  const getFileIcon = (type: DownloadItem["type"]) => {
    switch (type) {
      case "audio":
        return <Music className="w-5 h-5" />;
      case "video":
        return <Video className="w-5 h-5" />;
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

    if (days > 0) return `Il y a ${days} jour${days > 1 ? "s" : ""}`;
    if (hours > 0) return `Il y a ${hours} heure${hours > 1 ? "s" : ""}`;
    if (minutes > 0) return `Il y a ${minutes} minute${minutes > 1 ? "s" : ""}`;
    return "À l'instant";
  };

  const startDownload = async (url: string, filename: string) => {
    const id = crypto.randomUUID();
    const newDownload: DownloadItem = {
      id,
      filename,
      url,
      size: 0,
      status: "pending",
      progress: 0,
      type: getFileType(filename),
      createdAt: new Date(),
    };

    setDownloads((prev) => [...prev, newDownload]);

    try {
      // Simulate download progress (in real implementation, use fetch with progress tracking)
      const response = await fetch(url);
      const contentLength = response.headers.get("content-length");
      const total = contentLength ? parseInt(contentLength, 10) : 0;

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Response body is not readable");
      }

      const chunks: Uint8Array[] = [];
      let received = 0;

      setDownloads((prev) =>
        prev.map((d) =>
          d.id === id
            ? { ...d, status: "downloading", size: total }
            : d
        )
      );

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        received += value.length;

        const progress = total > 0 ? (received / total) * 100 : 0;
        setDownloads((prev) =>
          prev.map((d) =>
            d.id === id ? { ...d, progress } : d
          )
        );
      }

      // Create blob and download
      const blob = new Blob(chunks.map(chunk => new Uint8Array(chunk.buffer as ArrayBuffer)));
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      setDownloads((prev) =>
        prev.map((d) =>
          d.id === id
            ? {
                ...d,
                status: "completed",
                progress: 100,
                completedAt: new Date(),
              }
            : d
        )
      );

      toast.success(`Téléchargement terminé: ${filename}`);
    } catch (error) {
      console.error("Download failed:", error);
      setDownloads((prev) =>
        prev.map((d) =>
          d.id === id
            ? {
                ...d,
                status: "failed",
                error: error instanceof Error ? error.message : "Erreur inconnue",
              }
            : d
        )
      );
      toast.error(`Échec du téléchargement: ${filename}`);
    }
  };

  const pauseDownload = (id: string) => {
    setDownloads((prev) =>
      prev.map((d) => (d.id === id && d.status === "downloading" ? { ...d, status: "paused" } : d))
    );
    toast.info("Téléchargement mis en pause");
  };

  const resumeDownload = async (id: string) => {
    const download = downloads.find((d) => d.id === id);
    if (!download || download.status !== "paused") return;

    // In a real implementation, resume from where it left off
    setDownloads((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: "downloading" } : d))
    );
    toast.info("Reprise du téléchargement");
  };

  const cancelDownload = (id: string) => {
    setDownloads((prev) => prev.filter((d) => d.id !== id));
    toast.info("Téléchargement annulé");
  };

  const removeDownload = (id: string) => {
    setDownloads((prev) => prev.filter((d) => d.id !== id));
    toast.success("Téléchargement supprimé");
  };

  const clearCompleted = () => {
    setDownloads((prev) => prev.filter((d) => d.status !== "completed"));
    toast.success("Téléchargements terminés supprimés");
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
      case "bunny":
        return "Bunny CDN";
      case "cloudinary":
        return "Cloudinary";
      case "planethoster":
        return "PlanetHoster SFTP";
      case "nexus":
        return "Nexus Local";
      default:
        return "Local";
    }
  };

  const refreshUploadedFiles = async () => {
    setLoadingUploaded(true);
    try {
      // Get user-isolated storage key
      const userId = await getCurrentUserId();
      const storageKey = await getUserStorageKey(UPLOADED_MEDIA_KEY, userId);
      
      const saved = localStorage.getItem(storageKey);
      const uploadedMedia: UploadedFile[] = saved ? JSON.parse(saved) : [];

      try {
        const token = await firebaseService.getIdToken();
        if (token) {
          const response = await fetch("/api/storage/files", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (response.ok) {
            const nexusFiles = await response.json();
            const nexusFileIds = new Set(uploadedMedia.map(f => f.id));
            nexusFiles.forEach((file: any) => {
              if (!nexusFileIds.has(file.id)) {
                uploadedMedia.push({
                  id: file.id,
                  name: file.name,
                  uploadedAt: file.uploadedAt,
                  cloudProvider: "nexus",
                  url: `/api/storage/download/${file.id}`,
                  size: file.size,
                });
              } else {
                const existing = uploadedMedia.find(f => f.id === file.id);
                if (existing && !existing.url) {
                  existing.url = `/api/storage/download/${file.id}`;
                  existing.size = file.size;
                }
              }
            });
          }
        }
      } catch (error) {
        console.error("Failed to fetch Nexus files:", error);
      }

      uploadedMedia.sort((a, b) => 
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      );

      setUploadedFiles(uploadedMedia);
      toast.success("Fichiers uploadés actualisés");
    } catch (error) {
      console.error("Failed to refresh uploaded files:", error);
      toast.error("Erreur lors de l'actualisation");
    } finally {
      setLoadingUploaded(false);
    }
  };

  // Group uploaded files by provider
  const filesByProvider = uploadedFiles.reduce((acc, file) => {
    const provider = file.cloudProvider || "local";
    if (!acc[provider]) {
      acc[provider] = [];
    }
    acc[provider].push(file);
    return acc;
  }, {} as Record<string, UploadedFile[]>);

  const providerOrder = ["bunny", "planethoster", "cloudinary", "nexus", "local"];

  const activeDownloads = downloads.filter(
    (d) => d.status === "downloading" || d.status === "paused"
  );
  const completedDownloads = downloads.filter((d) => d.status === "completed");
  const failedDownloads = downloads.filter((d) => d.status === "failed");

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="font-display text-3xl font-bold text-foreground">
            Téléchargements
          </h1>
          {activeTab === "uploaded" && (
            <Button
              variant="outline"
              size="sm"
              onClick={refreshUploadedFiles}
              disabled={loadingUploaded}
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", loadingUploaded && "animate-spin")} />
              Actualiser
            </Button>
          )}
        </div>
        <p className="text-muted-foreground">
          Gérez vos téléchargements et fichiers uploadés.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-border">
        <button
          onClick={() => setActiveTab("downloads")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            activeTab === "downloads"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Téléchargements ({downloads.length})
        </button>
        <button
          onClick={() => setActiveTab("uploaded")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            activeTab === "uploaded"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Fichiers Uploadés ({uploadedFiles.length})
        </button>
      </div>

      {/* Actions */}
      {completedDownloads.length > 0 && (
        <div className="mb-4 flex justify-end">
          <Button variant="outline" size="sm" onClick={clearCompleted}>
            <Trash2 className="w-4 h-4 mr-2" />
            Supprimer les terminés
          </Button>
        </div>
      )}

      {/* Active Downloads */}
      {activeDownloads.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-display uppercase tracking-widest text-muted-foreground mb-3">
            En cours ({activeDownloads.length})
          </h2>
          <div className="space-y-2">
            {activeDownloads.map((download) => (
              <div
                key={download.id}
                className="p-4 rounded-lg bg-card border border-border"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    {getFileIcon(download.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-foreground">
                      {download.filename}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Progress value={download.progress} className="h-1.5 flex-1" />
                      <span className="text-xs text-muted-foreground">
                        {Math.round(download.progress)}%
                      </span>
                    </div>
                    {download.size > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatFileSize((download.size * download.progress) / 100)} / {formatFileSize(download.size)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {download.status === "downloading" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => pauseDownload(download.id)}
                      >
                        <Pause className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => resumeDownload(download.id)}
                      >
                        <Play className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => cancelDownload(download.id)}
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed Downloads */}
      {completedDownloads.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-display uppercase tracking-widest text-muted-foreground mb-3">
            Terminés ({completedDownloads.length})
          </h2>
          <div className="space-y-2">
            {completedDownloads.map((download) => (
              <div
                key={download.id}
                className="p-4 rounded-lg bg-card border border-border hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    {getFileIcon(download.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-foreground">
                      {download.filename}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                      <span className="text-xs text-muted-foreground">
                        {download.completedAt
                          ? formatDuration(download.completedAt)
                          : "Terminé"}
                      </span>
                      {download.size > 0 && (
                        <>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="text-xs text-muted-foreground">
                            {formatFileSize(download.size)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          const a = document.createElement("a");
                          a.href = download.url;
                          a.download = download.filename;
                          a.click();
                        }}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Télécharger à nouveau
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => removeDownload(download.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Failed Downloads */}
      {failedDownloads.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-display uppercase tracking-widest text-muted-foreground mb-3">
            Échecs ({failedDownloads.length})
          </h2>
          <div className="space-y-2">
            {failedDownloads.map((download) => (
              <div
                key={download.id}
                className="p-4 rounded-lg bg-card border border-destructive/30"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
                    <XCircle className="w-5 h-5 text-destructive" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-foreground">
                      {download.filename}
                    </p>
                    <p className="text-xs text-destructive mt-1">
                      {download.error || "Erreur inconnue"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        removeDownload(download.id);
                        startDownload(download.url, download.filename);
                      }}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Réessayer
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeDownload(download.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Uploaded Files View */}
      {activeTab === "uploaded" && (
        <>
          {loadingUploaded ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <RefreshCw className="w-8 h-8 text-muted-foreground animate-spin mx-auto mb-2" />
                <p className="text-muted-foreground">Chargement des fichiers...</p>
              </div>
            </div>
          ) : uploadedFiles.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center mb-4 mx-auto">
                  <Cloud className="w-10 h-10 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">Aucun fichier uploadé</h3>
                <p className="text-muted-foreground text-sm">
                  Les fichiers que vous uploadez sur les serveurs apparaîtront ici, classés par source.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {providerOrder.map((provider) => {
                const files = filesByProvider[provider] || [];
                if (files.length === 0) return null;

                return (
                  <div key={provider} className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      {getProviderIcon(provider as any)}
                      <h2 className="text-sm font-display uppercase tracking-widest text-muted-foreground">
                        {getProviderName(provider as any)} ({files.length})
                      </h2>
                    </div>
                    <div className="space-y-2">
                      {files.map((file) => (
                        <div
                          key={file.id}
                          className="p-4 rounded-lg bg-card border border-border hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                              {getFileIcon(getFileType(file.name))}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate text-foreground">
                                {file.name}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-muted-foreground">
                                  {formatDuration(new Date(file.uploadedAt))}
                                </span>
                                {file.size && (
                                  <>
                                    <span className="text-xs text-muted-foreground">•</span>
                                    <span className="text-xs text-muted-foreground">
                                      {formatFileSize(file.size)}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {file.url && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => startDownload(file.url!, file.name)}
                                >
                                  <Download className="w-4 h-4 mr-2" />
                                  Télécharger
                                </Button>
                              )}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {file.url && (
                                    <>
                                      <DropdownMenuItem
                                        onClick={() => {
                                          const a = document.createElement("a");
                                          a.href = file.url!;
                                          a.download = file.name;
                                          a.click();
                                        }}
                                      >
                                        <Download className="w-4 h-4 mr-2" />
                                        Télécharger directement
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                    </>
                                  )}
                                  <DropdownMenuItem
                                    onClick={async () => {
                                      const updated = uploadedFiles.filter(f => f.id !== file.id);
                                      setUploadedFiles(updated);
                                      
                                      // Get user-isolated storage key
                                      const userId = await getCurrentUserId();
                                      const storageKey = await getUserStorageKey(UPLOADED_MEDIA_KEY, userId);
                                      localStorage.setItem(storageKey, JSON.stringify(updated));
                                      
                                      // Sync to Firebase if available
                                      try {
                                        const { firebaseSyncService } = await import('@/services/firebase-sync');
                                        firebaseSyncService.queueSync('uploadedMedia', updated);
                                      } catch (error) {
                                        // Silently fail if Firebase sync is not available
                                      }
                                      
                                      toast.success("Fichier supprimé de la liste");
                                    }}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Supprimer de la liste
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Empty State for Downloads */}
      {activeTab === "downloads" && downloads.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center mb-4 mx-auto">
              <Download className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">Aucun téléchargement</h3>
            <p className="text-muted-foreground text-sm">
              Vos téléchargements de fichiers apparaîtront ici. Utilisez le menu contextuel
              sur les fichiers pour les télécharger.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

