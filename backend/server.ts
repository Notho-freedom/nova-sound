import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from 'dotenv';

// Import routes first
// Note: Must use .js extension for ESM imports (Vercel compiles TS to JS)
import configRoutes from './routes/config.js';
import storageRoutes from './routes/storage.js';
import stripeRoutes from './routes/stripe.js';
import syncRoutes from './routes/sync.js';
import updateRoutes from './routes/update.js';
import adminRoutes from './routes/admin.js';
import authRoutes from './routes/auth.js';

// Load environment variables (only in development, Vercel provides env vars automatically)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  config();
}

const app: Express = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['*'],
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString() 
  });
});

app.use('/api/config', configRoutes);
app.use('/api/storage', storageRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/update', updateRoutes);
app.use('/api/updates', updateRoutes); // Alias for /api/updates/latest
app.use('/api/admin', adminRoutes);
app.use('/api/auth', authRoutes);

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server locally (but not when running in Electron - Electron will start it)
// Check if we're in Electron by looking for electron in process.versions
const isElectron = typeof process !== 'undefined' && process.versions && 'electron' in process.versions;

if (!isElectron && (process.env.NODE_ENV !== 'production' || process.env.VERCEL !== '1')) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

// Export for Vercel - wrap Express app in a serverless handler
// Vercel expects a function that handles (req, res) or (req, res, next)
export default app;

