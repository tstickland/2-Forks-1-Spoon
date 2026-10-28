import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg'],
      manifest: {
        name: '2 Forks 1 Spoon',
        short_name: '2 Forks 1 Spoon',
        description: 'Batch meal prep planning, runway forecasting and shared grocery lists',
        theme_color: '#15803d',
        background_color: '#f0fdf4',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Firebase Hosting serves the auth helper under /__/ — never answer it from the SPA shell.
        navigateFallbackDenylist: [/^\/__\//],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
  },
})
