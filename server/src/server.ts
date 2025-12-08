// IMPORTANT: Load environment variables FIRST, before any other imports
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables with explicit path BEFORE importing routes
const envPath = path.resolve(__dirname, "../.env");
console.log("📁 Loading .env from:", envPath);
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error("❌ Error loading .env file:", result.error);
} else {
  console.log("✅ .env file loaded successfully");
}

// Debug: Show what was loaded
console.log("\n🔍 Environment variables check:");
console.log("PORT:", process.env.PORT);
console.log("FRONTEND_URL:", process.env.FRONTEND_URL);
console.log("GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT_ID?.substring(0, 20) + "...");
console.log("STRIPE_SECRET_KEY exists:", !!process.env.STRIPE_SECRET_KEY);
console.log("STRIPE_SECRET_KEY value:", process.env.STRIPE_SECRET_KEY?.substring(0, 15) + "...");
console.log("STRIPE_PRICE_PRO_MONTHLY:", process.env.STRIPE_PRICE_PRO_MONTHLY);
console.log("STRIPE_PRICE_PRO_YEARLY:", process.env.STRIPE_PRICE_PRO_YEARLY);
console.log("\n");

// NOW import routes (after env is loaded)
import express from "express";
import cors from "cors";
import { authMiddleware } from "./middleware/auth.js";
import { stripeRoutes } from "./routes/stripe.js";
import { storageRoutes } from "./routes/storage.js";
import { syncRoutes } from "./routes/sync.js";

const app = express();
// Use port 3001 by default to avoid conflict with Vite (port 5173)
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API Routes
app.use("/api/stripe", authMiddleware, stripeRoutes);
app.use("/api/storage", authMiddleware, storageRoutes);
app.use("/api/sync", authMiddleware, syncRoutes);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Error:", err);
  res.status(500).json({
    error: err.message || "Internal server error",
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 API endpoints available at http://localhost:${PORT}/api`);
});