import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base './' so the build also works from file:// inside the packaged Electron app.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
