/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
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
    
    // Exclure les fichiers Electron du build
    config.module = config.module || {};
    config.module.rules = config.module.rules || [];
    config.module.rules.push({
      test: /electron\/.*\.ts$/,
      use: 'ignore-loader',
    });
    // Exclure les fichiers de test et config Vitest
    config.module.rules.push({
      test: /(vitest\.config|vitest\.setup|\.test|\.spec)\.ts$/,
      use: 'ignore-loader',
    });
    return config;
  },
  
  // Headers pour les routes API
  async headers() {
    return [
      {
        source: '/api/update/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
        ],
      },
    ];
  },
  // Désactiver certaines optimisations pour Electron
  // Mark native Node.js modules as external (server-only)
  serverExternalPackages: ['electron', 'ssh2', 'ssh2-sftp-client'],
  // Configuration Turbopack (vide pour permettre webpack)
  turbopack: {},
};

export default nextConfig;

