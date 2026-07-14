import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiPort = env.API_PORT || '3000'
  const apiTarget = `http://localhost:${apiPort}`
  const wsTarget = `ws://localhost:${apiPort}`

  return {
    plugins: [
      react(),
      tsconfigPaths(),
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: {
          enabled: false,
        },
        manifest: {
          name: "Bárbaro's POS",
          short_name: "BárbarosPOS",
          description: "Sistema POS para discoteca Bárbaro's",
          start_url: '/',
          display: 'standalone',
          background_color: '#111827',
          theme_color: '#111827',
          orientation: 'portrait',
          icons: [
            {
              src: '/icon-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable',
            },
            {
              src: '/icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
          runtimeCaching: [
            {
              urlPattern: /^https?:\/\/.*\/api\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                expiration: { maxEntries: 50, maxAgeSeconds: 3600 },
              },
            },
          ],
        },
      }),
    ],
    server: {
      port: parseInt(env.VITE_PORT || '5173'),
      host: true,
      allowedHosts: true,
      proxy: {
        '/accounts': {
          target: apiTarget,
          changeOrigin: true,
          bypass: (req) => {
            if (req.headers.accept?.includes('text/html')) {
              return '/index.html'
            }
          },
        },
        '/products': {
          target: apiTarget,
          changeOrigin: true,
          bypass: (req) => {
            if (req.headers.accept?.includes('text/html')) {
              return '/index.html'
            }
          },
        },
        '/categories': {
          target: apiTarget,
          changeOrigin: true,
          bypass: (req) => {
            if (req.headers.accept?.includes('text/html')) {
              return '/index.html'
            }
          },
        },
        '/shifts': {
          target: apiTarget,
          changeOrigin: true,
          bypass: (req) => {
            if (req.headers.accept?.includes('text/html')) {
              return '/index.html'
            }
          },
        },
        '/shapes': { target: apiTarget, changeOrigin: true },
        '/reports': {
          target: apiTarget,
          changeOrigin: true,
          bypass: (req) => {
            if (req.headers.accept?.includes('text/html')) {
              return '/index.html'
            }
          },
        },
        '/ws': { target: wsTarget, ws: true },
        '/uploads': { target: apiTarget, changeOrigin: true },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
  }
})
