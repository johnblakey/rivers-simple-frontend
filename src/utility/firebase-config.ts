// firebase-config.ts
import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// Vite exposes VITE_ prefixed env variables from .env files or build environment
// on import.meta.env.
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// DELETE AFTER Checking TEMPORARY DEBUG: Log the API key being used by the client
console.log('DEBUG: VITE_FIREBASE_API_KEY received by client:', import.meta.env.VITE_FIREBASE_API_KEY);

// For clearer error messages, check that essential Firebase config values are present.
// Firebase SDK might throw its own errors, but this provides more direct feedback.
const essentialKeysAndCorrespondingViteVars: {key: keyof typeof firebaseConfig, viteVar: string}[] = [
    { key: 'apiKey', viteVar: 'VITE_FIREBASE_API_KEY' },
    { key: 'authDomain', viteVar: 'VITE_FIREBASE_AUTH_DOMAIN' },
    { key: 'projectId', viteVar: 'VITE_FIREBASE_PROJECT_ID' },
    { key: 'appId', viteVar: 'VITE_FIREBASE_APP_ID' },
    // Add other keys like 'storageBucket' or 'messagingSenderId' if they are
    // strictly essential for your application's core functionality.
];

const missingVars: string[] = [];
for (const item of essentialKeysAndCorrespondingViteVars) {
    if (!firebaseConfig[item.key]) {
        missingVars.push(item.viteVar);
    }
}

if (missingVars.length > 0) {
  const errorMessage = `Missing Firebase configuration for: ${missingVars.join(', ')}.
Ensure these VITE_ prefixed environment variables are set and accessible to the Vite build process
(e.g., in .env files for local development, or as ENV vars in Docker/Cloud Run).`;
  console.error(errorMessage);
  throw new Error(errorMessage);
}

// Initialize Firebase
// The firebaseConfig object might have undefined values for non-essential keys,
// which is acceptable by FirebaseOptions. Essential keys are checked above.
const app = initializeApp(firebaseConfig as FirebaseOptions);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Configure Google provider to always show account selection
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export default app;
