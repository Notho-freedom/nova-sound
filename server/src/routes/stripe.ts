import express from "express";
import Stripe from "stripe";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { AuthenticatedRequest } from "../middleware/auth.js";

// Ensure .env is loaded (in case it wasn't loaded in server.ts)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "../../.env");
dotenv.config({ path: envPath });

const router = express.Router();

// Debug: Log environment variables (REMOVE IN PRODUCTION!)
console.log("=== STRIPE CONFIGURATION DEBUG ===");
console.log("STRIPE_SECRET_KEY exists:", !!process.env.STRIPE_SECRET_KEY);
console.log("STRIPE_SECRET_KEY starts with:", process.env.STRIPE_SECRET_KEY?.substring(0, 7));
console.log("PRICE_PRO_MONTHLY:", process.env.STRIPE_PRICE_PRO_MONTHLY);
console.log("PRICE_PRO_YEARLY:", process.env.STRIPE_PRICE_PRO_YEARLY);
console.log("==================================");

// Initialize Stripe (only if secret key is provided)
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

// Log what we found
console.log("🔍 Stripe initialization check:");
console.log("  STRIPE_SECRET_KEY exists:", !!STRIPE_SECRET_KEY);
console.log("  STRIPE_SECRET_KEY value:", STRIPE_SECRET_KEY ? STRIPE_SECRET_KEY.substring(0, 20) + "..." : "undefined");
console.log("  STRIPE_SECRET_KEY length:", STRIPE_SECRET_KEY?.length || 0);
console.log("  STRIPE_SECRET_KEY trimmed:", STRIPE_SECRET_KEY?.trim() || "");

const stripe = STRIPE_SECRET_KEY && STRIPE_SECRET_KEY.trim() !== ""
  ? new Stripe(STRIPE_SECRET_KEY.trim(), {
      apiVersion: "2023-10-16",
    })
  : null;

// Log Stripe initialization status
if (stripe) {
  console.log("✅ Stripe initialized successfully");
} else {
  console.error("❌ Stripe NOT initialized - STRIPE_SECRET_KEY is missing or empty!");
}

// Price IDs from environment
const PRICE_PRO_MONTHLY = process.env.STRIPE_PRICE_PRO_MONTHLY || "";
const PRICE_PRO_YEARLY = process.env.STRIPE_PRICE_PRO_YEARLY || "";

/**
 * Create Stripe Checkout Session
 * POST /api/stripe/create-checkout-session
 */
router.post("/create-checkout-session", async (req: AuthenticatedRequest, res) => {
  try {
    console.log("📝 Create checkout session request received");
    console.log("Stripe instance exists:", !!stripe);
    
    if (!stripe) {
      console.error("❌ Stripe not configured");
      return res.status(503).json({ 
        error: "Stripe is not configured. Please set STRIPE_SECRET_KEY in server/.env",
        debug: {
          stripeSecretKeyExists: !!process.env.STRIPE_SECRET_KEY,
          nodeEnv: process.env.NODE_ENV,
        }
      });
    }

    const { priceId, successUrl, cancelUrl } = req.body;
    const userId = req.userId;
    const userEmail = req.userEmail;

    console.log("User ID:", userId);
    console.log("User Email:", userEmail);
    console.log("Price ID:", priceId);

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (!priceId) {
      return res.status(400).json({ error: "priceId is required" });
    }

    // Validate price ID
    if (priceId !== PRICE_PRO_MONTHLY && priceId !== PRICE_PRO_YEARLY) {
      console.error("Invalid price ID. Expected:", PRICE_PRO_MONTHLY, "or", PRICE_PRO_YEARLY);
      return res.status(400).json({ error: "Invalid price ID" });
    }

    console.log("✅ Creating Stripe checkout session...");

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer_email: userEmail,
      metadata: {
        userId: userId,
      },
      success_url: successUrl || `${process.env.FRONTEND_URL || "http://localhost:5173"}/settings?success=true`,
      cancel_url: cancelUrl || `${process.env.FRONTEND_URL || "http://localhost:5173"}/settings?canceled=true`,
    });

    console.log("✅ Checkout session created:", session.id);

    res.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error("❌ Error creating checkout session:", error);
    res.status(500).json({ error: (error as Error).message || "Failed to create checkout session" });
  }
});

/**
 * Create Stripe Customer Portal Session
 * POST /api/stripe/create-portal-session
 */
router.post("/create-portal-session", async (req: AuthenticatedRequest, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ error: "Stripe is not configured. Please set STRIPE_SECRET_KEY in server/.env" });
    }

    const { returnUrl } = req.body;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Find customer by metadata or email
    // In a real app, you'd store the Stripe customer ID in your database
    const customers = await stripe.customers.list({
      limit: 100,
    });

    const customer = customers.data.find(
      (c) => c.metadata?.userId === userId
    );

    if (!customer) {
      return res.status(404).json({ error: "No subscription found for this user" });
    }

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: returnUrl || `${process.env.FRONTEND_URL || "http://localhost:5173"}/settings`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Error creating portal session:", error);
    res.status(500).json({ error: (error as Error).message || "Failed to create portal session" });
  }
});

/**
 * Get subscription status
 * GET /api/stripe/subscription-status
 */
router.get("/subscription-status", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (!stripe) {
      // Stripe not configured, return free plan status
      return res.json({
        isActive: false,
        plan: "free",
        status: "none",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      });
    }

    // Find customer by metadata
    const customers = await stripe.customers.list({
      limit: 100,
    });

    const customer = customers.data.find(
      (c) => c.metadata?.userId === userId
    );

    if (!customer) {
      return res.json({
        isActive: false,
        plan: "free",
        status: "none",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      });
    }

    // Get subscriptions for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return res.json({
        isActive: false,
        plan: "free",
        status: "none",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      });
    }

    const subscription = subscriptions.data[0];
    const priceId = subscription.items.data[0]?.price.id;
    const isPro = priceId === PRICE_PRO_MONTHLY || priceId === PRICE_PRO_YEARLY;

    res.json({
      isActive: subscription.status === "active",
      plan: isPro ? "pro" : "free",
      status: subscription.status,
      currentPeriodEnd: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });
  } catch (error) {
    console.error("Error getting subscription status:", error);
    res.status(500).json({ error: (error as Error).message || "Failed to get subscription status" });
  }
});

/**
 * Handle checkout success (webhook alternative)
 * POST /api/stripe/checkout-success
 */
router.post("/checkout-success", async (req: AuthenticatedRequest, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ error: "Stripe is not configured. Please set STRIPE_SECRET_KEY in server/.env" });
    }

    const { sessionId } = req.body;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.metadata?.userId !== userId) {
      return res.status(403).json({ error: "Session does not belong to this user" });
    }

    // The subscription is already created by Stripe
    // You can update your database here if needed

    res.json({ success: true });
  } catch (error) {
    console.error("Error handling checkout success:", error);
    res.status(500).json({ error: (error as Error).message || "Failed to process checkout success" });
  }
});

export { router as stripeRoutes };