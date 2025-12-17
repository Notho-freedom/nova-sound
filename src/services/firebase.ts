import { initializeApp, FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  onIdTokenChanged,
  signInAnonymously as firebaseSignInAnonymously,
  linkWithCredential,
  signInWithCredential,
  OAuthCredential,
  User,
  Auth,
} from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  Firestore,
  collection,
  query,
  where,
  getDocs,
  enableIndexedDbPersistence,
  CACHE_SIZE_UNLIMITED,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

// Firebase configuration - loaded from API route (server-side only)
// Fallback to NEXT_PUBLIC_* for backward compatibility
let firebaseConfig: {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
} | null = null;

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let configLoadPromise: Promise<void> | null = null;

// Load Firebase configuration from API route
async function loadFirebaseConfig(): Promise<void> {
  // Only load on client side
  if (typeof window === 'undefined') {
    return;
  }

  // If already loaded, return
  if (firebaseConfig) {
    return;
  }

  // If already loading, wait for it
  if (configLoadPromise) {
    return configLoadPromise;
  }

  // Start loading
  configLoadPromise = (async () => {
    try {
      // Try to load from API route first (secure method)
      const response = await fetch('/api/config/firebase');
      
      if (response.ok) {
        const config = await response.json();
        firebaseConfig = {
          apiKey: config.apiKey || '',
          authDomain: config.authDomain || '',
          projectId: config.projectId || '',
          storageBucket: config.storageBucket || '',
          messagingSenderId: config.messagingSenderId || '',
          appId: config.appId || '',
        };
        console.log("Firebase config loaded from API route");
      } else {
        throw new Error(`API route returned ${response.status}`);
      }
    } catch (error) {
      console.warn("Failed to load Firebase config from API, trying fallback:", error);
      
      // Fallback to NEXT_PUBLIC_* for backward compatibility
      firebaseConfig = {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
      };
    }

    // Validate config
    const isConfigValid = firebaseConfig && Object.values(firebaseConfig).every(
      (value) => value && value !== "undefined" && value !== ''
    );

    if (isConfigValid && firebaseConfig) {
      try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        
        // Check if running in Electron (for long-polling support)
        const isElectron = typeof window !== 'undefined' && window.electronAPI;
        
        // Use long-polling in Electron to avoid WebSocket issues
        // Also enable offline persistence for better experience
        if (isElectron) {
          db = initializeFirestore(app, {
            experimentalForceLongPolling: true,
            // Enable local cache for offline support
            localCache: persistentLocalCache({
              tabManager: persistentMultipleTabManager(),
              cacheSizeBytes: CACHE_SIZE_UNLIMITED,
            }),
          });
          console.log("Firebase initialized with long-polling and persistent cache (Electron mode)");
        } else {
          // For web browsers, use default settings with persistence
          db = initializeFirestore(app, {
            localCache: persistentLocalCache({
              tabManager: persistentMultipleTabManager(),
              cacheSizeBytes: CACHE_SIZE_UNLIMITED,
            }),
          });
          console.log("Firebase initialized with persistent cache");
        }
      } catch (error) {
        console.error("Firebase initialization error:", error);
        // Fallback to simpler initialization if advanced features fail
        try {
          if (!app) {
            app = initializeApp(firebaseConfig);
            auth = getAuth(app);
          }
          if (!db) {
            db = getFirestore(app);
            console.log("Firebase initialized with fallback settings");
          }
        } catch (fallbackError) {
          console.error("Firebase fallback initialization failed:", fallbackError);
        }
      }
    } else {
      console.warn("Firebase config incomplete. Please check your .env file and ensure /api/config/firebase is configured.");
    }
  })();

  return configLoadPromise;
}

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("profile");
googleProvider.addScope("email");
// Set custom parameters for better redirect handling
googleProvider.setCustomParameters({
  prompt: "select_account",
});

// User profile interface
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  plan: "free" | "pro";
  stripeCustomerId?: string;
  subscriptionId?: string;
  subscriptionStatus?: "active" | "canceled" | "past_due" | "trialing";
  subscriptionEndDate?: string;
  storageUsed: number;
  createdAt: string;
  lastLoginAt: string;
}

class FirebaseService {
  private currentUser: User | null = null;
  private userProfile: UserProfile | null = null;
  private authStateListeners: Set<(user: User | null) => void> = new Set();
  private tokenRefreshInterval: NodeJS.Timeout | null = null;
  private idTokenUnsubscribe: (() => void) | null = null;
  private profileSnapshotUnsubscribe: (() => void) | null = null;

  constructor() {
    // Preload Firebase config from API (non-blocking)
    if (typeof window !== 'undefined') {
      loadFirebaseConfig().catch((error) => {
        console.warn("Failed to preload Firebase config:", error);
      });
    }
    
    // Listen for auth state changes
    // This will automatically handle transitions from anonymous to Google user
    if (auth) {
      onAuthStateChanged(auth, async (user) => {
        const previousUser = this.currentUser;
        this.currentUser = user;
        
        if (user) {
          const userType = user.isAnonymous ? "anonymous" : (user.email || "authenticated");
          console.log("Auth state changed: user signed in", userType, user.uid);
          
          // If user transitioned from anonymous to Google, log it
          if (previousUser?.isAnonymous && !user.isAnonymous) {
            console.log("✅ User transitioned from anonymous to Google account:", user.email);
            // The anonymous user is automatically replaced by Firebase
          }
          
          // Verify token is available (only for non-anonymous users)
          if (!user.isAnonymous) {
            try {
              const token = await user.getIdToken();
              console.log("Token available after auth state change:", token ? "✓" : "✗");
            } catch (tokenError) {
              console.error("Error getting token after auth state change:", tokenError);
            }
          }
          
          // Load profile - this will use Firebase user data (which includes Google data after merge)
          await this.loadUserProfile(user.uid);
          
          // Force notify listeners with updated profile (so UI uses correct data from Firestore)
          if (this.userProfile) {
            // Notify with User object (for Firebase listeners)
            this.authStateListeners.forEach((listener) => listener(user));
          }
        } else {
          console.log("Auth state changed: user signed out");
          
          // Clean up profile snapshot listener
          if (this.profileSnapshotUnsubscribe) {
            this.profileSnapshotUnsubscribe();
            this.profileSnapshotUnsubscribe = null;
          }
          
          // Clean up user-isolated storage when signing out
          if (previousUser) {
            try {
              const { cleanupUserStorage } = await import('@/lib/storage-utils');
              cleanupUserStorage(previousUser.uid);
            } catch (error) {
              console.error('Failed to cleanup user storage:', error);
            }
          }
          
          this.userProfile = null;
          // Notify listeners
          this.authStateListeners.forEach((listener) => listener(null));
        }
        
        // Setup token refresh listener when user changes
        this.setupTokenRefreshListener(user);
      });
    }
  }

  // Setup automatic token refresh listener
  private setupTokenRefreshListener(user: User | null): void {
    // Cleanup previous listener
    if (this.idTokenUnsubscribe) {
      this.idTokenUnsubscribe();
      this.idTokenUnsubscribe = null;
    }
    
    // Clear previous interval
    if (this.tokenRefreshInterval) {
      clearInterval(this.tokenRefreshInterval);
      this.tokenRefreshInterval = null;
    }
    
    if (!user || user.isAnonymous || !auth) {
      return;
    }
    
    // Listen to token changes (Firebase automatically refreshes tokens)
    // This listener is called whenever the token changes (including automatic refresh)
    this.idTokenUnsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      if (firebaseUser && !firebaseUser.isAnonymous) {
        try {
          // Get token (Firebase automatically refreshes if needed)
          const token = await firebaseUser.getIdToken(false);
          if (token) {
            console.log("🔄 Token updated by Firebase (auto-refresh), length:", token.length);
          }
        } catch (error) {
          console.error("Error getting token after change:", error);
        }
      }
    });
    
    // Also set up a proactive refresh interval (refresh 10 minutes before expiration)
    // Firebase tokens typically expire after 1 hour, so refresh every 50 minutes
    this.tokenRefreshInterval = setInterval(async () => {
      if (user && !user.isAnonymous && auth) {
        try {
          // Force refresh to get a new token
          const token = await user.getIdToken(true);
          console.log("🔄 Token refreshed proactively, length:", token?.length || 0);
        } catch (error) {
          console.error("Error in proactive token refresh:", error);
        }
      }
    }, 50 * 60 * 1000); // Every 50 minutes
  }

  // Handle redirect result after Google sign-in (call this on app initialization)
  async handleRedirectResult(): Promise<UserProfile | null> {
    await this.ensureInitialized();
    if (!auth) return null;

    try {
      const result = await getRedirectResult(auth);
      if (result && result.user) {
        console.log("Redirect result received, user:", result.user.email);
        
        // Set current user
        this.currentUser = result.user;
        
        // Get and verify token is available
        try {
          const token = await result.user.getIdToken();
          console.log("ID token retrieved after redirect:", token ? "✓ Token length: " + token.length : "✗");
        } catch (tokenError) {
          console.error("Error getting token after redirect:", tokenError);
        }
        
        const profile = await this.createOrUpdateProfile(result.user);
        
        // Force notify listeners
        this.authStateListeners.forEach((listener) => listener(result.user));
        
        return profile;
      }
    } catch (error) {
      console.error("Error handling redirect result:", error);
    }
    return null;
  }

  // Check if Firebase is initialized
  isInitialized(): boolean {
    return app !== null && auth !== null;
  }

  // Ensure Firebase config is loaded
  async ensureInitialized(): Promise<void> {
    if (!this.isInitialized()) {
      await loadFirebaseConfig();
    }
  }

  // Get current user
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  // Get user profile
  getUserProfile(): UserProfile | null {
    return this.userProfile;
  }

  // Subscribe to auth state changes
  onAuthStateChange(callback: (user: User | null) => void): () => void {
    this.authStateListeners.add(callback);
    // Call immediately with current state
    callback(this.currentUser);
    return () => this.authStateListeners.delete(callback);
  }

  // Sign in anonymously (Firebase handles persistence automatically)
  // Only creates anonymous user if no user exists
  async signInAnonymously(): Promise<UserProfile> {
    await this.ensureInitialized();
    if (!auth) {
      throw new Error("Firebase not initialized. Check your configuration.");
    }

    // Check if user already exists (Firebase persists auth state)
    // Get current user from auth (more reliable than this.currentUser)
    const currentAuthUser = auth.currentUser;
    if (currentAuthUser) {
      // User already exists, update internal reference and return existing profile
      this.currentUser = currentAuthUser;
      
      // If user is not anonymous, don't create anonymous user
      if (!currentAuthUser.isAnonymous) {
        console.log("✅ Firebase user already exists (not anonymous):", currentAuthUser.email);
        const existingProfile = this.userProfile;
        if (existingProfile) {
          return existingProfile;
        }
        // Load profile if it doesn't exist
        await this.loadUserProfile(currentAuthUser.uid);
        if (this.userProfile) {
          return this.userProfile;
        }
      } else {
        // User is anonymous, return existing profile
        const existingProfile = this.userProfile;
        if (existingProfile) {
          console.log("✅ Using existing Firebase anonymous user:", currentAuthUser.uid);
          return existingProfile;
        }
        // Load profile if it doesn't exist
        await this.loadUserProfile(currentAuthUser.uid);
        if (this.userProfile) {
          return this.userProfile;
        }
      }
    }

    try {
      const userCredential = await firebaseSignInAnonymously(auth);
      const user = userCredential.user;
      
      console.log("✅ Firebase anonymous user created:", user.uid);
      
      // Create or update profile
      const profile = await this.createOrUpdateProfile(user);
      
      return profile;
    } catch (error: unknown) {
      console.error("Error signing in anonymously:", error);
      const authError = error as { code?: string; message?: string };
      
      // If user already exists, try to get existing profile
      if (authError.code === "auth/operation-not-allowed") {
        throw new Error("L'authentification anonyme n'est pas activée. Veuillez l'activer dans Firebase Console.");
      }
      
      throw new Error(authError.message || "Erreur lors de la connexion anonyme");
    }
  }

  // Link Google account to anonymous user (using manual OAuth credential)
  // Google data takes priority over anonymous data
  // Step 1: Check if Google account already exists
  // Step 2: If exists, sign in to that account (anonymous user will be replaced)
  // Step 3: If not, update anonymous profile and link
  async linkWithGoogleCredential(idToken: string, accessToken: string, googleUserData?: { email?: string; displayName?: string; photoURL?: string }): Promise<UserProfile> {
    // Ensure Firebase is fully initialized
    await this.ensureInitialized();
    
    if (!auth) {
      throw new Error("Firebase not initialized. Check your configuration.");
    }
    
    // Get current user from auth (may have changed since last check)
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("No user signed in. Please sign in anonymously first.");
    }
    
    // Update internal reference
    this.currentUser = currentUser;

    if (!currentUser.isAnonymous) {
      throw new Error("Current user is not anonymous. Cannot link account.");
    }

    if (!googleUserData || !googleUserData.email) {
      throw new Error("Google user data is required to link account");
    }

    try {
      // STEP 1: Check if a Google account with this email already exists
      const existingUser = await this.findUserByEmail(googleUserData.email);
      
      if (existingUser && existingUser.uid !== this.currentUser.uid) {
        // Account Google existe déjà avec un autre UID
        // Firebase va automatiquement remplacer l'utilisateur anonyme lors de la liaison
        console.log("🔍 Google account exists, will replace anonymous user during link");
      }
      
      // STEP 2: Update Firebase profile with Google data BEFORE linking
      console.log("📝 Step 2: Updating anonymous profile with Google data before linking...");
      await this.createOrUpdateProfile(this.currentUser, googleUserData);
      console.log("✅ Profile updated with Google data:", this.userProfile);
      
      // STEP 3: Link the Google credential to the anonymous user
      // Firebase will automatically replace the anonymous user with the Google account
      console.log("🔗 Step 3: Linking Google credential to anonymous user...");
      const credential = GoogleAuthProvider.credential(idToken, accessToken);
      const userCredential = await linkWithCredential(this.currentUser, credential);
      const user = userCredential.user;
      
      console.log("✅ Firebase anonymous user linked with Google account:", user.uid);
      console.log("✅ Anonymous user automatically replaced by Firebase");
      
      // Wait a bit for Firestore to update
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Force reload profile from Firestore to ensure we have the latest merged data
      await this.loadUserProfile(user.uid);
      
      // Notify listeners with updated profile (triggers UI update)
      this.authStateListeners.forEach((listener) => listener(user));
      
      // Return the updated profile
      if (!this.userProfile) {
        throw new Error("Failed to load user profile after merge");
      }
      
      console.log("✅ Final profile with Google data:", this.userProfile);
      return this.userProfile;
    } catch (error: unknown) {
      console.error("Error linking Google account:", error);
      const authError = error as { code?: string; message?: string };
      
      if (authError.code === "auth/credential-already-in-use") {
        // This means the Google account is already linked to another Firebase user
        // Sign in to that existing account instead of throwing an error
        console.log("🔍 Google account already in use, signing in to existing account...");
        
        try {
          // Sign in with the Google credential to the existing account
          const credential = GoogleAuthProvider.credential(idToken, accessToken);
          const userCredential = await signInWithCredential(auth!, credential);
          const user = userCredential.user;
          
          console.log("✅ Signed in to existing Google account:", user.uid);
          
          // Update internal reference
          this.currentUser = user;
          
          // Load or create profile for this user
          await this.loadUserProfile(user.uid);
          
          // Notify listeners with the signed-in user
          this.authStateListeners.forEach((listener) => listener(user));
          
          if (!this.userProfile) {
            // Create profile if it doesn't exist
            await this.createOrUpdateProfile(user, googleUserData);
          }
          
          console.log("✅ Successfully switched to existing Google account");
          return this.userProfile!;
        } catch (signInError: unknown) {
          console.error("Error signing in to existing account:", signInError);
          throw new Error("Impossible de se connecter au compte existant. Veuillez réessayer.");
        }
      } else if (authError.code === "auth/email-already-in-use") {
        throw new Error("Cet email est déjà utilisé par un autre compte.");
      }
      
      throw new Error(authError.message || "Erreur lors de la liaison du compte");
    }
  }

  // Find user by email in Firestore
  async findUserByEmail(email: string): Promise<UserProfile | null> {
    if (!db || !email) {
      return null;
    }

    // Note: Don't check navigator.onLine - it's unreliable in Electron
    // Let Firebase SDK handle offline scenarios naturally

    try {
      // Query Firestore for user with this email
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        return userDoc.data() as UserProfile;
      }
    } catch (error: unknown) {
      const firestoreError = error as { code?: string; message?: string };
      
      // Handle offline/network errors gracefully
      if (firestoreError.code === 'unavailable' || 
          firestoreError.code === 'failed-precondition' ||
          firestoreError.message?.includes('offline') ||
          firestoreError.message?.includes('network')) {
        console.warn("⚠️ Firestore query failed (network issue), returning null");
        return null;
      }
      
      // Handle permission errors gracefully (Firestore rules may not allow query by email)
      if (firestoreError.code === 'permission-denied' ||
          firestoreError.message?.includes('permission') ||
          firestoreError.message?.includes('Missing or insufficient permissions')) {
        console.warn("⚠️ Firestore permission denied for email query - this is normal if rules restrict queries");
        return null;
      }
      
      console.warn("⚠️ Firestore query error:", firestoreError.message || error);
      // Don't throw - return null to allow graceful fallback
      return null;
    }

    return null;
  }

  // Sign in with Google
  async signInWithGoogle(): Promise<void> {
    await this.ensureInitialized();
    if (!auth) {
      throw new Error("Firebase not initialized. Check your configuration.");
    }

    // Check if we're in Electron (better to use popup in Electron)
    const isElectron = typeof window !== "undefined" && window.electronAPI;

    try {
      if (isElectron) {
        // In Electron, always use popup (works better)
        try {
          const result = await signInWithPopup(auth, googleProvider);
          const user = result.user;
          
          // If there was an anonymous user, it will be automatically replaced
          // Create or update profile
          await this.createOrUpdateProfile(user);
          
          // Force UI update
          this.authStateListeners.forEach((listener) => listener(user));
          return;
        } catch (popupError: unknown) {
          const error = popupError as { code?: string; message?: string };
          if (error.code === "auth/popup-blocked") {
            // Fallback to redirect in Electron if popup is blocked
            await signInWithRedirect(auth, googleProvider);
            return;
          }
          throw popupError;
        }
      } else {
        // In browser, use redirect (more reliable, avoids popup blocking)
        await signInWithRedirect(auth, googleProvider);
        // The redirect will happen, handleRedirectResult will process it on return
        return;
      }
    } catch (error: unknown) {
      console.error("Google sign in error:", error);
      const authError = error as { code?: string; message?: string };
      
      if (authError.code === "auth/popup-closed-by-user") {
        throw new Error("Connexion annulée");
      } else if (authError.code === "auth/popup-blocked") {
        // Fallback to redirect
        await signInWithRedirect(auth, googleProvider);
        return;
      } else if (authError.code === "auth/network-request-failed") {
        throw new Error("Erreur réseau. Vérifiez votre connexion.");
      }
      
      throw new Error(authError.message || "Erreur d'authentification");
    }
  }

  // Sign out
  async signOut(): Promise<void> {
    // Cleanup token refresh listeners
    if (this.idTokenUnsubscribe) {
      this.idTokenUnsubscribe();
      this.idTokenUnsubscribe = null;
    }
    
    if (this.tokenRefreshInterval) {
      clearInterval(this.tokenRefreshInterval);
      this.tokenRefreshInterval = null;
    }
    await this.ensureInitialized();
    if (!auth) {
      throw new Error("Firebase not initialized");
    }

    // Clean up profile snapshot listener
    if (this.profileSnapshotUnsubscribe) {
      this.profileSnapshotUnsubscribe();
      this.profileSnapshotUnsubscribe = null;
    }

    await signOut(auth);
    this.currentUser = null;
    this.userProfile = null;
  }

  // Load user profile from Firestore
  private async loadUserProfile(uid: string): Promise<void> {
    if (!db || !this.currentUser) return;

    // Note: Don't check navigator.onLine - it's unreliable in Electron
    // Let Firebase SDK handle offline scenarios naturally

    try {
      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const profileData = userSnap.data() as UserProfile;
        // Ensure we have the latest data from Firestore
        this.userProfile = profileData;
        console.log("📥 Profile loaded from Firestore:", this.userProfile);
      } else {
        // Profile doesn't exist, create it from current user
        await this.createOrUpdateProfile(this.currentUser);
      }
    } catch (error: unknown) {
      const firestoreError = error as { code?: string; message?: string };
      
      // Handle offline/network errors gracefully
      if (firestoreError.code === 'unavailable' || 
          firestoreError.code === 'failed-precondition' ||
          firestoreError.message?.includes('offline') ||
          firestoreError.message?.includes('network')) {
        console.warn("⚠️ Firestore load failed (network issue), creating local profile");
        // Create profile from current user data if no profile exists
        if (!this.userProfile) {
          this.createOrUpdateProfileOffline(this.currentUser);
        }
        return;
      }
      
      // Handle permission errors gracefully
      if (firestoreError.code === 'permission-denied' ||
          firestoreError.message?.includes('permission') ||
          firestoreError.message?.includes('Missing or insufficient permissions')) {
        console.warn("⚠️ Firestore permission denied, creating local profile - check Firestore rules");
        if (!this.userProfile) {
          this.createOrUpdateProfileOffline(this.currentUser);
        }
        return;
      }
      
      console.warn("⚠️ Error loading user profile:", firestoreError.message || error);
      // Don't throw - create local profile as fallback
      if (!this.userProfile) {
        this.createOrUpdateProfileOffline(this.currentUser);
      }
    }
  }

  // Create profile in memory only (for offline scenarios)
  private createOrUpdateProfileOffline(user: User, googleUserData?: { email?: string; displayName?: string; photoURL?: string }): UserProfile {
    const email = googleUserData?.email || user.email || "";
    const displayName = googleUserData?.displayName || user.displayName || 
      (user.isAnonymous ? "Utilisateur anonyme" : (user.email?.split("@")[0] || "Utilisateur"));
    const photoURL = googleUserData?.photoURL || user.photoURL || null;
    
    const offlineProfile: UserProfile = {
      uid: user.uid,
      email,
      displayName,
      photoURL,
      plan: this.userProfile?.plan || "free",
      storageUsed: this.userProfile?.storageUsed || 0,
      stripeCustomerId: this.userProfile?.stripeCustomerId,
      subscriptionId: this.userProfile?.subscriptionId,
      subscriptionStatus: this.userProfile?.subscriptionStatus,
      subscriptionEndDate: this.userProfile?.subscriptionEndDate,
      createdAt: this.userProfile?.createdAt || new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    
    this.userProfile = offlineProfile;
    console.log("📝 Created offline profile:", offlineProfile.email || offlineProfile.uid);
    return offlineProfile;
  }

  // Create or update user profile
  // googleUserData takes priority over Firebase user data when provided
  private async createOrUpdateProfile(user: User, googleUserData?: { email?: string; displayName?: string; photoURL?: string }): Promise<UserProfile> {
    if (!db) {
      throw new Error("Firestore not initialized");
    }

    // Note: Don't check navigator.onLine - it's unreliable in Electron
    // Let Firebase SDK handle offline scenarios naturally

    const userRef = doc(db, "users", user.uid);
    
    // Priority: googleUserData > user (Firebase) > existing profile
    const email = googleUserData?.email || user.email || "";
    const displayName = googleUserData?.displayName || user.displayName || 
      (user.isAnonymous ? "Utilisateur anonyme" : (user.email?.split("@")[0] || "Utilisateur"));
    const photoURL = googleUserData?.photoURL || user.photoURL || null;

    // Try to get existing profile from Firestore
    let userSnap;
    try {
      userSnap = await getDoc(userRef);
    } catch (error: unknown) {
      const firestoreError = error as { code?: string; message?: string };
      
      // Handle network errors gracefully - create profile in memory
      if (firestoreError.code === 'unavailable' || 
          firestoreError.code === 'failed-precondition' ||
          firestoreError.message?.includes('offline') ||
          firestoreError.message?.includes('network')) {
        console.warn("⚠️ Firestore getDoc failed (network issue), creating local profile");
        return this.createOrUpdateProfileOffline(user, googleUserData);
      }
      
      // Handle permission errors gracefully
      if (firestoreError.code === 'permission-denied' ||
          firestoreError.message?.includes('permission') ||
          firestoreError.message?.includes('Missing or insufficient permissions')) {
        console.warn("⚠️ Firestore permission denied, creating local profile - check Firestore rules");
        return this.createOrUpdateProfileOffline(user, googleUserData);
      }
      
      // For other errors, log and create local profile
      console.warn("⚠️ Error getting profile from Firestore:", firestoreError.message || error);
      return this.createOrUpdateProfileOffline(user, googleUserData);
    }

    if (userSnap.exists()) {
      // Update last login and merge data (Google data takes priority)
      const existingProfile = userSnap.data() as UserProfile;
      
      // Merge: Google data > Firebase user data > existing profile data
      // Firestore doesn't accept undefined, so we need to filter it out or use null
      const mergedProfile: Partial<UserProfile> = {
        lastLoginAt: new Date().toISOString(),
        // Google data takes priority
        ...(email && { email }),
        ...(displayName && { displayName }),
        ...(photoURL !== null && { photoURL }),
        // Keep existing plan and subscription if not provided
        plan: existingProfile.plan || "free",
        storageUsed: existingProfile.storageUsed || 0,
      };
      
      // Only include subscriptionStatus if it exists and is not undefined
      if (existingProfile.subscriptionStatus !== undefined && existingProfile.subscriptionStatus !== null) {
        mergedProfile.subscriptionStatus = existingProfile.subscriptionStatus;
      }
      
      // Remove undefined values (Firestore doesn't accept them)
      const cleanedProfile = Object.fromEntries(
        Object.entries(mergedProfile).filter(([_, v]) => v !== undefined)
      ) as Partial<UserProfile>;
      
      try {
        await updateDoc(userRef, cleanedProfile);
        
        this.userProfile = {
          ...existingProfile,
          ...cleanedProfile,
        };
        console.log("📥 Profile updated in Firestore");
      } catch (error: unknown) {
        const firestoreError = error as { code?: string; message?: string };
        
        // Handle offline/network errors gracefully
        if (firestoreError.code === 'unavailable' || 
            firestoreError.code === 'failed-precondition' ||
            firestoreError.message?.includes('offline') ||
            firestoreError.message?.includes('network')) {
          console.warn("⚠️ Firestore update failed (network issue), using in-memory profile");
          this.userProfile = {
            ...existingProfile,
            ...cleanedProfile,
          };
          return this.userProfile;
        }
        
        // Handle permission errors gracefully
        if (firestoreError.code === 'permission-denied' ||
            firestoreError.message?.includes('permission') ||
            firestoreError.message?.includes('Missing or insufficient permissions')) {
          console.warn("⚠️ Firestore permission denied for update, using in-memory profile");
          this.userProfile = {
            ...existingProfile,
            ...cleanedProfile,
          };
          return this.userProfile;
        }
        
        // For other errors, log and use in-memory profile as fallback
        console.warn("⚠️ Error updating profile in Firestore:", firestoreError.message || error);
        this.userProfile = {
          ...existingProfile,
          ...cleanedProfile,
        };
        return this.userProfile;
      }
    } else {
      // Create new profile with Google data priority
      const newProfile: UserProfile = {
        uid: user.uid,
        email,
        displayName,
        photoURL,
        plan: "free",
        storageUsed: 0,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };

      try {
        await setDoc(userRef, newProfile);
        
        this.userProfile = newProfile;
        console.log("📥 Profile created in Firestore");
      } catch (error: unknown) {
        const firestoreError = error as { code?: string; message?: string };
        
        // Handle offline/network errors gracefully
        if (firestoreError.code === 'unavailable' || 
            firestoreError.code === 'failed-precondition' ||
            firestoreError.message?.includes('offline') ||
            firestoreError.message?.includes('network')) {
          console.warn("⚠️ Firestore create failed (network issue), using in-memory profile");
          this.userProfile = newProfile;
          return this.userProfile;
        }
        
        // Handle permission errors gracefully
        if (firestoreError.code === 'permission-denied' ||
            firestoreError.message?.includes('permission') ||
            firestoreError.message?.includes('Missing or insufficient permissions')) {
          console.warn("⚠️ Firestore permission denied for create, using in-memory profile - check Firestore rules");
          this.userProfile = newProfile;
          return this.userProfile;
        }
        
        // For other errors, log and use in-memory profile as fallback
        console.warn("⚠️ Error creating profile in Firestore:", firestoreError.message || error);
        this.userProfile = newProfile;
        return this.userProfile;
      }
    }

    return this.userProfile!;
  }

  // Update user profile
  async updateProfile(data: Partial<UserProfile>): Promise<void> {
    if (!db || !this.currentUser) {
      throw new Error("Not authenticated");
    }

    const userRef = doc(db, "users", this.currentUser.uid);
    await updateDoc(userRef, data);

    if (this.userProfile) {
      this.userProfile = { ...this.userProfile, ...data };
    }
  }

  // Check if user is Pro
  isPro(): boolean {
    return this.userProfile?.plan === "pro" && 
           this.userProfile?.subscriptionStatus === "active";
  }

  // Get ID token for backend calls
  async getIdToken(forceRefresh: boolean = false): Promise<string | null> {
    if (!this.currentUser) {
      console.warn("getIdToken: No current user available");
      return null;
    }
    
    // For anonymous users, return null (they don't have valid ID tokens for backend)
    if (this.currentUser.isAnonymous) {
      return null;
    }
    
    try {
      console.log("getIdToken: Requesting token (forceRefresh:", forceRefresh, ")");
      const token = await this.currentUser.getIdToken(forceRefresh);
      
      if (token) {
        console.log("getIdToken: Token retrieved successfully, length:", token.length);
        return token;
      } else {
        console.error("getIdToken: Token is null or empty");
        return null;
      }
    } catch (error) {
      const authError = error as { code?: string; message?: string };
      
      // Handle offline errors gracefully
      if (authError.code === 'unavailable' || authError.message?.includes('offline')) {
        console.warn("⚠️ Firebase Auth unavailable (offline), cannot get ID token");
        return null;
      }
      
      console.error("getIdToken: Error getting token:", error);
      // Try to refresh if first attempt failed
      if (!forceRefresh) {
        console.log("getIdToken: Retrying with force refresh...");
        return this.getIdToken(true);
      }
      return null;
    }
  }
  
  // Refresh ID token
  async refreshIdToken(): Promise<string | null> {
    return this.getIdToken(true);
  }
}

export const firebaseService = new FirebaseService();

// Dynamic getter for Firestore instance (to handle async initialization)
export function getDb(): Firestore | null {
  return db;
}

// Dynamic getter for Auth instance
export function getAuthInstance(): Auth | null {
  return auth;
}

// Dynamic getter for Firebase App instance
export function getFirebaseApp(): FirebaseApp | null {
  return app;
}

// Wait for Firebase to be initialized
export async function waitForFirebase(): Promise<{ app: FirebaseApp; auth: Auth; db: Firestore } | null> {
  await firebaseService.ensureInitialized();
  if (app && auth && db) {
    return { app, auth, db };
  }
  return null;
}

export { auth, db, app as firebaseApp };

