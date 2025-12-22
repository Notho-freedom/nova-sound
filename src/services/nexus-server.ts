import { authService, UserProfile } from "./auth";
import { stripeService } from "./stripe";

export type { UserProfile as NexusUser };

export interface SyncStatus {
  lastSyncAt: string;
  tracksUploaded: number;
  tracksDownloaded: number;
  totalStorage: number;
}

export interface UploadResult {
  id: string;
  url: string;
  size: number;
}

// Use Next.js API routes (same origin - no base URL needed)
const API_BASE_URL = '';

class NexusServerService {
  // Check if authenticated
  isAuthenticated(): boolean {
    // Try Firebase first
    try {
      const { firebaseService } = require('./firebase');
      if (firebaseService.isInitialized() && firebaseService.getCurrentUser()) {
        return true;
      }
    } catch (error) {
      // Firebase not available
    }
    // Fallback to authService
    return authService.isAuthenticated();
  }

  // Check if pro user
  isPro(): boolean {
    // Try Firebase first
    try {
      const { firebaseService } = require('./firebase');
      if (firebaseService.isInitialized()) {
        return firebaseService.isPro();
      }
    } catch (error) {
      // Firebase not available
    }
    // Fallback to authService
    return authService.isPro();
  }

  // Get current user profile
  getUser(): UserProfile | null {
    return authService.getUserProfile();
  }

  // Subscribe to auth state changes
  onAuthStateChange(callback: (user: UserProfile | null) => void): () => void {
    return authService.onAuthStateChange(callback);
  }

  // Login with Google
  async loginWithGoogle(): Promise<void> {
    await authService.signInWithGoogle();
  }

  // Logout
  async logout(): Promise<void> {
    await authService.signOut();
  }

  // Upgrade to Pro (redirect to Stripe Checkout)
  async upgradeToPro(): Promise<void> {
    await stripeService.redirectToCheckout();
  }

  // Manage billing (redirect to Stripe Portal)
  async manageBilling(): Promise<void> {
    await stripeService.redirectToPortal();
  }

  // Get subscription status
  async getSubscriptionStatus() {
    return stripeService.getSubscriptionStatus();
  }

  // Upload file to Nexus servers
  async uploadFile(
    file: Blob,
    fileName: string,
    onProgress?: (progress: number) => void
  ): Promise<UploadResult> {
    console.log("Upload file: Getting access token...");
    
    // Try Firebase first (if user is connected via Firebase)
    let accessToken: string | null = null;
    
    try {
      const { firebaseService } = await import('./firebase');
      if (firebaseService.isInitialized() && firebaseService.getCurrentUser()) {
        accessToken = await firebaseService.getIdToken();
        console.log("Firebase token received:", accessToken ? "✓ Token length: " + accessToken.length : "✗ No token");
      }
    } catch (error) {
      console.log('Firebase not available, trying authService...');
    }
    
    // Fallback to authService (manual OAuth)
    if (!accessToken) {
      accessToken = await authService.getAccessToken();
      console.log("AuthService token received:", accessToken ? "✓ Token length: " + accessToken.length : "✗ No token");
    }
    
    if (!accessToken) {
      const firebaseUser = await import('./firebase').then(m => m.firebaseService.getCurrentUser()).catch(() => null);
      const authUser = authService.getCurrentUser();
      console.error("No access token available. Firebase user:", firebaseUser?.email, "AuthService user:", authUser?.email);
      throw new Error("Not authenticated - no token available");
    }

    // Check if user is pro for unlimited storage
    const userProfile = authService.getUserProfile();
    if (!authService.isPro() && userProfile) {
      const storageLimit = 1024 * 1024 * 1024; // 1GB for free users
      if (userProfile.storageUsed + file.size > storageLimit) {
        throw new Error("Limite de stockage atteinte. Passez au Pro pour un stockage illimité.");
      }
    }

    // Create form data
    const formData = new FormData();
    formData.append("file", file, fileName);

    // Upload with progress tracking using XMLHttpRequest
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          onProgress?.(Math.round((e.loaded / e.total) * 100));
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const result = JSON.parse(xhr.responseText);
            
            // Track uploaded media for sync
            (async () => {
              try {
                const { firebaseSyncService } = await import('./firebase-sync');
                const { getUserStorageKey } = await import('@/lib/storage-utils');
                
                // Get user-isolated storage key
                const storageKey = await getUserStorageKey('nexus-uploaded-media');
                
                // Load existing uploaded media
                const saved = localStorage.getItem(storageKey);
                const uploadedMedia: Array<{ id: string; name: string; uploadedAt: string; cloudProvider?: 'cloudinary' | 'nexus' | 'bunny' | 'planethoster'; url?: string; size?: number }> = saved ? JSON.parse(saved) : [];
                
                // Determine provider from API response
                // Free users: cloudinary (serveur 0)
                // Pro users: bunny (serveur 1) or planethoster (serveur 2)
                const provider = result.provider === 'cloudinary' ? 'cloudinary' as const :
                                result.provider === 'bunny' ? 'bunny' as const : 
                                result.provider === 'planethoster' ? 'planethoster' as const :
                                result.provider === 'local' ? 'nexus' as const : 
                                'nexus' as const;
                
                console.log(`[NexusServer] Upload successful - Provider: ${provider}, Server: ${result.server || 'N/A'}`);
                
                const newEntry = {
                  id: result.id,
                  name: fileName,
                  uploadedAt: new Date().toISOString(),
                  cloudProvider: provider,
                  url: result.url,
                  size: result.size || file.size,
                };
                const updated = [newEntry, ...uploadedMedia.filter(m => m.id !== result.id)].slice(0, 100); // Keep last 100
                localStorage.setItem(storageKey, JSON.stringify(updated));
                firebaseSyncService.queueSync('uploadedMedia', updated);
                
                // Dispatch custom event to notify DownloadsView
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('uploadedMediaChanged', { 
                    detail: { storageKey, count: updated.length } 
                  }));
                }
              } catch (error) {
                // Silently fail if Firebase sync is not available
              }
            })();
            
            resolve({
              id: result.id,
              url: result.url,
              size: file.size,
            });
          } catch {
            reject(new Error("Invalid response from server"));
          }
        } else {
          // Enhanced error handling with detailed messages
          let errorMessage = `Upload failed: ${xhr.status}`;
          let errorDetails: string | null = null;
          
          try {
            const errorResponse = JSON.parse(xhr.responseText);
            
            // Extract error message from various possible response formats
            if (errorResponse.error?.message) {
              errorMessage = errorResponse.error.message;
              errorDetails = errorResponse.error.details || null;
            } else if (errorResponse.message) {
              errorMessage = errorResponse.message;
              errorDetails = errorResponse.details || null;
            } else if (errorResponse.error) {
              errorMessage = typeof errorResponse.error === 'string' 
                ? errorResponse.error 
                : errorResponse.error.message || errorMessage;
            }
            
            // Detect specific error types and provide user-friendly messages
            const errorText = (errorMessage + ' ' + (errorDetails || '')).toLowerCase();
            
            if (errorText.includes('timeout') || errorText.includes('timed out') || errorText.includes('handshake')) {
              errorMessage = "Timeout de connexion au serveur de stockage. Le serveur PlanetHoster/Bunny ne répond pas. Veuillez réessayer dans quelques instants.";
            } else if (errorText.includes('connection') || errorText.includes('connection lost') || errorText.includes('network')) {
              errorMessage = "Erreur de connexion au serveur de stockage. Vérifiez votre connexion internet et réessayez.";
            } else if (errorText.includes('authentication') || errorText.includes('unauthorized') || xhr.status === 401) {
              errorMessage = "Erreur d'authentification. Veuillez vous reconnecter.";
            } else if (errorText.includes('storage') || errorText.includes('limit') || errorText.includes('quota')) {
              errorMessage = "Limite de stockage atteinte. Passez au plan Pro pour un stockage illimité.";
            } else if (errorText.includes('failed to upload') || errorText.includes('upload vers le cloud')) {
              // Extract the underlying error from the message
              const match = errorMessage.match(/Failed to upload to (PlanetHoster|Bunny):\s*(.+)/i);
              if (match) {
                const provider = match[1];
                const underlyingError = match[2];
                if (underlyingError.includes('timeout') || underlyingError.includes('handshake')) {
                  errorMessage = `Timeout de connexion à ${provider}. Le serveur ne répond pas. Veuillez réessayer.`;
                } else {
                  errorMessage = `Erreur lors de l'upload vers ${provider}: ${underlyingError}`;
                }
              }
            }
            
            // Add details if available and not already included
            if (errorDetails && !errorMessage.includes(errorDetails)) {
              errorMessage += ` (${errorDetails})`;
            }
          } catch {
            // If response is not JSON, try to get status text
            if (xhr.statusText) {
              errorMessage = xhr.statusText;
            }
            
            // Provide specific messages for common status codes
            if (xhr.status === 500) {
              errorMessage = "Erreur serveur (500). Le serveur de stockage rencontre un problème. Veuillez réessayer plus tard ou contacter le support.";
            } else if (xhr.status === 503) {
              errorMessage = "Service temporairement indisponible. Le serveur de stockage est en maintenance. Veuillez réessayer plus tard.";
            } else if (xhr.status === 504) {
              errorMessage = "Timeout du serveur. La requête a pris trop de temps. Veuillez réessayer.";
            }
          }
          
          reject(new Error(errorMessage));
        }
      });

      xhr.addEventListener("error", () => {
        reject(new Error("Network error during upload"));
      });

      xhr.addEventListener("abort", () => {
        reject(new Error("Upload aborted"));
      });

      xhr.open("POST", `${API_BASE_URL}/api/storage/upload`);
      xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
      xhr.send(formData);
    });
  }

  // Download file from Nexus servers
  async downloadFile(fileId: string, onProgress?: (progress: number) => void): Promise<Blob> {
    const accessToken = await authService.getAccessToken();
    if (!accessToken) {
      throw new Error("Not authenticated");
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.responseType = "blob";

      xhr.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          onProgress?.(Math.round((e.loaded / e.total) * 100));
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(xhr.response);
        } else {
          reject(new Error(`Download failed: ${xhr.status}`));
        }
      });

      xhr.addEventListener("error", () => {
        reject(new Error("Network error during download"));
      });

      xhr.open("GET", `${API_BASE_URL}/api/storage/download/${fileId}`);
      xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
      xhr.send();
    });
  }

  // Cache for sync status to avoid repeated calls
  private syncStatusCache: { data: SyncStatus | null; timestamp: number } = {
    data: null,
    timestamp: 0,
  };
  private readonly SYNC_STATUS_CACHE_DURATION = 5000; // 5 seconds cache

  // Get sync status (with caching to prevent excessive API calls)
  async getSyncStatus(forceRefresh = false): Promise<SyncStatus> {
    // Return cached data if still valid and not forcing refresh
    const now = Date.now();
    if (!forceRefresh && this.syncStatusCache.data && (now - this.syncStatusCache.timestamp) < this.SYNC_STATUS_CACHE_DURATION) {
      return this.syncStatusCache.data;
    }

    const accessToken = await authService.getAccessToken();
    if (!accessToken) {
      const fallbackStatus = {
        lastSyncAt: "",
        tracksUploaded: 0,
        tracksDownloaded: 0,
        totalStorage: 0,
      };
      this.syncStatusCache = { data: fallbackStatus, timestamp: now };
      return fallbackStatus;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/sync/status`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get sync status: ${response.status}`);
      }

      // Check if response is JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.warn("Backend API not available or not configured. Using local storage for sync status.");
        // Return data from localStorage as fallback
        return {
          lastSyncAt: localStorage.getItem("nexus-last-sync") || "",
          tracksUploaded: parseInt(localStorage.getItem("nexus-tracks-uploaded") || "0"),
          tracksDownloaded: parseInt(localStorage.getItem("nexus-tracks-downloaded") || "0"),
          totalStorage: authService.getUserProfile()?.storageUsed || 0,
        };
      }

      const status = await response.json();
      // Cache the result
      this.syncStatusCache = { data: status, timestamp: now };
      return status;
    } catch (error) {
      console.warn("Error getting sync status (backend may not be configured):", error);
      // Return data from localStorage as fallback
      const fallbackStatus = {
        lastSyncAt: localStorage.getItem("nexus-last-sync") || "",
        tracksUploaded: parseInt(localStorage.getItem("nexus-tracks-uploaded") || "0"),
        tracksDownloaded: parseInt(localStorage.getItem("nexus-tracks-downloaded") || "0"),
        totalStorage: authService.getUserProfile()?.storageUsed || 0,
      };
      // Cache the fallback result
      this.syncStatusCache = { data: fallbackStatus, timestamp: now };
      return fallbackStatus;
    }
  }

  // Start sync
  async startSync(): Promise<void> {
    const accessToken = await authService.getAccessToken();
    if (!accessToken) {
      throw new Error("Not authenticated");
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/sync/start`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to start sync");
      }

      // Update local sync timestamp
      localStorage.setItem("nexus-last-sync", new Date().toISOString());
    } catch (error) {
      console.error("Sync error:", error);
      throw error;
    }
  }

  // Get file list from server
  async getFileList(): Promise<Array<{ id: string; name: string; size: number; uploadedAt: string }>> {
    const accessToken = await authService.getAccessToken();
    if (!accessToken) {
      return [];
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/storage/files`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to get file list");
      }

      return response.json();
    } catch (error) {
      console.error("Error getting file list:", error);
      return [];
    }
  }

  // Delete file from server
  async deleteFile(fileId: string): Promise<void> {
    const accessToken = await authService.getAccessToken();
    if (!accessToken) {
      throw new Error("Not authenticated");
    }

    const response = await fetch(`${API_BASE_URL}/api/storage/files/${fileId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to delete file");
    }
  }
}

export const nexusServerService = new NexusServerService();
