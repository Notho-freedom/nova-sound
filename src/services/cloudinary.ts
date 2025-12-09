import { Track } from "@/types/music";

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  uploadPreset: string;
}

export interface UploadProgress {
  trackId: string;
  fileName: string;
  progress: number;
  status: "pending" | "uploading" | "complete" | "error";
  error?: string;
}

export interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  resource_type: string;
  format: string;
  bytes: number;
}

class CloudinaryService {
  private config: CloudinaryConfig | null = null;
  private uploadQueue: Map<string, UploadProgress> = new Map();
  private listeners: Set<(progress: Map<string, UploadProgress>) => void> = new Set();

  // Load config from localStorage
  loadConfig(): CloudinaryConfig | null {
    const saved = localStorage.getItem("nexus-cloudinary-config");
    if (saved) {
      try {
        this.config = JSON.parse(saved);
        return this.config;
      } catch {
        return null;
      }
    }
    return null;
  }

  // Save config
  saveConfig(config: CloudinaryConfig): void {
    this.config = config;
    localStorage.setItem("nexus-cloudinary-config", JSON.stringify(config));
  }

  // Clear config
  clearConfig(): void {
    this.config = null;
    localStorage.removeItem("nexus-cloudinary-config");
  }

  // Check if configured
  isConfigured(): boolean {
    return this.config !== null && 
           !!this.config.cloudName && 
           !!this.config.uploadPreset;
  }

  // Subscribe to progress updates
  onProgressUpdate(listener: (progress: Map<string, UploadProgress>) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Notify listeners
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(new Map(this.uploadQueue)));
  }

  // Get overall upload progress
  getOverallProgress(): number {
    if (this.uploadQueue.size === 0) return 0;
    let total = 0;
    this.uploadQueue.forEach(p => {
      total += p.progress;
    });
    return Math.round(total / this.uploadQueue.size);
  }

  // Upload a single file
  async uploadTrack(
    track: Track, 
    fileBlob: Blob,
    onProgress?: (progress: number) => void
  ): Promise<CloudinaryUploadResult | null> {
    if (!this.config || !this.isConfigured()) {
      throw new Error("Cloudinary not configured");
    }

    const progress: UploadProgress = {
      trackId: track.id,
      fileName: track.title,
      progress: 0,
      status: "uploading",
    };
    this.uploadQueue.set(track.id, progress);
    this.notifyListeners();

    try {
      const formData = new FormData();
      formData.append("file", fileBlob, `${track.title}.${track.format || "mp3"}`);
      formData.append("upload_preset", this.config.uploadPreset);
      formData.append("resource_type", "video"); // Cloudinary uses "video" for audio files
      formData.append("public_id", `nexus/${track.artist}/${track.album}/${track.title}`);

      // Use XMLHttpRequest for progress tracking
      const result = await new Promise<CloudinaryUploadResult>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            progress.progress = percent;
            this.uploadQueue.set(track.id, progress);
            this.notifyListeners();
            onProgress?.(percent);
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch {
              reject(new Error("Invalid response from Cloudinary"));
            }
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        });

        xhr.addEventListener("error", () => {
          reject(new Error("Network error during upload"));
        });

        xhr.open("POST", `https://api.cloudinary.com/v1_1/${this.config!.cloudName}/upload`);
        xhr.send(formData);
      });

      progress.status = "complete";
      progress.progress = 100;
      this.uploadQueue.set(track.id, progress);
      this.notifyListeners();

      // Track uploaded media for sync
      if (result && result.publicId) {
        (async () => {
          try {
            const { firebaseSyncService } = await import('./firebase-sync');
            // Load existing uploaded media
            const saved = localStorage.getItem('nexus-uploaded-media');
            const uploadedMedia: Array<{ id: string; name: string; uploadedAt: string; cloudProvider?: string }> = saved ? JSON.parse(saved) : [];
            const newEntry = {
              id: track.id,
              name: track.title,
              uploadedAt: new Date().toISOString(),
              cloudProvider: 'cloudinary' as const,
            };
            const updated = [newEntry, ...uploadedMedia.filter(m => m.id !== track.id)].slice(0, 100); // Keep last 100
            localStorage.setItem('nexus-uploaded-media', JSON.stringify(updated));
            firebaseSyncService.queueSync('uploadedMedia', updated);
          } catch (error) {
            // Silently fail if Firebase sync is not available
          }
        })();
      }

      return result;
    } catch (error) {
      progress.status = "error";
      progress.error = error instanceof Error ? error.message : "Unknown error";
      this.uploadQueue.set(track.id, progress);
      this.notifyListeners();
      return null;
    }
  }

  // Upload multiple tracks
  async uploadTracks(
    tracks: Track[],
    getBlob: (track: Track) => Promise<Blob | null>,
    onProgress?: (overall: number, current: UploadProgress) => void
  ): Promise<Map<string, CloudinaryUploadResult | null>> {
    const results = new Map<string, CloudinaryUploadResult | null>();

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      const blob = await getBlob(track);
      
      if (blob) {
        const result = await this.uploadTrack(track, blob, (progress) => {
          onProgress?.(this.getOverallProgress(), this.uploadQueue.get(track.id)!);
        });
        results.set(track.id, result);
      } else {
        results.set(track.id, null);
      }
    }

    return results;
  }

  // Clear completed uploads from queue
  clearCompleted(): void {
    this.uploadQueue.forEach((progress, id) => {
      if (progress.status === "complete" || progress.status === "error") {
        this.uploadQueue.delete(id);
      }
    });
    this.notifyListeners();
  }
}

export const cloudinaryService = new CloudinaryService();

