export interface NexusUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  plan: "free" | "pro";
  subscription?: {
    status: "active" | "canceled" | "past_due";
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
  };
  storageUsed: number;
  storageLimit: number;
  createdAt: string;
}

export interface NexusSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

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

const NEXUS_API_URL = "https://api.nexus-audio.com"; // Placeholder URL

class NexusServerService {
  private session: NexusSession | null = null;
  private user: NexusUser | null = null;

  constructor() {
    // Load session from localStorage
    this.loadSession();
  }

  private loadSession(): void {
    const savedSession = localStorage.getItem("nexus-server-session");
    const savedUser = localStorage.getItem("nexus-server-user");
    
    if (savedSession) {
      try {
        this.session = JSON.parse(savedSession);
        // Check if session is expired
        if (this.session && this.session.expiresAt < Date.now()) {
          this.logout();
          return;
        }
      } catch {
        this.session = null;
      }
    }
    
    if (savedUser) {
      try {
        this.user = JSON.parse(savedUser);
      } catch {
        this.user = null;
      }
    }
  }

  // Check if authenticated
  isAuthenticated(): boolean {
    return this.session !== null && this.session.expiresAt > Date.now();
  }

  // Check if pro user
  isPro(): boolean {
    return this.user?.plan === "pro";
  }

  // Get current user
  getUser(): NexusUser | null {
    return this.user;
  }

  // Login with email/password
  async login(email: string, password: string): Promise<NexusUser> {
    // Try to call the real API
    const response = await fetch(`${NEXUS_API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }).catch(() => null);

    // Mock response for development when API is not available
    if (!response) {
      return this.createMockSession(email, email.split("@")[0]);
    }

    const data = await response.json();
    this.session = data.session;
    this.user = data.user;

    this.saveSession();
    return this.user;
  }

  // Login with Google
  async loginWithGoogle(credential: string): Promise<NexusUser> {
    // Try to call the real API with Google credential
    const response = await fetch(`${NEXUS_API_URL}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    }).catch(() => null);

    // Mock response for development when API is not available
    if (!response) {
      // Decode JWT to get user info (for demo purposes)
      try {
        const payload = JSON.parse(atob(credential.split(".")[1]));
        return this.createMockSession(
          payload.email || "user@example.com",
          payload.name || "Google User",
          payload.picture
        );
      } catch {
        return this.createMockSession(
          "googleuser@example.com",
          "Google User",
          "https://lh3.googleusercontent.com/a/default-user"
        );
      }
    }

    const data = await response.json();
    this.session = data.session;
    this.user = data.user;

    this.saveSession();
    return this.user;
  }

  // Login with OAuth code (for popup flow)
  async loginWithOAuthCode(code: string, provider: string): Promise<NexusUser> {
    // Try to call the real API
    const response = await fetch(`${NEXUS_API_URL}/auth/oauth/callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, provider }),
    }).catch(() => null);

    // Mock response for development when API is not available
    if (!response) {
      return this.createMockSession(
        `${provider}user@example.com`,
        `${provider.charAt(0).toUpperCase() + provider.slice(1)} User`,
        "https://lh3.googleusercontent.com/a/default-user"
      );
    }

    const data = await response.json();
    this.session = data.session;
    this.user = data.user;

    this.saveSession();
    return this.user;
  }

  // Create mock session (for demo/development)
  private createMockSession(email: string, name: string, avatarUrl?: string): NexusUser {
    this.session = {
      accessToken: `mock_access_token_${Date.now()}`,
      refreshToken: `mock_refresh_token_${Date.now()}`,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    };
    
    this.user = {
      id: `user_${Date.now()}`,
      email,
      name,
      avatarUrl,
      plan: "free",
      storageUsed: 0,
      storageLimit: 1024 * 1024 * 1024, // 1GB for free
      createdAt: new Date().toISOString(),
    };

    this.saveSession();
    return this.user;
  }

  private saveSession(): void {
    if (this.session) {
      localStorage.setItem("nexus-server-session", JSON.stringify(this.session));
    }
    if (this.user) {
      localStorage.setItem("nexus-server-user", JSON.stringify(this.user));
    }
  }

  // Register new account
  async register(email: string, password: string, name: string): Promise<NexusUser> {
    const response = await fetch(`${NEXUS_API_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    }).catch(() => null);

    // Mock response for development
    if (!response) {
      return this.createMockSession(email, name);
    }

    const data = await response.json();
    return this.login(email, password);
  }

  // Logout
  logout(): void {
    this.session = null;
    this.user = null;
    localStorage.removeItem("nexus-server-session");
    localStorage.removeItem("nexus-server-user");
  }

  // Get Stripe checkout URL for pro upgrade
  async getProCheckoutUrl(): Promise<string> {
    if (!this.isAuthenticated()) {
      throw new Error("Not authenticated");
    }

    const response = await fetch(`${NEXUS_API_URL}/billing/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.session!.accessToken}`,
      },
      body: JSON.stringify({
        priceId: "price_nexus_pro_monthly",
        successUrl: window.location.origin + "/settings?success=true",
        cancelUrl: window.location.origin + "/settings?canceled=true",
      }),
    }).catch(() => null);

    // Mock URL for development - show message
    if (!response) {
      // In demo mode, simulate upgrade
      if (this.user) {
        this.user.plan = "pro";
        this.user.storageLimit = -1; // Unlimited
        this.user.subscription = {
          status: "active",
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          cancelAtPeriodEnd: false,
        };
        this.saveSession();
      }
      return "DEMO_UPGRADE_SUCCESS";
    }

    const data = await response.json();
    return data.url;
  }

  // Get billing portal URL
  async getBillingPortalUrl(): Promise<string> {
    if (!this.isAuthenticated()) {
      throw new Error("Not authenticated");
    }

    const response = await fetch(`${NEXUS_API_URL}/billing/portal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.session!.accessToken}`,
      },
    }).catch(() => null);

    // Mock URL for development
    if (!response) {
      return "DEMO_BILLING_PORTAL";
    }

    const data = await response.json();
    return data.url;
  }

  // Upload file to Nexus servers
  async uploadFile(
    file: Blob,
    fileName: string,
    onProgress?: (progress: number) => void
  ): Promise<UploadResult | null> {
    if (!this.isAuthenticated()) {
      throw new Error("Not authenticated");
    }

    // Check storage limit for non-pro users
    if (!this.isPro() && this.user) {
      if (this.user.storageUsed + file.size > this.user.storageLimit) {
        throw new Error("Storage limit exceeded. Upgrade to Pro for unlimited storage.");
      }
    }

    // Get presigned upload URL
    const presignResponse = await fetch(`${NEXUS_API_URL}/storage/presign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.session!.accessToken}`,
      },
      body: JSON.stringify({
        fileName,
        fileSize: file.size,
        contentType: file.type,
      }),
    }).catch(() => null);

    // Mock for development
    if (!presignResponse) {
      // Simulate upload progress
      return new Promise((resolve) => {
        let progress = 0;
        const interval = setInterval(() => {
          progress += 10;
          onProgress?.(progress);
          if (progress >= 100) {
            clearInterval(interval);
            
            // Update storage used
            if (this.user) {
              this.user.storageUsed += file.size;
              this.saveSession();
            }
            
            resolve({
              id: `file_${Date.now()}`,
              url: `https://cdn.nexus-audio.com/files/${fileName}`,
              size: file.size,
            });
          }
        }, 200);
      });
    }

    const { uploadUrl, fileId } = await presignResponse.json();

    // Upload to presigned URL
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          onProgress?.(Math.round((e.loaded / e.total) * 100));
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({
            id: fileId,
            url: `https://cdn.nexus-audio.com/files/${fileId}`,
            size: file.size,
          });
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      });

      xhr.addEventListener("error", () => {
        reject(new Error("Network error during upload"));
      });

      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.send(file);
    });
  }

  // Get sync status
  async getSyncStatus(): Promise<SyncStatus> {
    if (!this.isAuthenticated()) {
      return {
        lastSyncAt: "",
        tracksUploaded: 0,
        tracksDownloaded: 0,
        totalStorage: 0,
      };
    }

    const response = await fetch(`${NEXUS_API_URL}/sync/status`, {
      headers: {
        Authorization: `Bearer ${this.session!.accessToken}`,
      },
    }).catch(() => null);

    // Mock for development
    if (!response) {
      const lastSync = localStorage.getItem("nexus-last-sync");
      const tracksUploaded = parseInt(localStorage.getItem("nexus-tracks-uploaded") || "0");
      const tracksDownloaded = parseInt(localStorage.getItem("nexus-tracks-downloaded") || "0");
      
      return {
        lastSyncAt: lastSync || "",
        tracksUploaded,
        tracksDownloaded,
        totalStorage: this.user?.storageUsed || 0,
      };
    }

    return response.json();
  }

  // Start sync
  async startSync(): Promise<void> {
    if (!this.isAuthenticated()) {
      throw new Error("Not authenticated");
    }

    // Update last sync time
    localStorage.setItem("nexus-last-sync", new Date().toISOString());
    
    console.log("Starting sync...");
    // In a real implementation, this would trigger a background sync
  }

  // Refresh user data
  async refreshUser(): Promise<void> {
    if (!this.isAuthenticated()) return;

    const response = await fetch(`${NEXUS_API_URL}/user/me`, {
      headers: {
        Authorization: `Bearer ${this.session!.accessToken}`,
      },
    }).catch(() => null);

    if (response) {
      this.user = await response.json();
      this.saveSession();
    }
  }
}

export const nexusServerService = new NexusServerService();
