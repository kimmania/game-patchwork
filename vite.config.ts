import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/game-patchwork/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Patchwork',
        short_name: 'Patchwork',
        description: 'Manipulate real-world topologies to solve routing, integrity, and optimization puzzles.',
        theme_color: '#1a2e1a',
        background_color: '#0f1a0f',
        display: 'standalone',
        orientation: 'any',
        scope: '/game-patchwork/',
        start_url: '/game-patchwork/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,json}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024
      }
    })
  ]
});
