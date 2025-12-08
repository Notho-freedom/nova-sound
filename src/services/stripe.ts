import { loadStripe, Stripe } from "@stripe/stripe-js";
import { authService } from "./auth";

// Stripe configuration
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const API_BASE_URL = import.meta.env.VITE_API_URL || "";

// Validate config
const isConfigValid = STRIPE_PUBLISHABLE_KEY && STRIPE_PUBLISHABLE_KEY !== "undefined";

let stripePromise: Promise<Stripe | null> | null = null;

// Initialize Stripe
if (isConfigValid) {
  stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
} else {
  console.warn("Stripe publishable key not configured. Check your .env file.");
}

// Price IDs - these should be configured in your Stripe dashboard
export const PRICE_IDS = {
  PRO_MONTHLY: import.meta.env.VITE_STRIPE_PRICE_PRO_MONTHLY || "price_pro_monthly",
  PRO_YEARLY: import.meta.env.VITE_STRIPE_PRICE_PRO_YEARLY || "price_pro_yearly",
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
    if (!idToken) {
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
      const error = await response.json();
      throw new Error(error.message || "Failed to create checkout session");
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
    if (!idToken) {
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
      const error = await response.json();
      throw new Error(error.message || "Failed to create portal session");
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
    if (!idToken) {
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
        throw new Error("Failed to get subscription status");
      }

      return response.json();
    } catch (error) {
      console.error("Error getting subscription status:", error);
      return {
        isActive: false,
        plan: "free",
        status: "error",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      };
    }
  }

  // Handle post-checkout success
  async handleCheckoutSuccess(sessionId: string): Promise<void> {
    const accessToken = await authService.getAccessToken();
    if (!idToken) {
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
      await firebaseService.updateProfile({ plan: "pro", subscriptionStatus: "active" });
    }
  }
}

export const stripeService = new StripeService();

