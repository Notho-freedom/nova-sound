import { loadStripe, Stripe } from "@stripe/stripe-js";
import { authService } from "./auth";

// Stripe configuration
// Next.js: Use NEXT_PUBLIC_ prefix for client-side env vars
const STRIPE_PUBLISHABLE_KEY = typeof window !== 'undefined' 
  ? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY 
  : undefined;

// Next.js: Use same-origin API routes (no base URL needed)
// With Next.js, API routes are on the same origin, so we don't need a base URL
const API_BASE_URL = '';

// Validate config
const isConfigValid = STRIPE_PUBLISHABLE_KEY && STRIPE_PUBLISHABLE_KEY !== "undefined";

let stripePromise: Promise<Stripe | null> | null = null;

// Initialize Stripe
if (isConfigValid && typeof window !== 'undefined') {
  stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
} else if (typeof window !== 'undefined') {
  console.warn("Stripe publishable key not configured. Check your .env file.");
}

// Price IDs - these should be configured in your Stripe dashboard
export const PRICE_IDS = {
  PRO_MONTHLY: typeof window !== 'undefined' 
    ? (process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY || "price_pro_monthly")
    : "price_pro_monthly",
  PRO_YEARLY: typeof window !== 'undefined' 
    ? (process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY || "price_pro_yearly")
    : "price_pro_yearly",
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
  // Check if Stripe is initialized
  isInitialized(): boolean {
    return isConfigValid;
  }

  // Get Stripe instance
  async getStripe(): Promise<Stripe | null> {
    if (!stripePromise) {
      throw new Error("Stripe not initialized. Check your configuration.");
    }
    return stripePromise;
  }

  // Create checkout session for Pro subscription
  async createCheckoutSession(priceId: string = PRICE_IDS.PRO_MONTHLY): Promise<string> {
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
        priceId,
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
  async redirectToCheckout(priceId: string = PRICE_IDS.PRO_MONTHLY): Promise<void> {
    const checkoutUrl = await this.createCheckoutSession(priceId);
    window.location.href = checkoutUrl;
  }

  // Create billing portal session
  async createPortalSession(): Promise<string> {
    const accessToken = await authService.getAccessToken();
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
        const error = await response.json();
        throw new Error(error.message || "Failed to create portal session");
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
    const accessToken = await authService.getAccessToken();
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

