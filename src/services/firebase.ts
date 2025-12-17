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
let initializationComplete = false;
let initializationPromise: Promise<void> | null = null;

// Load Firebase configuration from API route
async function loadFirebaseConfig(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (firebaseConfig) return;
  if (configLoadPromise) return configLoadPromise;

  configLoadPromise = (async () => {
    try {
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
      
      firebaseConfig = {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
      };
      console.log("Firebase config loaded from environment variables");
    }
  })();

  return configLoadPromise;
}

const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  plan: "free" | "pro";
  subscriptionStatus: "active" | "cancelled" | "canceled" | "past_due" | "trialing" | "none" | null;
  storageUsed: number;
  createdAt: string;
  updatedAt?: string;
  lastLoginAt?: string;
  isAnonymous?: boolean;
}

class FirebaseService {
  private currentUser: User | null = null;
  private userProfile: UserProfile | null = null;
  private authStateListeners: Set<(user: User | null) => void> = new Set();
  private idTokenUnsubscribe: (() => void) | null = null;
  private tokenRefreshInterval: NodeJS.Timeout | null = null;
  private authReadyPromise: Promise<User | null> | null = null;
  private authReadyResolver: ((user: User | null) => void) | null = null;

  constructor() {
    // Create a promise that resolves when auth is ready
    this.authReadyPromise = new Promise((resolve) => {
      this.authReadyResolver = resolve;
    });

    if (typeof window !== 'undefined') {
      this.initialize();
    }
  }

  private async initialize(): Promise<void> {
    if (initializationPromise) return initializationPromise;
    
    initializationPromise = this.doInitialize();
    return initializationPromise;
  }

  private async doInitialize(): Promise<void> {
    if (typeof window === 'undefined') return;
    if (initializationComplete) return;

    try {
      await loadFirebaseConfig();

      if (!firebaseConfig || !firebaseConfig.apiKey) {
        console.warn("Firebase configuration is missing or incomplete");
        initializationComplete = true;
        this.authReadyResolver?.(null);
        return;
      }

      // Initialize Firebase app
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);

      // Initialize Firestore with persistent cache (Electron compatible)
      try {
        const isElectron = typeof window !== 'undefined' && window.electronAPI;
        
        if (isElectron) {
          db = initializeFirestore(app, {
            localCache: persistentLocalCache({
              cacheSizeBytes: CACHE_SIZE_UNLIMITED,
            }),
            experimentalForceLongPolling: true,
          });
          console.log("Firebase initialized with long-polling and persistent cache (Electron mode)");
        } else {
          db = getFirestore(app);
          console.log("Firebase initialized with default settings (Browser mode)");
        }
      } catch (firestoreError: any) {
        if (firestoreError.code !== 'failed-precondition') {
          console.error("Firestore initialization error:", firestoreError);
        }
        db = getFirestore(app);
      }

      // Setup auth state listener - this is the SINGLE source of truth
      onAuthStateChanged(auth, async (user) => {
        console.log("🔐 Auth state changed:", user ? `${user.isAnonymous ? 'Anonymous' : 'Google'} - ${user.email || user.uid}` : 'Signed out');
        
        const previousUser = this.currentUser;
        this.currentUser = user;

        if (user) {
          // Load or create profile
          await this.loadUserProfile(user.uid);
          
          // If transitioning from anonymous to Google, log it
          if (previousUser?.isAnonymous && !user.isAnonymous) {
            console.log("✅ User upgraded from anonymous to Google:", user.email);
          }
          
          // Setup token refresh for non-anonymous users
          if (!user.isAnonymous) {
            this.setupTokenRefreshListener(user);
          }
        } else {
          // User signed out
          if (previousUser) {
            try {
              const { cleanupUserStorage } = await import('@/lib/storage-utils');
              cleanupUserStorage(previousUser.uid);
            } catch (error) {
              console.error('Failed to cleanup user storage:', error);
            }
          }
          this.userProfile = null;
        }

        // Notify all listeners
        this.authStateListeners.forEach((listener) => listener(user));
        
        // Resolve auth ready promise on first auth state
        if (this.authReadyResolver) {
          this.authReadyResolver(user);
          this.authReadyResolver = null;
        }
      });

      // Handle redirect result (for returning from Google sign-in)
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          console.log("📥 Redirect result: user signed in:", result.user.email);
          await this.createOrUpdateProfile(result.user);
        }
      } catch (redirectError) {
        console.warn("Redirect result check failed (normal if no redirect):", redirectError);
      }

      initializationComplete = true;
      console.log("✅ Firebase initialization complete");

    } catch (error) {
      console.error("Firebase initialization error:", error);
      initializationComplete = true;
      this.authReadyResolver?.(null);
    }
  }

  // Setup automatic token refresh listener
  private setupTokenRefreshListener(user: User | null): void {
    // Cleanup previous listeners
    if (this.idTokenUnsubscribe) {
      this.idTokenUnsubscribe();
      this.idTokenUnsubscribe = null;
    }
    if (this.tokenRefreshInterval) {
      clearInterval(this.tokenRefreshInterval);
      this.tokenRefreshInterval = null;
    }
    
    if (!user || user.isAnonymous || !auth) return;
    
    // Listen to token changes
    this.idTokenUnsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      if (firebaseUser && !firebaseUser.isAnonymous) {
        try {
          const token = await firebaseUser.getIdToken(false);
          if (token) {
            console.log("🔄 Token refreshed, length:", token.length);
          }
        } catch (error) {
          console.error("Error getting token after change:", error);
        }
      }
    });
    
    // Proactive refresh every 50 minutes
    this.tokenRefreshInterval = setInterval(async () => {
      if (auth?.currentUser && !auth.currentUser.isAnonymous) {
        try {
          await auth.currentUser.getIdToken(true);
          console.log("🔄 Token proactively refreshed");
        } catch (error) {
          console.error("Proactive token refresh failed:", error);
        }
      }
    }, 50 * 60 * 1000);
  }

  // Wait for Firebase to be fully initialized and auth state to be determined
  async waitForAuthReady(): Promise<User | null> {
    await this.ensureInitialized();
    return this.authReadyPromise || Promise.resolve(null);
  }

  // Handle redirect result (for compatibility with FirebaseProvider)
  async handleRedirectResult(): Promise<UserProfile | null> {
    await this.ensureInitialized();
    if (!auth) return null;

    try {
      const result = await getRedirectResult(auth);
      if (result?.user) {
        console.log("📥 Redirect result: user signed in:", result.user.email);
        
        if (result.user.email) {
          localStorage.setItem('nexus-google-email', result.user.email);
        }
        
        return this.createOrUpdateProfile(result.user);
      }
    } catch (error) {
      console.warn("Redirect result check failed:", error);
    }
    return null;
  }

  // Check if Firebase is initialized
  isInitialized(): boolean {
    return initializationComplete && app !== null && auth !== null;
  }

  // Ensure Firebase is initialized
  async ensureInitialized(): Promise<void> {
    if (!initializationComplete) {
      await this.initialize();
    }
  }

  // Get current user (returns cached value, use waitForAuthReady for guaranteed state)
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  // Get current user directly from Firebase Auth (most reliable)
  getAuthCurrentUser(): User | null {
    return auth?.currentUser || null;
  }

  // Get user profile
  getUserProfile(): UserProfile | null {
    return this.userProfile;
  }

  // Subscribe to auth state changes
  onAuthStateChange(callback: (user: User | null) => void): () => void {
    this.authStateListeners.add(callback);
    // Call immediately with current state if auth is ready
    if (initializationComplete) {
      callback(this.currentUser);
    }
    return () => this.authStateListeners.delete(callback);
  }

  // ======== ROBUST AUTHENTICATION METHODS ========

  /**
   * Initialize user session - this is the main entry point
   * 1. Wait for Firebase auth to be ready
   * 2. If a Google user exists, use it (no anonymous creation)
   * 3. If only anonymous user exists, keep it
   * 4. If no user exists, create anonymous user
   */
  async initializeUserSession(): Promise<UserProfile | null> {
    await this.ensureInitialized();
    
    // Wait for initial auth state
    const user = await this.waitForAuthReady();
    
    if (user) {
      // User already exists (Google or anonymous)
      console.log(`✅ Existing user found: ${user.isAnonymous ? 'Anonymous' : 'Google'} - ${user.email || user.uid}`);
      
      // Ensure profile is loaded
      if (!this.userProfile) {
        await this.loadUserProfile(user.uid);
      }
      
      return this.userProfile;
    }
    
    // No user exists - check localStorage for saved Google token
    const savedGoogleEmail = localStorage.getItem('nexus-google-email');
    if (savedGoogleEmail) {
      console.log("📧 Found saved Google email, checking Firestore...");
      const existingUser = await this.findUserByEmail(savedGoogleEmail);
      if (existingUser) {
        console.log("⚠️ Google account exists but not signed in. User should sign in with Google.");
        // Don't create anonymous user - wait for Google sign-in
        return null;
      }
    }
    
    // No existing account found - create anonymous user
    return this.signInAnonymously();
  }

  /**
   * Sign in anonymously - ONLY if no user exists
   * This will NOT create a new anonymous user if a Google account is signed in
   */
  async signInAnonymously(): Promise<UserProfile> {
    await this.ensureInitialized();
    
    if (!auth) {
      throw new Error("Firebase not initialized");
    }

    // Check current user from Firebase Auth directly (most reliable)
    const currentAuthUser = auth.currentUser;
    
    // If a non-anonymous user exists, DON'T create anonymous user
    if (currentAuthUser && !currentAuthUser.isAnonymous) {
      console.log("✅ Google user already signed in, skipping anonymous creation:", currentAuthUser.email);
      this.currentUser = currentAuthUser;
      
      if (!this.userProfile) {
        await this.loadUserProfile(currentAuthUser.uid);
      }
      
      if (this.userProfile) {
        return this.userProfile;
      }
      
      return this.createOrUpdateProfile(currentAuthUser);
    }
    
    // If anonymous user already exists, reuse it
    if (currentAuthUser?.isAnonymous) {
      console.log("✅ Reusing existing anonymous user:", currentAuthUser.uid);
      this.currentUser = currentAuthUser;
      
      if (!this.userProfile) {
        await this.loadUserProfile(currentAuthUser.uid);
      }
      
      if (this.userProfile) {
        return this.userProfile;
      }
      
      return this.createOrUpdateProfile(currentAuthUser);
    }

    // No user exists - create anonymous user
    try {
      console.log("🔐 Creating new anonymous user...");
      const userCredential = await firebaseSignInAnonymously(auth);
      const user = userCredential.user;
      
      console.log("✅ Anonymous user created:", user.uid);
      
      return this.createOrUpdateProfile(user);
    } catch (error: unknown) {
      const authError = error as { code?: string; message?: string };
      console.error("Anonymous sign-in failed:", authError.code, authError.message);
      
      if (authError.code === "auth/operation-not-allowed") {
        throw new Error("Anonymous authentication is not enabled in Firebase Console");
      }
      
      throw error;
    }
  }

  /**
   * Sign in with Google - replaces any anonymous user
   */
  async signInWithGoogle(): Promise<void> {
    await this.ensureInitialized();
    
    if (!auth) {
      throw new Error("Firebase not initialized");
    }

    const isElectron = typeof window !== "undefined" && window.electronAPI;

    try {
      if (isElectron) {
        // Electron: use popup
        try {
          const result = await signInWithPopup(auth, googleProvider);
          const user = result.user;
          
          // Save email for future reference
          if (user.email) {
            localStorage.setItem('nexus-google-email', user.email);
          }
          
          await this.createOrUpdateProfile(user);
          this.authStateListeners.forEach((listener) => listener(user));
        } catch (popupError: any) {
          if (popupError.code === "auth/popup-blocked") {
            await signInWithRedirect(auth, googleProvider);
          } else {
            throw popupError;
          }
        }
      } else {
        // Browser: use redirect
        await signInWithRedirect(auth, googleProvider);
      }
    } catch (error: any) {
      console.error("Google sign-in error:", error);
      
      if (error.code === "auth/popup-closed-by-user") {
        throw new Error("Connexion annulée");
      } else if (error.code === "auth/network-request-failed") {
        throw new Error("Erreur réseau. Vérifiez votre connexion.");
      }
      
      throw error;
    }
  }

  /**
   * Link Google account to anonymous user
   * If Google account already exists, sign in to that account instead
   */
  async linkWithGoogleCredential(
    idToken: string, 
    accessToken: string, 
    googleUserData?: { email?: string; displayName?: string; photoURL?: string }
  ): Promise<UserProfile> {
    await this.ensureInitialized();
    
    if (!auth) {
      throw new Error("Firebase not initialized");
    }
    
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      throw new Error("No user signed in");
    }
    
    if (!googleUserData?.email) {
      throw new Error("Google email is required");
    }

    // Save email for future reference
    localStorage.setItem('nexus-google-email', googleUserData.email);

    try {
      // If current user is NOT anonymous, just update their profile
      if (!currentUser.isAnonymous) {
        console.log("✅ User is already Google signed in, updating profile");
        return this.createOrUpdateProfile(currentUser, googleUserData);
      }

      // Check if Google account already exists
      const existingUser = await this.findUserByEmail(googleUserData.email);
      
      if (existingUser && existingUser.uid !== currentUser.uid) {
        // Google account exists with different UID - sign in to that account
        console.log("🔄 Google account exists, signing in to existing account...");
        
        const credential = GoogleAuthProvider.credential(idToken, accessToken);
        const userCredential = await signInWithCredential(auth, credential);
        const user = userCredential.user;
        
        console.log("✅ Signed in to existing Google account:", user.email);
        
        // The anonymous user is now orphaned - Firebase handles this
        return this.createOrUpdateProfile(user, googleUserData);
      }

      // Link anonymous user to Google
      console.log("🔗 Linking anonymous user to Google account...");
      
      // Update profile first
      await this.createOrUpdateProfile(currentUser, googleUserData);
      
      // Then link
      const credential = GoogleAuthProvider.credential(idToken, accessToken);
      const userCredential = await linkWithCredential(currentUser, credential);
      const user = userCredential.user;
      
      console.log("✅ Anonymous user linked with Google:", user.email);
      
      // Reload profile
      await this.loadUserProfile(user.uid);
      
      return this.userProfile!;

    } catch (error: any) {
      console.error("Link Google account error:", error);
      
      if (error.code === "auth/credential-already-in-use") {
        // Sign in to existing account
        console.log("🔄 Credential in use, signing in to existing account...");
        
        const credential = GoogleAuthProvider.credential(idToken, accessToken);
        const userCredential = await signInWithCredential(auth, credential);
        const user = userCredential.user;
        
        return this.createOrUpdateProfile(user, googleUserData);
      }
      
      if (error.code === "auth/email-already-in-use") {
        throw new Error("Cet email est déjà utilisé par un autre compte");
      }
      
      throw error;
    }
  }

  /**
   * Sign out
   */
  async signOut(): Promise<void> {
    // Cleanup listeners
    if (this.idTokenUnsubscribe) {
      this.idTokenUnsubscribe();
      this.idTokenUnsubscribe = null;
    }
    if (this.tokenRefreshInterval) {
      clearInterval(this.tokenRefreshInterval);
      this.tokenRefreshInterval = null;
    }

    // Clear saved email
    localStorage.removeItem('nexus-google-email');

    if (!auth) {
      throw new Error("Firebase not initialized");
    }

    await signOut(auth);
    this.currentUser = null;
    this.userProfile = null;
  }

  // ======== HELPER METHODS ========

  /**
   * Find user by email in Firestore
   */
  async findUserByEmail(email: string): Promise<UserProfile | null> {
    if (!db || !email) return null;

    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        return querySnapshot.docs[0].data() as UserProfile;
      }
    } catch (error: any) {
      // Handle gracefully
      if (error.code === 'permission-denied' || error.code === 'unavailable') {
        console.warn("Firestore query not available:", error.code);
        return null;
      }
      console.warn("findUserByEmail error:", error.message);
    }

    return null;
  }

  /**
   * Load user profile from Firestore
   */
  private async loadUserProfile(userId: string): Promise<void> {
    if (!db) return;

    try {
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const data = userDoc.data();
        const nowStr = new Date().toISOString();
        this.userProfile = {
          uid: userId,
          email: data.email || null,
          displayName: data.displayName || null,
          photoURL: data.photoURL || null,
          plan: data.plan || "free",
          subscriptionStatus: data.subscriptionStatus || "none",
          storageUsed: data.storageUsed || 0,
          createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || nowStr,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt || nowStr,
          lastLoginAt: data.lastLoginAt?.toDate?.()?.toISOString?.() || data.lastLoginAt || nowStr,
          isAnonymous: data.isAnonymous || false,
        };
      }
    } catch (error: any) {
      if (error.code !== 'permission-denied' && error.code !== 'unavailable') {
        console.error("Error loading user profile:", error);
      }
    }
  }

  /**
   * Create or update user profile in Firestore
   */
  async createOrUpdateProfile(
    user: User, 
    additionalData?: { email?: string; displayName?: string; photoURL?: string }
  ): Promise<UserProfile> {
    const nowStr = new Date().toISOString();
    
    if (!db) {
      // Return minimal profile if Firestore is not available
      this.userProfile = {
        uid: user.uid,
        email: additionalData?.email || user.email || null,
        displayName: additionalData?.displayName || user.displayName || null,
        photoURL: additionalData?.photoURL || user.photoURL || null,
        plan: "free",
        subscriptionStatus: "none",
        storageUsed: 0,
        createdAt: nowStr,
        updatedAt: nowStr,
        lastLoginAt: nowStr,
        isAnonymous: user.isAnonymous,
      };
      return this.userProfile;
    }

    const userDocRef = doc(db, 'users', user.uid);
    
    try {
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        // Update existing profile
        const existingData = userDoc.data();
        const updateData: any = {
          updatedAt: nowStr,
          lastLoginAt: nowStr,
        };

        // Only update if new data is provided
        if (additionalData?.email) updateData.email = additionalData.email;
        if (additionalData?.displayName) updateData.displayName = additionalData.displayName;
        if (additionalData?.photoURL) updateData.photoURL = additionalData.photoURL;
        if (!user.isAnonymous) updateData.isAnonymous = false;

        await updateDoc(userDocRef, updateData);

        const createdAt = existingData.createdAt?.toDate?.()?.toISOString?.() || 
                          existingData.createdAt || nowStr;

        this.userProfile = {
          uid: user.uid,
          email: updateData.email || existingData.email || null,
          displayName: updateData.displayName || existingData.displayName || null,
          photoURL: updateData.photoURL || existingData.photoURL || null,
          plan: existingData.plan || "free",
          subscriptionStatus: existingData.subscriptionStatus || "none",
          storageUsed: existingData.storageUsed || 0,
          createdAt,
          updatedAt: nowStr,
          lastLoginAt: nowStr,
          isAnonymous: updateData.isAnonymous ?? existingData.isAnonymous ?? user.isAnonymous,
        };
      } else {
        // Create new profile
        const newProfile: UserProfile = {
          uid: user.uid,
          email: additionalData?.email || user.email || null,
          displayName: additionalData?.displayName || user.displayName || null,
          photoURL: additionalData?.photoURL || user.photoURL || null,
          plan: "free",
          subscriptionStatus: "none",
          storageUsed: 0,
          createdAt: nowStr,
          updatedAt: nowStr,
          lastLoginAt: nowStr,
          isAnonymous: user.isAnonymous,
        };

        await setDoc(userDocRef, newProfile);
        this.userProfile = newProfile;
      }
    } catch (error: any) {
      console.error("Error creating/updating profile:", error);
      
      // Return minimal profile on error
      this.userProfile = {
        uid: user.uid,
        email: additionalData?.email || user.email || null,
        displayName: additionalData?.displayName || user.displayName || null,
        photoURL: additionalData?.photoURL || user.photoURL || null,
        plan: "free",
        subscriptionStatus: "none",
        storageUsed: 0,
        createdAt: nowStr,
        updatedAt: nowStr,
        lastLoginAt: nowStr,
        isAnonymous: user.isAnonymous,
      };
    }

    return this.userProfile;
  }

  /**
   * Check if user is Pro
   */
  isPro(): boolean {
    return this.userProfile?.plan === "pro" && 
           this.userProfile?.subscriptionStatus === "active";
  }

  /**
   * Get ID token for backend calls
   */
  async getIdToken(forceRefresh: boolean = false): Promise<string | null> {
    const user = auth?.currentUser || this.currentUser;
    
    if (!user) {
      console.warn("getIdToken: No current user");
      return null;
    }
    
    if (user.isAnonymous) {
      return null;
    }
    
    try {
      return await user.getIdToken(forceRefresh);
    } catch (error) {
      console.error("getIdToken error:", error);
      return null;
    }
  }

  /**
   * Update subscription (from Stripe webhook)
   */
  async updateSubscription(plan: "free" | "pro", status: "active" | "cancelled" | "past_due" | "none"): Promise<void> {
    if (!db || !this.currentUser) return;

    try {
      const userDocRef = doc(db, 'users', this.currentUser.uid);
      const nowStr = new Date().toISOString();
      await updateDoc(userDocRef, {
        plan,
        subscriptionStatus: status,
        updatedAt: nowStr,
      });

      if (this.userProfile) {
        this.userProfile.plan = plan;
        this.userProfile.subscriptionStatus = status;
        this.userProfile.updatedAt = nowStr;
      }
    } catch (error) {
      console.error("Error updating subscription:", error);
    }
  }

  /**
   * Update storage used
   */
  async updateStorageUsed(bytes: number): Promise<void> {
    if (!db || !this.currentUser) return;

    try {
      const userDocRef = doc(db, 'users', this.currentUser.uid);
      await updateDoc(userDocRef, {
        storageUsed: bytes,
        updatedAt: new Date(),
      });

      if (this.userProfile) {
        this.userProfile.storageUsed = bytes;
      }
    } catch (error) {
      console.error("Error updating storage:", error);
    }
  }
}

// Export singleton instance
export const firebaseService = new FirebaseService();

// Export helper functions for compatibility
export function getDb(): Firestore | null {
  return db;
}

export function getAuthInstance(): Auth | null {
  return auth;
}

export function getFirebaseApp(): FirebaseApp | null {
  return app;
}

export async function waitForFirebase(): Promise<{ app: FirebaseApp; auth: Auth; db: Firestore } | null> {
  await firebaseService.ensureInitialized();
  if (app && auth && db) {
    return { app, auth, db };
  }
  return null;
}

export { auth, db, app as firebaseApp };
