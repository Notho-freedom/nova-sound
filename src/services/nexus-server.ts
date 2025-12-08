import { firebaseService, UserProfile } from "./firebase";
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

const API_BASE_URL = import.meta.env.VITE_API_URL || "";

class NexusServerService {
  // Check if authenticated
  isAuthenticated(): boolean {
    return firebaseService.getCurrentUser() !== null;
  }

  // Check if pro user
  isPro(): boolean {
    return firebaseService.isPro();
  }

  // Get current user profile
  getUser(): UserProfile | null {
    return firebaseService.getUserProfile();
  }

  // Subscribe to auth state changes
  onAuthStateChange(callback: (user: UserProfile | null) => void): () => void {
    return firebaseService.onAuthStateChange((user) => {
      if (user) {
        callback(firebaseService.getUserProfile());
      } else {
        callback(null);
      }
    });
  }

  // Login with Google
  async loginWithGoogle(): Promise<UserProfile> {
    return firebaseService.signInWithGoogle();
  }

  // Logout
  async logout(): Promise<void> {
    await firebaseService.signOut();
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
    const idToken = await firebaseService.getIdToken();
    if (!idToken) {
      throw new Error("Not authenticated");
    }

    // Check if user is pro for unlimited storage
    const userProfile = firebaseService.getUserProfile();
    if (!firebaseService.isPro() && userProfile) {
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
      xhr.setRequestHeader("Authorization", `Bearer ${idToken}`);
      xhr.send(formData);
    });
  }

  // Download file from Nexus servers
  async downloadFile(fileId: string, onProgress?: (progress: number) => void): Promise<Blob> {
    const idToken = await firebaseService.getIdToken();
    if (!idToken) {
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
      xhr.setRequestHeader("Authorization", `Bearer ${idToken}`);
      xhr.send();
    });
  }

  // Get sync status
  async getSyncStatus(): Promise<SyncStatus> {
    const idToken = await firebaseService.getIdToken();
    if (!idToken) {
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
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to get sync status");
      }

      return response.json();
    } catch (error) {
      console.error("Error getting sync status:", error);
      // Return data from localStorage as fallback
      return {
        lastSyncAt: localStorage.getItem("nexus-last-sync") || "",
        tracksUploaded: parseInt(localStorage.getItem("nexus-tracks-uploaded") || "0"),
        tracksDownloaded: parseInt(localStorage.getItem("nexus-tracks-downloaded") || "0"),
        totalStorage: firebaseService.getUserProfile()?.storageUsed || 0,
      };
    }
  }

  // Start sync
  async startSync(): Promise<void> {
    const idToken = await firebaseService.getIdToken();
    if (!idToken) {
      throw new Error("Not authenticated");
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/sync/start`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
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
    const idToken = await firebaseService.getIdToken();
    if (!idToken) {
      return [];
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/storage/files`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
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
    const idToken = await firebaseService.getIdToken();
    if (!idToken) {
      throw new Error("Not authenticated");
    }

    const response = await fetch(`${API_BASE_URL}/api/storage/files/${fileId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to delete file");
    }
  }
}

export const nexusServerService = new NexusServerService();
