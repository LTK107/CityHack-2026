import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * In development the browser talks to Vite only, and Vite forwards /api and
 * /health to the Express server. That keeps the frontend origin-agnostic: the
 * app always fetches relative paths, so there is no API host baked into the
 * code and CORS never enters the picture locally.
 *
 * For a deployed build, set VITE_API_BASE to the public API origin instead.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.API_PROXY_TARGET || 'http://localhost:4000';

  return {
    plugins: [react()],
    server: {
      // strictPort: the API's CORS allowlist names this exact port, so failing
      // loudly beats silently sliding to 5174 and getting opaque errors later.
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': { target, changeOrigin: true },
        '/health': { target, changeOrigin: true },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
  };
});
