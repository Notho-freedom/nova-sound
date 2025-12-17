/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  poweredByHeader: false, // Désactiver le badge "X-Powered-By: Next.js"
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
  // Désactiver certaines optimisations pour Electron
  // Mark native Node.js modules as external (server-only)
  serverExternalPackages: ['electron', 'ssh2', 'ssh2-sftp-client'],
  // Configuration Turbopack (vide pour permettre webpack)
  turbopack: {},
};

export default nextConfig;

