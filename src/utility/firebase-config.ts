// firebase-config.ts
import { initializeApp } from 'firebase/app';
import type { FirebaseOptions } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// Define the shape of the runtime configuration object that will be injected into window
declare global {
  interface Window {
    runtimeConfig?: {
      FIREBASE_API_KEY?: string;
      FIREBASE_AUTH_DOMAIN?: string;
      FIREBASE_PROJECT_ID?: string;
      FIREBASE_STORAGE_BUCKET?: string;
      FIREBASE_MESSAGING_SENDER_ID?: string;
      FIREBASE_APP_ID?: string;
      // API_BASE_URL is handled in user-preferences-service, but could also be here
    };
  }
}

// Helper function to get config values
// Prioritizes runtime config, then Vite env vars (prefixed with VITE_), then undefined.
function getConfigValue(runtimeKey: keyof NonNullable<Window['runtimeConfig']>, viteKey: string): string | undefined {
  if (typeof window !== 'undefined' && window.runtimeConfig && window.runtimeConfig[runtimeKey]) {
    return window.runtimeConfig[runtimeKey];
  }
  // For Vite, environment variables must be prefixed with VITE_ to be exposed on import.meta.env
  // Ensure your .env.local uses VITE_FIREBASE_API_KEY etc. for local development.
  if (import.meta.env[viteKey]) {
    return import.meta.env[viteKey] as string;
  }
  return undefined;
}

// Firebase configuration mapping
const firebaseConfigMapping = {
  apiKey: { runtimeKey: 'FIREBASE_API_KEY', viteKey: 'VITE_FIREBASE_API_KEY' },
  authDomain: { runtimeKey: 'FIREBASE_AUTH_DOMAIN', viteKey: 'VITE_FIREBASE_AUTH_DOMAIN' },
  projectId: { runtimeKey: 'FIREBASE_PROJECT_ID', viteKey: 'VITE_FIREBASE_PROJECT_ID' },
  storageBucket: { runtimeKey: 'FIREBASE_STORAGE_BUCKET', viteKey: 'VITE_FIREBASE_STORAGE_BUCKET' },
  messagingSenderId: { runtimeKey: 'FIREBASE_MESSAGING_SENDER_ID', viteKey: 'VITE_FIREBASE_MESSAGING_SENDER_ID' },
  appId: { runtimeKey: 'FIREBASE_APP_ID', viteKey: 'VITE_FIREBASE_APP_ID' },
};

const firebaseConfig: Partial<FirebaseOptions> = {};
const missingConfigKeys: string[] = [];

for (const key in firebaseConfigMapping) {
  const configKeys = firebaseConfigMapping[key as keyof typeof firebaseConfigMapping];
  const value = getConfigValue(configKeys.runtimeKey as keyof NonNullable<Window['runtimeConfig']>, configKeys.viteKey);
  firebaseConfig[key as keyof FirebaseOptions] = value;
  if (!value) {
    // Log the expected environment variable name (runtimeKey is more generic here)
    missingConfigKeys.push(configKeys.runtimeKey);
  }
}

if (missingConfigKeys.length > 0) {
  const errorMessage = `Missing Firebase configuration for: ${missingConfigKeys.join(', ')}. Ensure these are set as environment variables in your Cloud Run service (or as VITE_ prefixed vars in .env.local for development).`;
  console.error(errorMessage);
  throw new Error(errorMessage);
}

// Initialize Firebase
const app = initializeApp(firebaseConfig as FirebaseOptions); // Cast as FirebaseOptions because SDK expects all keys to be present

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Configure Google provider to always show account selection
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export default app;
