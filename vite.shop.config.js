// Build config for the CGC Darts apparel store (shop.aadsdarts.com).
// Separate entry from the wiki app: `npm run dev:shop`, `npm run build:shop`,
// `npm run deploy:shop` (publishes dist-shop to the dowdarts/cgc-shop Pages repo).
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

const r = p => fileURLToPath(new URL(p, import.meta.url))

// GitHub Pages has no SPA rewrites — serve index.html for unknown paths
// (deep links like /custom-order/<token> and /admin/orders).
const spaFallback = {
  name: 'spa-404-fallback',
  closeBundle() {
    const out = r('./dist-shop')
    fs.copyFileSync(path.join(out, 'index.html'), path.join(out, '404.html'))
  },
}

export default defineConfig({
  root: r('./shop'),
  base: '/',
  envDir: r('.'),
  publicDir: r('./shop/public'),
  plugins: [react(), tailwindcss(), spaFallback],
  resolve: { alias: { '@pricing': r('./supabase/functions/_shared/pricing.js') } },
  server: { port: 5174, fs: { allow: [r('.')] } },
  build: { outDir: r('./dist-shop'), emptyOutDir: true },
})
