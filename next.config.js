import { withSentryConfig } from "@sentry/nextjs";

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
  async headers() {
    const ContentSecurityPolicy = `
      default-src 'self';
      base-uri 'self';
      form-action 'self';
      frame-ancestors 'none';
      object-src 'none';
      script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://www.youtube.com https://s.ytimg.com;
      script-src-elem 'self' 'unsafe-inline' https://js.stripe.com https://www.youtube.com https://s.ytimg.com;
      style-src 'self' 'unsafe-inline';
      img-src 'self' data: blob: https: local-image:;
      font-src 'self' data: https:;
      media-src 'self' blob: data: https: http: local-audio: local-video: local-image:;
      connect-src 'self' https: wss: https://api.stripe.com;
      frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://www.youtube.com https://www.youtube-nocookie.com;
      worker-src 'self' blob:;
    `;

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: ContentSecurityPolicy.replace(/\s{2,}/g, ' ').trim() },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

const sentryWebpackPluginOptions = {
  silent: true,
};

export default withSentryConfig(nextConfig, sentryWebpackPluginOptions, {
  hideSourceMaps: true,
  disableLogger: true,
});

