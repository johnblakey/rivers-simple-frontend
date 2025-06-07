/* eslint-env node */
/* global process */ // Add this if 'eslint-env node' is not fully effective for 'process' in your ESLint setup
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load all env variables from .env files based on the current mode
  // modeEnv will get API_BASE_URL=/api_proxy from .env.development in dev mode
  const modeEnv = loadEnv(mode, process.cwd(), '');

  // Load base environment variables (from .env.local or .env)
  // This is used to get the actual target URL for the proxy
  const baseEnv = loadEnv('', process.cwd(), '');

  // Consolidate Firebase variables, giving precedence to mode-specific if they exist
  const firebaseApiKey = modeEnv.FIREBASE_API_KEY || baseEnv.FIREBASE_API_KEY;
  const firebaseAuthDomain = modeEnv.FIREBASE_AUTH_DOMAIN || baseEnv.FIREBASE_AUTH_DOMAIN;
  const firebaseProjectId = modeEnv.FIREBASE_PROJECT_ID || baseEnv.FIREBASE_PROJECT_ID;
  const firebaseStorageBucket = modeEnv.FIREBASE_STORAGE_BUCKET || baseEnv.FIREBASE_STORAGE_BUCKET;
  const firebaseMessagingSenderId = modeEnv.FIREBASE_MESSAGING_SENDER_ID || baseEnv.FIREBASE_MESSAGING_SENDER_ID;
  const firebaseAppId = modeEnv.FIREBASE_APP_ID || baseEnv.FIREBASE_APP_ID;

  return {
    // envPrefix: ['VITE_'], // You can keep this if you also use VITE_ prefixed vars
    define: {
      // Client-side API_BASE_URL will be /api_proxy in dev mode
      'import.meta.env.API_BASE_URL': JSON.stringify(modeEnv.API_BASE_URL),
      'import.meta.env.FIREBASE_API_KEY': JSON.stringify(firebaseApiKey),
      'import.meta.env.FIREBASE_AUTH_DOMAIN': JSON.stringify(firebaseAuthDomain),
      'import.meta.env.FIREBASE_PROJECT_ID': JSON.stringify(firebaseProjectId),
      'import.meta.env.FIREBASE_STORAGE_BUCKET': JSON.stringify(firebaseStorageBucket),
      'import.meta.env.FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(firebaseMessagingSenderId),
      'import.meta.env.FIREBASE_APP_ID': JSON.stringify(firebaseAppId),
    },
    server: {
      port: 5173, // Ensures Vite dev server runs on this port
      proxy: {
        '/api_proxy': {
          // Target the actual backend URL (e.g., http://127.0.0.1:5000 from .env.local)
          target: baseEnv.API_BASE_URL,
          changeOrigin: true, // Necessary for virtual hosted sites and CORS
          rewrite: (path) => path.replace(/^\/api_proxy/, ''), // Remove the /api_proxy prefix
        },
      },
    },
  };
});
