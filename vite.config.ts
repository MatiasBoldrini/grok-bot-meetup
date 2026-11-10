import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { lumaWall } from './server/vite-luma.js'

export default defineConfig({
  plugins: [vue(), tailwindcss(), lumaWall()],
  // Le port est ici et pas seulement dans `.claude/launch.json` : c'est celui que
  // le README annonce, il doit donc valoir pour un `pnpm dev` nu.
  server: {
    port: 5190,
    host: '127.0.0.1',
    strictPort: true
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  }
})
