import { loadStripe, Stripe } from "@stripe/stripe-js";
import { authService } from "./auth";

// Stripe configuration - loaded from API route (server-only, no secrets exposed)
let stripeConfig: {
  publishableKey: string;
  priceIds: {
    proMonthly: string;
    proYearly: string;
  };
} | null = null;

let configLoadPromise: Promise<void> | null = null;
let stripePromise: Promise<Stripe | null> | null = null;

// API base URL - defaults to Vercel backend or local dev
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.nexus-audio.vercel.app';

// Load Stripe config from API route
async function loadStripeConfig(): Promise<void> {
  if (stripeConfig) {
    return; // Already loaded
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/config/stripe`);
    if (!response.ok) {
      throw new Error(`Failed to load Stripe config: ${response.status}`);
    }
    stripeConfig = await response.json();

    // Validate config
    if (!stripeConfig?.publishableKey) {
      throw new Error("Stripe config incomplete");
    }

    // Initialize Stripe
    if (typeof window !== 'undefined') {
      stripePromise = loadStripe(stripeConfig.publishableKey);
    }
    console.log("Stripe initialized successfully");
  } catch (error) {
    console.error("Stripe initialization error:", error);
    stripeConfig = null;
    stripePromise = null;
  }
}

// Initialize Stripe on first access (client-side only)
if (typeof window !== 'undefined') {
  configLoadPromise = loadStripeConfig();
}

// Price IDs - loaded from config
export const PRICE_IDS = {
  PRO_MONTHLY: "price_pro_monthly", // Will be updated after config loads
  PRO_YEARLY: "price_pro_yearly", // Will be updated after config loads
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
  // Ensure Stripe is initialized
  async ensureInitialized(): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error("Stripe can only be initialized on the client side");
    }
    if (!stripeConfig && configLoadPromise) {
      await configLoadPromise;
    }
    if (!stripeConfig || !stripePromise) {
      throw new Error("Stripe not initialized. Check your configuration.");
    }
    // Update price IDs from config
    if (stripeConfig.priceIds.proMonthly) {
      PRICE_IDS.PRO_MONTHLY = stripeConfig.priceIds.proMonthly;
    }
    if (stripeConfig.priceIds.proYearly) {
      PRICE_IDS.PRO_YEARLY = stripeConfig.priceIds.proYearly;
    }
  }

  // Check if Stripe is initialized
  async isInitialized(): Promise<boolean> {
    if (typeof window !== 'undefined' && !stripeConfig && configLoadPromise) {
      await configLoadPromise;
    }
    return stripeConfig !== null && stripePromise !== null;
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
  async createCheckoutSession(priceId?: string): Promise<string> {
    await this.ensureInitialized();
    const finalPriceId = priceId || PRICE_IDS.PRO_MONTHLY;
    const accessToken = await authService.getAccessToken();
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
        priceId: finalPriceId,
        successUrl: `${window.location.origin}/settings?success=true`,
        cancelUrl: `${window.location.origin}/settings?canceled=true`,
      }),
    });

    if (!response.ok) {
      // Check if response is JSON
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const error = await response.json();
        // Check if it's a Stripe configuration error
        if (response.status === 503 && error.error?.includes("Stripe is not configured")) {
          throw new Error("Stripe n'est pas configuré. Veuillez ajouter STRIPE_SECRET_KEY dans le fichier .env à la racine du projet.");
        }
        throw new Error(error.message || error.error || "Failed to create checkout session");
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
    await this.ensureInitialized();
    const finalPriceId = priceId || PRICE_IDS.PRO_MONTHLY;
    const checkoutUrl = await this.createCheckoutSession(finalPriceId);
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
    window.location.href = portalUrl;
  }

  // Get subscription status
  async getSubscriptionStatus(): Promise<SubscriptionStatus> {
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
    const accessToken = await authService.getAccessToken();
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

