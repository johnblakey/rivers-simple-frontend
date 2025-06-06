/* eslint-env node */
/* global process */ // Add this if 'eslint-env node' is not fully effective for 'process' in your ESLint setup
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load all env variables from .env files based on the current mode
  // The '' third argument loads all variables, not just VITE_ prefixed ones from process.env
  const env = loadEnv(mode, process.cwd(), '');

  return {
    // envPrefix: ['VITE_'], // You can keep this if you also use VITE_ prefixed vars
    define: {
      'import.meta.env.FIREBASE_API_KEY': JSON.stringify(env.FIREBASE_API_KEY),
      'import.meta.env.FIREBASE_AUTH_DOMAIN': JSON.stringify(env.FIREBASE_AUTH_DOMAIN),
      'import.meta.env.FIREBASE_PROJECT_ID': JSON.stringify(env.FIREBASE_PROJECT_ID),
      'import.meta.env.FIREBASE_STORAGE_BUCKET': JSON.stringify(env.FIREBASE_STORAGE_BUCKET),
      'import.meta.env.FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(env.FIREBASE_MESSAGING_SENDER_ID),
      'import.meta.env.FIREBASE_APP_ID': JSON.stringify(env.FIREBASE_APP_ID),
      'import.meta.env.API_BASE_URL': JSON.stringify(env.API_BASE_URL),
      // Add any other unprefixed env variables you need to expose here
    },
    server: {
      port: 5173, // Ensures Vite dev server runs on this port
      proxy: {
        // Proxy API requests to your production backend during development
        // When your frontend calls, for example, '/api_proxy/user/preferences',
        // Vite will forward it to 'https://api.rivers.johnblaky.org/user/preferences'
        '/api_proxy': {
          target: env.API_BASE_URL, // This will be https://api.rivers.johnblaky.org from your .env.local
          changeOrigin: true, // Necessary for virtual hosted sites and CORS
          rewrite: (path) => path.replace(/^\/api_proxy/, ''), // Remove the /api_proxy prefix
        },
      },
    },
  };
});
