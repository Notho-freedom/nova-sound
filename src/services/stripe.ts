import { loadStripe, Stripe } from "@stripe/stripe-js";
import { authService } from "./auth";

// Helper function to detect Electron environment
function isElectron(): boolean {
  return typeof window !== 'undefined' && 
         (window as any).electronAPI !== undefined;
}

// Stripe configuration - loaded from API route (server-side only)
// Fallback to NEXT_PUBLIC_* for backward compatibility
let stripeConfig: {
  publishableKey: string;
  priceProMonthly: string;
  priceProYearly: string;
} | null = null;

// Next.js: Use same-origin API routes (no base URL needed)
// With Next.js, API routes are on the same origin, so we don't need a base URL
const API_BASE_URL = '';

let stripePromise: Promise<Stripe | null> | null = null;
let configLoadPromise: Promise<void> | null = null;

// Load Stripe configuration from API route
async function loadStripeConfig(): Promise<void> {
  // Only load on client side
  if (typeof window === 'undefined') {
    return;
  }

  // If already loaded, return
  if (stripeConfig) {
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
      const response = await fetch('/api/config/stripe');
      
      if (response.ok) {
        const config = await response.json();
        stripeConfig = {
          publishableKey: config.publishableKey || '',
          priceProMonthly: config.priceProMonthly || 'price_pro_monthly',
          priceProYearly: config.priceProYearly || 'price_pro_yearly',
        };
        console.log("✅ Stripe config loaded from API route:", {
          monthly: stripeConfig.priceProMonthly,
          yearly: stripeConfig.priceProYearly,
        });
      } else {
        throw new Error(`API route returned ${response.status}`);
      }
    } catch (error) {
      console.warn("Failed to load Stripe config from API, trying fallback:", error);
      
      // Fallback to NEXT_PUBLIC_* for backward compatibility
      stripeConfig = {
        publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
        priceProMonthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY || 'price_pro_monthly',
        priceProYearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY || 'price_pro_yearly',
      };
    }

    // Validate config and initialize Stripe
    const isConfigValid = stripeConfig && stripeConfig.publishableKey && stripeConfig.publishableKey !== "undefined";
    
    if (isConfigValid && stripeConfig) {
      stripePromise = loadStripe(stripeConfig.publishableKey);
    } else {
      console.warn("Stripe publishable key not configured. Check your .env file and ensure /api/config/stripe is configured.");
    }
  })();

  return configLoadPromise;
}

// Price IDs - loaded from config
// Note: These are getters that depend on stripeConfig being loaded
// Always call ensureInitialized() before using these
export const PRICE_IDS = {
  get PRO_MONTHLY() {
    if (!stripeConfig) {
      console.warn('[Stripe] Config not loaded yet, using default price ID');
      return 'price_pro_monthly';
    }
    return stripeConfig.priceProMonthly || 'price_pro_monthly';
  },
  get PRO_YEARLY() {
    if (!stripeConfig) {
      console.warn('[Stripe] Config not loaded yet, using default price ID');
      return 'price_pro_yearly';
    }
    return stripeConfig.priceProYearly || 'price_pro_yearly';
  },
};

export interface CheckoutSessionResponse {
  sessionId: string;
  url: string;
}

export interface PortalSessionResponse {
  url: string;
}

export interface SubscriptionStatus {
  isActive: boolean;
  plan: "free" | "pro";
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

class StripeService {
  // Ensure Stripe config is loaded
  async ensureInitialized(): Promise<void> {
    await loadStripeConfig();
  }

  // Check if Stripe is initialized
  isInitialized(): boolean {
    return stripePromise !== null;
  }

  // Get Stripe instance
  async getStripe(): Promise<Stripe | null> {
    await this.ensureInitialized();
    if (!stripePromise) {
      throw new Error("Stripe not initialized. Check your configuration.");
    }
    return stripePromise;
  }

  // Create checkout session for Pro subscription
  async createCheckoutSession(priceId: string = PRICE_IDS.PRO_MONTHLY): Promise<string> {
    // Ensure config is loaded
    await this.ensureInitialized();
    
    // Log the price ID being used for debugging
    console.log('[Stripe] Creating checkout session with priceId:', priceId);
    console.log('[Stripe] Available price IDs:', {
      monthly: PRICE_IDS.PRO_MONTHLY,
      yearly: PRICE_IDS.PRO_YEARLY,
    });
    
    // Try Firebase first (preferred method)
    let accessToken: string | null = null;
    let idToken: string | null = null;
    
    try {
      const { firebaseService } = await import('./firebase');
      if (firebaseService.isInitialized() && firebaseService.getCurrentUser()) {
        const firebaseUser = firebaseService.getCurrentUser();
        // Only use Firebase token if user is not anonymous
        if (firebaseUser && !firebaseUser.isAnonymous) {
          idToken = await firebaseService.getIdToken();
          if (idToken) {
            accessToken = idToken; // Use ID token for Firebase users
          }
        }
      }
    } catch (error) {
      // Silent fail, will try authService
    }
    
    // Fallback to authService (manual OAuth) if Firebase token not available
    if (!accessToken) {
      try {
        accessToken = await authService.getAccessToken();
        // Also try to get ID token for better compatibility
        if (!idToken) {
          idToken = await authService.getIdToken();
          // Prefer ID token if available (better for backend verification)
          if (idToken) {
            accessToken = idToken;
          }
        }
      } catch (error) {
        console.warn('Failed to get access token from authService:', error);
      }
    }

    if (!accessToken) {
      throw new Error("User not authenticated");
    }

    const response = await fetch(`${API_BASE_URL}/api/stripe/create-checkout-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        priceId,
        successUrl: `${window.location.origin}/settings?success=true`,
        cancelUrl: `${window.location.origin}/settings?canceled=true`,
      }),
    });

    if (!response.ok) {
      // Check if response is JSON
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const errorData = await response.json();
        
        // Extract error message from standardized error response format
        // API returns: { error: { code, message, details? } }
        let errorMessage = "Failed to create checkout session";
        
        if (errorData.error) {
          // Standardized error format
          if (typeof errorData.error === 'string') {
            errorMessage = errorData.error;
          } else if (errorData.error.message) {
            errorMessage = errorData.error.message;
          } else if (errorData.error.code) {
            errorMessage = `Error ${errorData.error.code}: ${errorData.error.message || 'Unknown error'}`;
          }
        } else if (errorData.message) {
          // Direct message format
          errorMessage = typeof errorData.message === 'string' ? errorData.message : JSON.stringify(errorData.message);
        } else if (typeof errorData === 'string') {
          errorMessage = errorData;
        }
        
        // Check if it's a Stripe configuration error
        if (response.status === 503 && errorMessage.includes("Stripe is not configured")) {
          throw new Error("Stripe n'est pas configuré. Veuillez ajouter STRIPE_SECRET_KEY dans le fichier .env à la racine du projet.");
        }
        
        console.error("Stripe checkout error:", errorData);
        throw new Error(errorMessage);
      } else {
        const text = await response.text();
        console.error("Unexpected response from create-checkout-session:", text.substring(0, 200));
        throw new Error(`Failed to create checkout session: ${response.status}. Vérifiez que les routes API Next.js sont configurées.`);
      }
    }

    // Check if response is JSON
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      console.error("Unexpected response type from create-checkout-session:", contentType, text.substring(0, 200));
      throw new Error("Format de réponse invalide. Vérifiez que les routes API Next.js sont configurées.");
    }

    const data: CheckoutSessionResponse = await response.json();
    return data.url;
  }

  // Redirect to Stripe Checkout
  async redirectToCheckout(priceId?: string): Promise<void> {
    // Ensure config is loaded before using PRICE_IDS
    await this.ensureInitialized();
    
    // Wait a bit more to ensure config is fully set
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Use the provided priceId or get from PRICE_IDS
    let finalPriceId = priceId;
    
    if (!finalPriceId) {
      // Determine which price to use based on the original call
      // If no priceId provided, default to monthly
      finalPriceId = PRICE_IDS.PRO_MONTHLY;
    }
    
    console.log('[Stripe] redirectToCheckout called with:', {
      providedPriceId: priceId,
      finalPriceId,
      configMonthly: PRICE_IDS.PRO_MONTHLY,
      configYearly: PRICE_IDS.PRO_YEARLY,
    });
    
    // Validate that we have a real price ID (not the default fallback)
    if (finalPriceId === 'price_pro_monthly' || finalPriceId === 'price_pro_yearly') {
      console.error('❌ Invalid price ID detected:', finalPriceId);
      console.error('Current stripeConfig:', stripeConfig);
      throw new Error(`Configuration Stripe incomplète. Price ID invalide: ${finalPriceId}. Vérifiez que STRIPE_PRICE_PRO_MONTHLY et STRIPE_PRICE_PRO_YEARLY sont définis dans .env.local`);
    }
    
    const checkoutUrl = await this.createCheckoutSession(finalPriceId);
    
    // In Electron, open Stripe window in app
    if (isElectron() && typeof window !== 'undefined' && window.electronAPI) {
      if (window.electronAPI.openStripeWindow) {
        // Setup Stripe callback listeners
        this.setupStripeListeners();
        
        await window.electronAPI.openStripeWindow(checkoutUrl);
        console.log('💳 Opened Stripe checkout window in app:', checkoutUrl);
        return;
      }
    }
    
    // For web, use redirect
    window.location.href = checkoutUrl;
  }

  // Create billing portal session
  async createPortalSession(): Promise<string> {
    // Try Firebase first (if user is connected via Firebase)
    let accessToken: string | null = null;
    
    try {
      const { firebaseService } = await import('./firebase');
      if (firebaseService.isInitialized() && firebaseService.getCurrentUser()) {
        accessToken = await firebaseService.getIdToken();
      }
    } catch (error) {
      console.log('Firebase not available, trying authService...');
    }
    
    // Fallback to authService (manual OAuth)
    if (!accessToken) {
      accessToken = await authService.getAccessToken();
    }
    
    if (!accessToken) {
      throw new Error("User not authenticated");
    }

    const response = await fetch(`${API_BASE_URL}/api/stripe/create-portal-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        returnUrl: `${window.location.origin}/settings`,
      }),
    });

    if (!response.ok) {
      // Check if response is JSON
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const error = await response.json() as { message?: string; details?: string };
        const errorMessage = error.message || "Failed to create portal session";
        const errorDetails = error.details ? ` (${error.details})` : '';
        throw new Error(`${errorMessage}${errorDetails}`);
      } else {
        const text = await response.text();
        console.error("Unexpected response from create-portal-session:", text.substring(0, 200));
        throw new Error(`Failed to create portal session: ${response.status}. Vérifiez que les routes API Next.js sont configurées.`);
      }
    }

    // Check if response is JSON
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      console.error("Unexpected response type from create-portal-session:", contentType, text.substring(0, 200));
      throw new Error("Format de réponse invalide. Vérifiez que les routes API Next.js sont configurées.");
    }

    const data: PortalSessionResponse = await response.json();
    return data.url;
  }

  // Redirect to billing portal
  async redirectToPortal(): Promise<void> {
    const portalUrl = await this.createPortalSession();
    
    // In Electron, open Stripe window in app
    if (isElectron() && typeof window !== 'undefined' && window.electronAPI) {
      if (window.electronAPI.openStripeWindow) {
        await window.electronAPI.openStripeWindow(portalUrl);
        console.log('💳 Opened Stripe portal window in app:', portalUrl);
        return;
      }
    }
    
    // For web, use redirect
    window.location.href = portalUrl;
  }
  
  // Setup listeners for Stripe callbacks from Electron main process
  private setupStripeListeners(): void {
    if (typeof window === 'undefined' || !window.electronAPI) {
      return;
    }

    // Remove existing listeners if any
    if ((this as any).stripeUnsubscribe) {
      (this as any).stripeUnsubscribe();
    }

    // Listen for checkout success
    const successUnsubscribe = window.electronAPI.onStripeCheckoutSuccess?.((data: { sessionId: string; url?: string }) => {
      console.log('💳 Stripe checkout success received from Electron:', data);
      
      // Extract session_id from URL if not provided directly
      let sessionId = data.sessionId;
      if (!sessionId && data.url) {
        try {
          const urlObj = new URL(data.url);
          sessionId = urlObj.searchParams.get('session_id') || sessionId;
        } catch (err) {
          console.warn('Could not parse session_id from URL:', err);
        }
      }
      
      if (sessionId && sessionId !== 'unknown') {
        this.handleCheckoutSuccess(sessionId).catch((error) => {
          console.error('Error handling Stripe checkout success:', error);
        });
      } else {
        console.warn('⚠️ Stripe checkout success but no session_id found');
        // Still refresh subscription status
        this.getSubscriptionStatus().catch((error) => {
          console.error('Error refreshing subscription status:', error);
        });
      }
    });

    // Listen for checkout canceled
    const canceledUnsubscribe = window.electronAPI.onStripeCheckoutCanceled?.(() => {
      console.log('⚠️ Stripe checkout canceled');
      // Could show a toast or notification here if needed
    });

    // Store unsubscribe functions
    if (successUnsubscribe || canceledUnsubscribe) {
      (this as any).stripeUnsubscribe = () => {
        successUnsubscribe?.();
        canceledUnsubscribe?.();
      };
    }
  }

  // Get subscription status
  async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    // Try Firebase first (if user is connected via Firebase)
    let accessToken: string | null = null;
    let idToken: string | null = null;
    
    try {
      const { firebaseService } = await import('./firebase');
      if (firebaseService.isInitialized() && firebaseService.getCurrentUser()) {
        const firebaseUser = firebaseService.getCurrentUser();
        // Only use Firebase token if user is not anonymous
        if (firebaseUser && !firebaseUser.isAnonymous) {
          idToken = await firebaseService.getIdToken();
          if (idToken) {
            accessToken = idToken; // Use ID token for Firebase users
          }
        }
      }
    } catch (error) {
      // Silent fail, will try authService
    }
    
    // Fallback to authService (manual OAuth) if Firebase token not available
    if (!accessToken) {
      try {
        accessToken = await authService.getAccessToken();
        // Also try to get ID token for better compatibility
        if (!idToken) {
          idToken = await authService.getIdToken();
          // Prefer ID token if available (better for backend verification)
          if (idToken) {
            accessToken = idToken;
          }
        }
      } catch (error) {
        console.warn('Failed to get access token from authService:', error);
      }
    }
    
    if (!accessToken) {
      console.warn('No access token available for subscription status check');
      return {
        isActive: false,
        plan: "free",
        status: "none",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      };
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/stripe/subscription-status`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get subscription status: ${response.status}`);
      }

      // Check if response is JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.warn("Routes API Next.js non disponibles ou non configurées. Statut d'abonnement indisponible.");
        // Return default status if API is not available
        return {
          isActive: false,
          plan: "free",
          status: "none",
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
        };
      }

      return response.json();
    } catch (error) {
      console.warn("Erreur lors de la récupération du statut d'abonnement (routes API Next.js peuvent ne pas être configurées):", error);
      // Return default status if API is not available
      return {
        isActive: false,
        plan: "free",
        status: "none",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      };
    }
  }

  // Handle post-checkout success
  async handleCheckoutSuccess(sessionId: string): Promise<void> {
    // Try Firebase first (preferred method)
    let accessToken: string | null = null;
    
    try {
      const { firebaseService } = await import('./firebase');
      if (firebaseService.isInitialized() && firebaseService.getCurrentUser()) {
        const firebaseUser = firebaseService.getCurrentUser();
        if (firebaseUser && !firebaseUser.isAnonymous) {
          accessToken = await firebaseService.getIdToken();
        }
      }
    } catch (error) {
      // Silent fail, will try authService
    }
    
    // Fallback to authService (manual OAuth) if Firebase token not available
    if (!accessToken) {
      accessToken = await authService.getAccessToken();
    }

    if (!accessToken) {
      throw new Error("User not authenticated");
    }

    const response = await fetch(`${API_BASE_URL}/api/stripe/checkout-success`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ sessionId }),
    });

    if (!response.ok) {
      throw new Error("Failed to process checkout success");
    }

    // Refresh user profile
    const user = authService.getCurrentUser();
    if (user) {
      await authService.updateProfile({ plan: "pro", subscriptionStatus: "active" });
    }
  }
}

export const stripeService = new StripeService();

