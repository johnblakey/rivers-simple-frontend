/* eslint-env node */
/* global process */ // Add this if 'eslint-env node' is not fully effective for 'process' in your ESLint setup
import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// VITE_ prefixed environment variables are automatically loaded by Vite.
// For the proxy target, we use process.env.VITE_API_BASE_URL, which should be
// available in the Node.js environment where vite.config.js is executed
// (e.g., set by Docker ENV in the build stage, or from .env files during local dev).
export default defineConfig(() => {
  // The envPrefix default is 'VITE_', so explicit configuration is not needed
  // if you stick to that prefix for client-exposed variables.
  // The 'define' block is no longer needed as client-side code will
  // directly use import.meta.env.VITE_FIREBASE_... and import.meta.env.VITE_API_BASE_URL (if needed).
  return {
    server: {
      port: 5173, // Ensures Vite dev server runs on this port
      proxy: {
        '/api_proxy': {
          // Target the actual backend URL. process.env is available here as vite.config.js runs in Node.
          // VITE_API_BASE_URL will be set by Docker ENV during build, or from .env files in local dev.
          target: process.env.VITE_API_BASE_URL,
          changeOrigin: true, // Necessary for virtual hosted sites and CORS
          rewrite: (path) => path.replace(/^\/api_proxy/, ''), // Remove the /api_proxy prefix
        },
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          about: resolve(__dirname, 'public/about.html'), // Correct path to about.html
        },
      },
    },
  };
});
