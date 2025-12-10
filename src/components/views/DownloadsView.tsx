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

const DOWNLOADS_STORAGE_KEY = "nexus-downloads";

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
      const blob = new Blob(chunks);
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

  const activeDownloads = downloads.filter(
    (d) => d.status === "downloading" || d.status === "paused"
  );
  const completedDownloads = downloads.filter((d) => d.status === "completed");
  const failedDownloads = downloads.filter((d) => d.status === "failed");

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-foreground mb-2">
          Téléchargements
        </h1>
        <p className="text-muted-foreground">
          Gérez vos téléchargements de fichiers audio, vidéo et autres.
        </p>
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

      {/* Empty State */}
      {downloads.length === 0 && (
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

