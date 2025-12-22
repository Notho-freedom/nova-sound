import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? './' : '/',
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'esnext',
    minify: 'esbuild',
    cssMinify: true,
    cssCodeSplit: true,
    sourcemap: mode === 'development',
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor chunks optimisés
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'react-vendor';
            }
            if (id.includes('@radix-ui')) {
              return 'radix-ui';
            }
            if (id.includes('@tanstack')) {
              return 'tanstack';
            }
            if (id.includes('framer-motion')) {
              return 'animations';
            }
            if (id.includes('recharts') || id.includes('d3')) {
              return 'charts';
            }
            if (id.includes('firebase')) {
              return 'firebase';
            }
            // Autres dépendances
            return 'vendor';
          }
          // YouTube service séparé
          if (id.includes('/services/youtube/')) {
            return 'youtube-service';
          }
        },
        // Optimisation des noms de fichiers
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    // Avertissement si chunk trop gros
    chunkSizeWarningLimit: 500,
  },
  // Optimisations de développement
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
      'framer-motion',
    ],
    exclude: ['@vite/client'],
  },
  // Optimisations CSS
  css: {
    devSourcemap: mode === 'development',
  },
}));
