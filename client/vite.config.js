import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
const disablePwa = String(globalThis.process?.env?.VITE_PWA_DISABLED || '').toLowerCase() === 'true'
const apiProxyTarget = globalThis.process?.env?.VITE_API_PROXY_TARGET || 'http://localhost:3000'

const backendProxy = {
  target: apiProxyTarget,
  changeOrigin: true,
  secure: false,
  ws: true,
}

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      disable: disablePwa,
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      includeAssets: ['ExpertsHub-favicon.svg', 'apple-touch-icon-180x180.png', 'offline.html'],
      manifest: {
        name: 'ExpertsHub',
        short_name: 'ExpertsHub',
        description: 'ExpertsHub - AI-Powered Local Services Marketplace',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#7c3aed',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      devOptions: {
        enabled: true,
      },
    })
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': backendProxy,
      '/uploads': backendProxy,
      '/health': backendProxy,
    },
    // Reduce CPU usage
    hmr: {
      overlay: false, // Disable error overlay to reduce rendering
    },
    watch: {
      // Reduce file watching load
      usePolling: false,
      ignored: ['**/node_modules/**', '**/.git/**'],
    },
  },
  build: {
    sourcemap: false,
    minify: 'esbuild',
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('socket.io-client') || id.includes('engine.io-client')) {
            return 'socket-vendor';
          }

          if (id.includes('framer-motion')) {
            return 'motion-vendor';
          }

          if (id.includes('recharts') || id.includes('d3-')) {
            return 'charts-vendor';
          }

          if (id.includes('leaflet')) {
            return 'maps-vendor';
          }
        },
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'framer-motion', 'lucide-react', 'axios'],
  },
})
