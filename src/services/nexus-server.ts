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
                // Load existing uploaded media
                const saved = localStorage.getItem('nexus-uploaded-media');
                const uploadedMedia: Array<{ id: string; name: string; uploadedAt: string; cloudProvider?: 'cloudinary' | 'nexus' | 'bunny'; url?: string; size?: number }> = saved ? JSON.parse(saved) : [];
                
                // Determine provider from API response
                const provider = result.provider === 'bunny' ? 'bunny' as const : 
                                result.provider === 'local' ? 'nexus' as const : 
                                'nexus' as const;
                
                const newEntry = {
                  id: result.id,
                  name: fileName,
                  uploadedAt: new Date().toISOString(),
                  cloudProvider: provider,
                  url: result.url,
                  size: result.size || file.size,
                };
                const updated = [newEntry, ...uploadedMedia.filter(m => m.id !== result.id)].slice(0, 100); // Keep last 100
                localStorage.setItem('nexus-uploaded-media', JSON.stringify(updated));
                firebaseSyncService.queueSync('uploadedMedia', updated);
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
          try {
            const error = JSON.parse(xhr.responseText);
            reject(new Error(error.message || `Upload failed: ${xhr.status}`));
          } catch {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
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

  // Get sync status
  async getSyncStatus(): Promise<SyncStatus> {
    const accessToken = await authService.getAccessToken();
    if (!accessToken) {
      return {
        lastSyncAt: "",
        tracksUploaded: 0,
        tracksDownloaded: 0,
        totalStorage: 0,
      };
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

      return response.json();
    } catch (error) {
      console.warn("Error getting sync status (backend may not be configured):", error);
      // Return data from localStorage as fallback
      return {
        lastSyncAt: localStorage.getItem("nexus-last-sync") || "",
        tracksUploaded: parseInt(localStorage.getItem("nexus-tracks-uploaded") || "0"),
        tracksDownloaded: parseInt(localStorage.getItem("nexus-tracks-downloaded") || "0"),
        totalStorage: authService.getUserProfile()?.storageUsed || 0,
      };
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
