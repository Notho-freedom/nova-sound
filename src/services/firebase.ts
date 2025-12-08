import { initializeApp, FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
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
          await this.loadUserProfile(user.uid);
        } else {
          this.userProfile = null;
        }
        // Notify listeners
        this.authStateListeners.forEach((listener) => listener(user));
      });
    }
  }

  // Handle redirect result after Google sign-in (call this on app initialization)
  async handleRedirectResult(): Promise<UserProfile | null> {
    if (!auth) return null;

    try {
      const result = await getRedirectResult(auth);
      if (result && result.user) {
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
        this.userProfile = userSnap.data() as UserProfile;
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
  private async createOrUpdateProfile(user: User): Promise<UserProfile> {
    if (!db) {
      throw new Error("Firestore not initialized");
    }

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      // Update last login
      const existingProfile = userSnap.data() as UserProfile;
      await updateDoc(userRef, {
        lastLoginAt: new Date().toISOString(),
        displayName: user.displayName || existingProfile.displayName,
        photoURL: user.photoURL || existingProfile.photoURL,
      });
      
      this.userProfile = {
        ...existingProfile,
        lastLoginAt: new Date().toISOString(),
        displayName: user.displayName || existingProfile.displayName,
        photoURL: user.photoURL || existingProfile.photoURL,
      };
    } else {
      // Create new profile
      const newProfile: UserProfile = {
        uid: user.uid,
        email: user.email || "",
        displayName: user.displayName || "Utilisateur",
        photoURL: user.photoURL,
        plan: "free",
        storageUsed: 0,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };

      await setDoc(userRef, newProfile);
      this.userProfile = newProfile;
    }

    return this.userProfile;
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
  async getIdToken(): Promise<string | null> {
    if (!this.currentUser) return null;
    return this.currentUser.getIdToken();
  }
}

export const firebaseService = new FirebaseService();
export { auth, db };

