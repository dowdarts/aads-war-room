// Build config for the CGC Darts apparel store (shop.aadsdarts.com).
// Separate entry from the wiki app: `npm run dev:shop`, `npm run build:shop`.
// Hosted on Cloudflare Pages (`npm run deploy:shop`, config in wrangler.jsonc).
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

const r = p => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  root: r('./shop'),
  base: '/',
  envDir: r('.'),
  publicDir: r('./shop/public'),
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@pricing': r('./supabase/functions/_shared/pricing.js') } },
  server: { port: 5174, fs: { allow: [r('.')] } },
  build: { outDir: r('./dist-shop'), emptyOutDir: true },
})
