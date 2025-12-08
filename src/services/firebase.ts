import { initializeApp, FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  signInAnonymously as firebaseSignInAnonymously,
  linkWithCredential,
  OAuthCredential,
  User,
  Auth,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  Firestore,
} from "firebase/firestore";

// Firebase configuration - loaded from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Validate config
const isConfigValid = Object.values(firebaseConfig).every(
  (value) => value && value !== "undefined"
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

// Initialize Firebase only if config is valid
if (isConfigValid) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("Firebase initialized successfully");
  } catch (error) {
    console.error("Firebase initialization error:", error);
  }
} else {
  console.warn("Firebase config incomplete. Please check your .env file.");
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

  constructor() {
    // Listen for auth state changes
    if (auth) {
      onAuthStateChanged(auth, async (user) => {
        this.currentUser = user;
        if (user) {
          const userType = user.isAnonymous ? "anonymous" : (user.email || "authenticated");
          console.log("Auth state changed: user signed in", userType, user.uid);
          
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
          this.userProfile = null;
          // Notify listeners
          this.authStateListeners.forEach((listener) => listener(null));
        }
      });
    }
  }

  // Handle redirect result after Google sign-in (call this on app initialization)
  async handleRedirectResult(): Promise<UserProfile | null> {
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
  async signInAnonymously(): Promise<UserProfile> {
    if (!auth) {
      throw new Error("Firebase not initialized. Check your configuration.");
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
      throw new Error(authError.message || "Erreur lors de la connexion anonyme");
    }
  }

  // Link Google account to anonymous user (using manual OAuth credential)
  // Google data takes priority over anonymous data
  // Step 1: Update Firebase profile with Google data BEFORE linking
  // Step 2: Link the Google credential to the anonymous user
  async linkWithGoogleCredential(idToken: string, accessToken: string, googleUserData?: { email?: string; displayName?: string; photoURL?: string }): Promise<UserProfile> {
    if (!auth || !this.currentUser) {
      throw new Error("Firebase not initialized or no user signed in");
    }

    if (!this.currentUser.isAnonymous) {
      throw new Error("Current user is not anonymous. Cannot link account.");
    }

    if (!googleUserData || !googleUserData.email) {
      throw new Error("Google user data is required to link account");
    }

    try {
      // STEP 1: Update Firebase profile with Google data BEFORE linking
      console.log("📝 Step 1: Updating anonymous profile with Google data before linking...");
      await this.createOrUpdateProfile(this.currentUser, googleUserData);
      console.log("✅ Profile updated with Google data:", this.userProfile);
      
      // STEP 2: Link the Google credential to the anonymous user
      console.log("🔗 Step 2: Linking Google credential to anonymous user...");
      const credential = GoogleAuthProvider.credential(idToken, accessToken);
      const userCredential = await linkWithCredential(this.currentUser, credential);
      const user = userCredential.user;
      
      console.log("✅ Firebase anonymous user linked with Google account:", user.uid);
      
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
        throw new Error("Ce compte Google est déjà utilisé par un autre utilisateur.");
      } else if (authError.code === "auth/email-already-in-use") {
        throw new Error("Cet email est déjà utilisé par un autre compte.");
      }
      
      throw new Error(authError.message || "Erreur lors de la liaison du compte");
    }
  }

  // Sign in with Google
  async signInWithGoogle(): Promise<void> {
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
          await this.createOrUpdateProfile(user);
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
    if (!auth) {
      throw new Error("Firebase not initialized");
    }

    await signOut(auth);
    this.currentUser = null;
    this.userProfile = null;
  }

  // Load user profile from Firestore
  private async loadUserProfile(uid: string): Promise<void> {
    if (!db || !this.currentUser) return;

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
    } catch (error) {
      console.error("Error loading user profile:", error);
      // If loading fails, try to create profile from current user
      if (this.currentUser) {
        try {
          await this.createOrUpdateProfile(this.currentUser);
        } catch (createError) {
          console.error("Error creating profile:", createError);
        }
      }
    }
  }

  // Create or update user profile
  // googleUserData takes priority over Firebase user data when provided
  private async createOrUpdateProfile(user: User, googleUserData?: { email?: string; displayName?: string; photoURL?: string }): Promise<UserProfile> {
    if (!db) {
      throw new Error("Firestore not initialized");
    }

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    // Priority: googleUserData > user (Firebase) > existing profile
    const email = googleUserData?.email || user.email || "";
    const displayName = googleUserData?.displayName || user.displayName || 
      (user.isAnonymous ? "Utilisateur anonyme" : (user.email?.split("@")[0] || "Utilisateur"));
    const photoURL = googleUserData?.photoURL || user.photoURL || null;

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
      
      await updateDoc(userRef, cleanedProfile);
      
      this.userProfile = {
        ...existingProfile,
        ...cleanedProfile,
      };
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

      await setDoc(userRef, newProfile);
      this.userProfile = newProfile;
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
export { auth, db };

