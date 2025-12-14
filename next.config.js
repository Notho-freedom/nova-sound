import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  trailingSlash: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
    unoptimized: true, // Pour Electron
  },
  webpack: (config, { isServer }) => {
    // Ignorer les modules Electron côté serveur
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        'electron': 'commonjs electron',
      });
    }
    
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }
    
    // Ignorer les modules Electron côté client
    config.externals = config.externals || [];
    if (!isServer) {
      config.externals.push({
        electron: 'electron',
      });
    }
    
    // Exclure les fichiers Electron du build (tous les emplacements)
    config.module = config.module || {};
    config.module.rules = config.module.rules || [];
    
    // Exclure electron/ (racine)
    config.module.rules.push({
      test: /electron\/.*\.ts$/,
      use: 'ignore-loader',
    });
    
    // Exclure public/local-ui/** (tout le dossier)
    config.module.rules.push({
      test: /public\/local-ui\/.*\.ts$/,
      use: 'ignore-loader',
    });
    
    // Exclure local-ui/** (tout le dossier)
    config.module.rules.push({
      test: /local-ui\/.*\.ts$/,
      use: 'ignore-loader',
    });
    // Exclure tout le dossier local-ui et public/local-ui du build Next.js
    config.watchOptions = config.watchOptions || {};
    config.watchOptions.ignored = [
      ...(Array.isArray(config.watchOptions.ignored) ? config.watchOptions.ignored : [config.watchOptions.ignored || []]),
      '**/local-ui/**',
      '**/public/local-ui/**',
      '**/electron/**',
      '**/backend/**',
    ];
    // Exclure les fichiers de test et config Vitest
    config.module.rules.push({
      test: /(vitest\.config|vitest\.setup|\.test|\.spec)\.ts$/,
      use: 'ignore-loader',
    });
    return config;
  },
  
  // Désactiver certaines optimisations pour Electron
  // Mark native Node.js modules as external (server-only)
  serverExternalPackages: ['electron'],
  // Configuration Turbopack
  turbopack: {
    root: __dirname, // Définir explicitement la racine pour éviter l'avertissement
  },
  
  // Exclure les dossiers du build TypeScript
  typescript: {
    // Ignorer les erreurs TypeScript dans ces dossiers
    ignoreBuildErrors: false,
  },
  
  // Exclure les dossiers du scan de fichiers (static export)
  outputFileTracingExcludes: {
    '*': [
      '**/local-ui/**',
      '**/public/local-ui/**',
      '**/electron/**',
      '**/backend/**',
    ],
  },
};

export default nextConfig;

