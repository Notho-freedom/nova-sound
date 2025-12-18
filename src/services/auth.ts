// Service d'authentification manuel avec Google OAuth
// Ne dépend pas de Firebase Auth

import { isElectron } from '@/lib/electron-detector';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  plan: "free" | "pro";
  subscriptionStatus?: "active" | "canceled" | "past_due" | "trialing" | null;
  storageUsed: number;
  createdAt: string;
  lastLoginAt: string;
  isAnonymous?: boolean; // Indique si l'utilisateur est anonyme
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt: number;
}

const STORAGE_KEYS = {
  USER_PROFILE: "nexus-user-profile",
  AUTH_TOKENS: "nexus-auth-tokens",
  GOOGLE_CLIENT_ID: "nexus-google-client-id",
};

// Google OAuth Configuration
const GOOGLE_OAUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v2/userinfo";

// Production URL for Electron redirect_uri (must match Google Cloud Console configuration)
const PRODUCTION_URL = process.env.NEXT_PUBLIC_VERCEL_URL || 'https://nova-sound-nine.vercel.app';

// Backend proxy endpoint (optional - if not set, will use Next.js API route)
// Next.js: Use  prefix for client-side env vars
const OAUTH_PROXY_ENDPOINT = 
  (typeof window !== 'undefined' ? process.env.OAUTH_PROXY_URL : null) || null;

// Next.js API route for OAuth token exchange (uses server-side credentials)
// This is the default and secure method for web applications
const OAUTH_API_ENDPOINT = '/api/oauth/token';

class AuthService {
  private currentUser: UserProfile | null = null;
  private authTokens: AuthTokens | null = null;
  private authStateListeners: Set<(user: UserProfile | null) => void> = new Set();
  private googleClientId: string | null = null;
  private tokenRefreshInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Load persisted data (only for manual OAuth users, not Firebase anonymous)
    this.loadFromStorage();
    
    // Preload Google Client ID from API (non-blocking)
    if (typeof window !== 'undefined') {
      this.loadGoogleClientId().catch((error) => {
        console.warn("Failed to preload Google Client ID:", error);
      });
    }
    
    // Check if tokens are expired
    if (this.authTokens && this.authTokens.expiresAt < Date.now()) {
      console.log("Tokens expired, attempting refresh...");
      // Only try to refresh if not anonymous (anonymous users don't have refresh tokens)
      if (!this.currentUser?.isAnonymous) {
        this.refreshAccessToken().catch((error) => {
          console.error("Failed to refresh token:", error);
          // If refresh fails and user is not anonymous, sign out
          // If anonymous, just keep the anonymous user
          if (!this.currentUser?.isAnonymous) {
            this.signOut();
          }
        });
      }
    }
    
    // Setup automatic token refresh
    this.setupTokenRefresh();
  }

  // Setup automatic token refresh interval
  private setupTokenRefresh(): void {
    // Clear previous interval if exists
    if (this.tokenRefreshInterval) {
      clearInterval(this.tokenRefreshInterval);
      this.tokenRefreshInterval = null;
    }
    
    // Only setup if we have tokens and user is not anonymous
    if (!this.authTokens || !this.authTokens.refreshToken || this.currentUser?.isAnonymous) {
      return;
    }
    
    // Check token expiration every minute
    this.tokenRefreshInterval = setInterval(async () => {
      if (!this.authTokens || !this.authTokens.refreshToken || this.currentUser?.isAnonymous) {
        // Clear interval if no longer needed
        if (this.tokenRefreshInterval) {
          clearInterval(this.tokenRefreshInterval);
          this.tokenRefreshInterval = null;
        }
        return;
      }
      
      // Refresh if token expires within 10 minutes (proactive refresh)
      const timeUntilExpiry = this.authTokens.expiresAt - Date.now();
      const tenMinutes = 10 * 60 * 1000;
      
      if (timeUntilExpiry < tenMinutes && timeUntilExpiry > 0) {
        console.log("🔄 Token expiring soon, refreshing proactively...");
        try {
          await this.refreshAccessToken();
          console.log("✅ Token refreshed successfully");
        } catch (error) {
          console.error("❌ Failed to refresh token:", error);
          // Don't sign out immediately, let getAccessToken handle it
        }
      } else if (timeUntilExpiry <= 0) {
        // Token already expired, refresh immediately
        console.log("🔄 Token expired, refreshing immediately...");
        try {
          await this.refreshAccessToken();
          console.log("✅ Token refreshed successfully");
        } catch (error) {
          console.error("❌ Failed to refresh expired token:", error);
          // If refresh fails, sign out
          if (!this.currentUser?.isAnonymous) {
            this.signOut();
          }
        }
      }
    }, 60 * 1000); // Check every minute
  }

  // Load data from localStorage
  private loadFromStorage(): void {
    // Only access localStorage on client side
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    
    try {
      const profileStr = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      if (profileStr) {
        this.currentUser = JSON.parse(profileStr);
      }

      const tokensStr = localStorage.getItem(STORAGE_KEYS.AUTH_TOKENS);
      if (tokensStr) {
        this.authTokens = JSON.parse(tokensStr);
      }

      this.googleClientId = localStorage.getItem(STORAGE_KEYS.GOOGLE_CLIENT_ID);
    } catch (error) {
      console.error("Error loading from storage:", error);
      this.clearStorage();
    }
  }

  // Note: Anonymous user restoration is handled by Firebase, not this service

  // Save data to localStorage
  private saveToStorage(): void {
    // Only access localStorage on client side
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    
    try {
      if (this.currentUser) {
        localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(this.currentUser));
      }
      if (this.authTokens) {
        localStorage.setItem(STORAGE_KEYS.AUTH_TOKENS, JSON.stringify(this.authTokens));
      }
    } catch (error) {
      console.error("Error saving to storage:", error);
    }
  }

  // Clear storage
  private clearStorage(): void {
    // Only access localStorage on client side
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    
    localStorage.removeItem(STORAGE_KEYS.USER_PROFILE);
    localStorage.removeItem(STORAGE_KEYS.AUTH_TOKENS);
  }

  // Set Google OAuth Client ID
  setGoogleClientId(clientId: string): void {
    this.googleClientId = clientId;
    // Only access localStorage on client side
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(STORAGE_KEYS.GOOGLE_CLIENT_ID, clientId);
    }
  }

  // Load Google OAuth Client ID from API route
  private async loadGoogleClientId(): Promise<string | null> {
    // Only load on client side
    if (typeof window === 'undefined') {
      return null;
    }

    // If already set, return it
    if (this.googleClientId) {
      return this.googleClientId;
    }

    try {
      // Try to load from API route first (secure method)
      const response = await fetch('/api/config/auth');
      
      if (response.ok) {
        const config = await response.json();
        const clientId = config.googleClientId || null;
        if (clientId) {
          this.googleClientId = clientId;
          // Save to localStorage
          if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem(STORAGE_KEYS.GOOGLE_CLIENT_ID, clientId);
          }
          console.log("Google OAuth Client ID loaded from API route");
          return clientId;
        }
      }
    } catch (error) {
      console.warn("Failed to load Google Client ID from API, trying fallback:", error);
    }

    // Fallback to NEXT_PUBLIC_* for backward compatibility
    const envClientId = typeof window !== 'undefined' 
      ? process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID 
      : null;
    
    if (envClientId) {
      this.googleClientId = envClientId;
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(STORAGE_KEYS.GOOGLE_CLIENT_ID, envClientId);
      }
      return envClientId;
    }

    return null;
  }

  // Get Google OAuth Client ID (async - loads from API if needed)
  async getGoogleClientId(): Promise<string | null> {
    // Try localStorage first (fast)
    if (this.googleClientId) {
      return this.googleClientId;
    }

    // Load from API or env
    return await this.loadGoogleClientId();
  }

  // Synchronous getter for backward compatibility (may return null if not loaded)
  getGoogleClientIdSync(): string | null {
    return this.googleClientId || null;
  }

  // Generate code verifier and challenge for PKCE
  private async generatePKCE(): Promise<{ codeVerifier: string; codeChallenge: string }> {
    // Generate code verifier (random string)
    const codeVerifier = this.generateRandomString(128);
    
    // Generate code challenge (SHA256 hash of verifier, base64url encoded)
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const hash = await crypto.subtle.digest("SHA-256", data);
    const codeChallenge = this.base64URLEncode(new Uint8Array(hash));
    
    return { codeVerifier, codeChallenge };
  }

  // Generate random string
  private generateRandomString(length: number): string {
    const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    let result = "";
    const randomValues = new Uint8Array(length);
    crypto.getRandomValues(randomValues);
    for (let i = 0; i < length; i++) {
      result += charset[randomValues[i] % charset.length];
    }
    return result;
  }

  // Base64 URL encode
  private base64URLEncode(array: Uint8Array): string {
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  }

  // Build Google OAuth URL with PKCE
  private async buildAuthUrl(): Promise<string> {
    const clientId = await this.getGoogleClientId();
    if (!clientId) {
      throw new Error(
        "Google OAuth Client ID not configured. " +
        "Please set it in settings or add GOOGLE_OAUTH_CLIENT_ID to .env"
      );
    }

    // For Electron, use the production URL as redirect_uri (must match Google Cloud Console)
    // For web, use the current origin
    const redirectUri = isElectron() 
      ? PRODUCTION_URL 
      : window.location.origin + window.location.pathname;
    
    console.log('🔐 OAuth redirect_uri:', redirectUri, isElectron() ? '(Electron)' : '(Web)');
    
    const state = this.generateState();
    const { codeVerifier, codeChallenge } = await this.generatePKCE();
    
    // Store code verifier and state in session storage
    sessionStorage.setItem("oauth_state", state);
    sessionStorage.setItem("oauth_code_verifier", codeVerifier);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid profile email",
      access_type: "offline",
      prompt: "select_account",
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    return `${GOOGLE_OAUTH_ENDPOINT}?${params.toString()}`;
  }

  // Generate random state for OAuth
  private generateState(): string {
    return this.generateRandomString(32);
  }

  // Exchange authorization code for tokens with PKCE
  private async exchangeCodeForTokens(code: string): Promise<AuthTokens> {
    const clientId = await this.getGoogleClientId();
    if (!clientId) {
      throw new Error("Google OAuth Client ID not configured");
    }

    // Get code verifier from session storage
    const codeVerifier = sessionStorage.getItem("oauth_code_verifier");
    if (!codeVerifier) {
      throw new Error("Code verifier not found. Please try signing in again.");
    }

    // Use the same redirect_uri as in buildAuthUrl (must match exactly)
    const redirectUri = isElectron() 
      ? PRODUCTION_URL 
      : window.location.origin + window.location.pathname;

    console.log('🔄 Token exchange redirect_uri:', redirectUri, isElectron() ? '(Electron)' : '(Web)');

    // Try using custom backend proxy if available (handles client_secret securely)
    if (OAUTH_PROXY_ENDPOINT) {
      try {
        const response = await fetch(`${OAUTH_PROXY_ENDPOINT}/oauth/token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code,
            redirect_uri: redirectUri,
            code_verifier: codeVerifier,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          sessionStorage.removeItem("oauth_code_verifier");
          
          const expiresIn = data.expires_in || 3600;
          const expiresAt = Date.now() + expiresIn * 1000;

          return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            idToken: data.id_token,
            expiresAt: expiresAt,
          };
        }
      } catch (error) {
        console.warn("OAuth proxy failed, trying Next.js API route:", error);
      }
    }

    // Use Next.js API route (default and secure method for web applications)
    // This route handles the client_secret securely on the server side
    try {
      const response = await fetch(OAUTH_API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code,
          redirect_uri: redirectUri,
          code_verifier: codeVerifier,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Token exchange failed' }));
        sessionStorage.removeItem("oauth_code_verifier");
        
        throw new Error(
          errorData.message || 
          "OAuth configuration error: Please ensure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set in your server environment variables."
        );
      }

      const data = await response.json();
      sessionStorage.removeItem("oauth_code_verifier");
      
      const expiresIn = data.expires_in || 3600;
      const expiresAt = Date.now() + expiresIn * 1000;

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        idToken: data.id_token,
        expiresAt: expiresAt,
      };
    } catch (error) {
      // Clear stored values on error
      sessionStorage.removeItem("oauth_code_verifier");
      
      // Re-throw with more context if it's not already an Error
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Token exchange failed: ${String(error)}`);
    }
  }

  // Refresh access token
  private async refreshAccessToken(): Promise<AuthTokens> {
    if (!this.authTokens?.refreshToken) {
      throw new Error("No refresh token available");
    }

    const clientId = await this.getGoogleClientId();
    if (!clientId) {
      throw new Error("Google OAuth Client ID not configured");
    }

    const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        refresh_token: this.authTokens.refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      throw new Error("Token refresh failed");
    }

    const data = await response.json();
    const expiresIn = data.expires_in || 3600;
    const expiresAt = Date.now() + expiresIn * 1000;

    this.authTokens = {
      ...this.authTokens,
      accessToken: data.access_token,
      idToken: data.id_token,
      expiresAt: expiresAt,
    };

    this.saveToStorage();
    
    // Restart token refresh interval with new expiration time
    this.setupTokenRefresh();
    
    return this.authTokens;
  }

  // Get user info from Google
  private async getUserInfo(accessToken: string): Promise<any> {
    const response = await fetch(GOOGLE_USERINFO_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to get user info:", response.status, errorText);
      throw new Error(`Failed to get user info: ${response.status}`);
    }

    // Check if response is JSON
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      console.error("Unexpected response type:", contentType, text.substring(0, 200));
      throw new Error("Invalid response format from Google API");
    }

    return response.json();
  }

  // Handle OAuth callback
  async handleCallback(): Promise<UserProfile | null> {
    // Only access window on client side
    if (typeof window === 'undefined') {
      return null;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const state = urlParams.get("state");
    const error = urlParams.get("error");

    if (error) {
      throw new Error(`OAuth error: ${error}`);
    }

    // If no OAuth parameters, return null (not an error)
    if (!code || !state) {
      return null;
    }

    // Verify state - only if we have both code and state
    const savedState = sessionStorage.getItem("oauth_state");
    if (!savedState) {
      // No saved state means this is not a valid OAuth callback
      // Clean up URL and return null
      window.history.replaceState({}, document.title, window.location.pathname);
      return null;
    }

    if (state !== savedState) {
      // Invalid state - clean up and return null instead of throwing
      sessionStorage.removeItem("oauth_state");
      window.history.replaceState({}, document.title, window.location.pathname);
      return null;
    }
    sessionStorage.removeItem("oauth_state");

    try {
      // Exchange code for tokens
      const tokens = await this.exchangeCodeForTokens(code);
      this.authTokens = tokens;
      this.saveToStorage();
      
      // Setup automatic token refresh
      this.setupTokenRefresh();

      // Get user info - try multiple methods
      let userInfo: any;
      try {
        userInfo = await this.getUserInfo(tokens.accessToken);
      } catch (error) {
        console.error("Error getting user info from Google API:", error);
        // If we have an idToken, decode it to get user info
        if (tokens.idToken) {
          try {
            // Decode JWT idToken (base64url decode the payload)
            const parts = tokens.idToken.split(".");
            if (parts.length === 3) {
              const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
              userInfo = {
                id: payload.sub,
                sub: payload.sub,
                email: payload.email,
                name: payload.name,
                picture: payload.picture,
              };
            } else {
              throw new Error("Invalid idToken format");
            }
          } catch (decodeError) {
            console.error("Error decoding idToken:", decodeError);
            throw new Error("Failed to get user information. Please try signing in again.");
          }
        } else {
          throw error;
        }
      }

      // Check if we're linking an anonymous Firebase account
      const linkingAnonymousUid = sessionStorage.getItem("linking_anonymous_uid");
      
      if (linkingAnonymousUid) {
        // Try to link with Firebase anonymous user
        try {
          const { firebaseService } = await import("./firebase");
          const firebaseUser = firebaseService.getCurrentUser();
          
          if (firebaseUser && firebaseUser.isAnonymous && firebaseUser.uid === linkingAnonymousUid) {
            // Link Firebase anonymous user with Google credential
            const linkedProfile = await firebaseService.linkWithGoogleCredential(
              tokens.idToken || "",
              tokens.accessToken
            );
            
            sessionStorage.removeItem("linking_anonymous_uid");
            
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
            
            return linkedProfile;
          }
        } catch (linkError) {
          console.error("Error linking with Firebase:", linkError);
          // Fall through to create new profile
        }
      }

      // Create new Google profile (manual OAuth, not Firebase)
      const profile = this.createGoogleProfile(userInfo, tokens);

      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);

      return profile;
    } catch (error) {
      console.error("Error handling OAuth callback:", error);
      throw error;
    }
  }

  // Note: signInAnonymously is handled by Firebase, not this service
  // This service only handles manual Google OAuth

  // Sign in with Google (or link if anonymous user exists)
  async signInWithGoogle(): Promise<void> {
    // If there's an anonymous user, we'll link the account after OAuth
    const isLinking = this.currentUser?.isAnonymous === true;
    
    if (isLinking && this.currentUser) {
      // Store anonymous UID to link later
      sessionStorage.setItem("linking_anonymous_uid", this.currentUser.uid);
    }

    const authUrl = await this.buildAuthUrl();
    window.location.href = authUrl;
  }

  // Create new Google profile (manual OAuth, not Firebase)
  private createGoogleProfile(userInfo: any, tokens: AuthTokens): UserProfile {
    const profile: UserProfile = {
      uid: userInfo.id || userInfo.sub || `user_${Date.now()}`,
      email: userInfo.email || "",
      displayName: userInfo.name || userInfo.email?.split("@")[0] || "Utilisateur",
      photoURL: userInfo.picture || null,
      plan: "free",
      storageUsed: 0,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    this.currentUser = profile;
    this.authTokens = tokens;
    this.saveToStorage();
    
    // Setup automatic token refresh
    this.setupTokenRefresh();

    // Notify listeners
    this.authStateListeners.forEach((listener) => listener(profile));

    return profile;
  }

  // Sign out
  async signOut(): Promise<void> {
    // Clear token refresh interval
    if (this.tokenRefreshInterval) {
      clearInterval(this.tokenRefreshInterval);
      this.tokenRefreshInterval = null;
    }
    
    this.currentUser = null;
    this.authTokens = null;
    this.clearStorage();
    
    // Notify listeners
    this.authStateListeners.forEach((listener) => listener(null));
  }

  // Get current user
  getCurrentUser(): UserProfile | null {
    return this.currentUser;
  }

  // Get user profile
  getUserProfile(): UserProfile | null {
    return this.currentUser;
  }

  // Check if authenticated
  isAuthenticated(): boolean {
    return this.currentUser !== null && this.authTokens !== null;
  }

  // Get access token (with auto-refresh if needed)
  async getAccessToken(): Promise<string | null> {
    if (!this.authTokens) {
      return null;
    }

    // Check if token is expired or will expire soon (within 5 minutes)
    if (this.authTokens.expiresAt < Date.now() + 5 * 60 * 1000) {
      if (this.authTokens.refreshToken) {
        try {
          await this.refreshAccessToken();
        } catch (error) {
          console.error("Failed to refresh token:", error);
          this.signOut();
          return null;
        }
      } else {
        // No refresh token, token expired
        this.signOut();
        return null;
      }
    }

    return this.authTokens.accessToken;
  }

  // Get ID token (for backend API calls)
  async getIdToken(): Promise<string | null> {
    if (!this.authTokens) {
      return null;
    }

    // Refresh if needed
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      return null;
    }

    // If we have an idToken, return it
    if (this.authTokens.idToken) {
      return this.authTokens.idToken;
    }

    // Otherwise, use access token
    return accessToken;
  }

  // Subscribe to auth state changes
  onAuthStateChange(callback: (user: UserProfile | null) => void): () => void {
    this.authStateListeners.add(callback);
    
    // Call immediately with current state
    callback(this.currentUser);
    
    return () => this.authStateListeners.delete(callback);
  }

  // Check if user is pro
  isPro(): boolean {
    return (
      this.currentUser?.plan === "pro" &&
      this.currentUser?.subscriptionStatus === "active"
    );
  }

  // Update user profile
  async updateProfile(data: Partial<UserProfile>): Promise<void> {
    if (!this.currentUser) {
      throw new Error("Not authenticated");
    }

    this.currentUser = {
      ...this.currentUser,
      ...data,
    };

    this.saveToStorage();
    
    // Notify listeners
    this.authStateListeners.forEach((listener) => listener(this.currentUser));
  }
}

export const authService = new AuthService();

