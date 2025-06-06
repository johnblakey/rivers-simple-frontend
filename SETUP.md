# Authentication Setup Guide

This guide will help you set up Google authentication for your Rivers app.

## Prerequisites

1. Google Cloud Project with Firebase enabled
2. Your existing Cloud Run services running

## Step 1: Firebase Project Setup

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select your existing Google Cloud project
   1. Selected project river-level-0
3. Enable Authentication and configure Google as a sign-in provider:
   - Go to Firebase Console > All Products > Authentication > Get Started > Sign-in method > Get
   - Enable Google provider
     - Enabled Google
   - Add your domain (rivers.johnblakey.org) to authorized domains
     - Authentication > Settings > Authorized domains > Add domain > rivers.johnblakey.org > Save

## Step 2: Get Firebase Configuration

1. In Firebase Console, go to > river-level-0 > Project Overview > Gear > Project Settings > General
2. Scroll down to "Your apps" and click "Add app" > Web app </>
3. Register your app with a name (e.g., "Rivers Simple Frontend") > Register app
4. Copy the Firebase configuration object

## Step 3: Frontend Setup

1. **Install Firebase dependency:**
   ```bash
   npm install firebase@^10.12.0
   ```

2. **Create environment file:**
   - Copy `.env.example` to `.env.local`
   - Fill in your Firebase configuration values:
   ```bash
   VITE_FIREBASE_API_KEY=your-api-key
   VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   VITE_FIREBASE_APP_ID=your-app-id
   VITE_API_BASE_URL=https://your-backend-service-url.run.app
   ```

3. **Add the new TypeScript files to your project:**
   - `firebase-config.ts`
   - `auth-service.ts`
   - `user-preferences-service.ts`
   - `auth-ui.ts`
   - `favorite-button.ts`

4. **Update your main.ts file** with the provided version

5. **Add the auth UI to your HTML:**
   ```html
   <!-- Add this where you want the auth UI to appear -->
   <div id="charts-host"></div>
   ```

## Step 4: Backend Setup

1. **Install Firebase Admin SDK:**
   ```bash
   pip install firebase-admin>=6.0.0
   ```

2. **Set up service account:**
   - In Google Cloud Console, go to IAM & Admin > Service Accounts
   - Create a new service account or use existing one
   - Download the JSON key file
   - Set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable to point to this file

3. **Add environment variable:**
   ```bash
   USER_PREFERENCES_KIND=userPreferences
   ```

4. **Update your Flask app** with the provided version

## Step 5: Cloud Run Deployment

### Frontend Deployment
1. **Update your Dockerfile** to copy the `.env.local` file if needed
2. **Set environment variables** in Cloud Run service:
   - All the `VITE_*` variables from your `.env.local`

### Backend Deployment
1. **Update requirements.txt** with the new Firebase dependency
2. **Set Cloud Run environment variables:**
   - `USER_PREFERENCES_KIND=userPreferences`
   - Ensure `GOOGLE_APPLICATION_CREDENTIALS` points to your service account key
   - Or better yet, use Cloud Run's built-in service account authentication

## Step 6: Using Favorite Button in River Charts

In your `RiverLevelChart` component, you can add the favorite button:

```typescript
// In your river-level-chart.ts file
import './favorite-button';

// In your render method or template
const favoriteButton = document.createElement('favorite-button');
favoriteButton.siteCode = this.siteCode;
favoriteButton.riverName = this.displayName;
// Append to your chart header or wherever appropriate
```

## Step 7: Testing

1. **Local Development:**
   ```bash
   # Frontend
   npm run dev

   # Backend
   python app.py
   ```

2. **Test the flow:**
   - Visit your app
   - Click "Sign in with Google"
   - Try adding/removing favorites
   - Test the "Sort by Favorites" option

## Troubleshooting

### Common Issues

1. **Firebase configuration errors:**
   - Ensure all environment variables are set correctly
   - Check that your domain is added to Firebase authorized domains

2. **CORS issues:**
   - Make sure your backend CORS configuration includes your frontend domain
   - For development, ensure CORS allows your local development server

3. **Authentication token errors:**
   - Check that Firebase Admin SDK is properly initialized
   - Ensure service account has proper permissions

4. **Datastore permissions:**
   - Ensure your Cloud Run service account has Datastore access
   - Check that the `USER_PREFERENCES_KIND` environment variable is set

### Security Notes

- Never commit `.env.local` or service account keys to version control
- Use Cloud Run's built-in service accounts instead of JSON key files when possible
- Consider setting up IAM conditions to limit Datastore access to specific kinds

## Production Considerations

1. **Environment Variables:** Use Cloud Run's environment variables instead of `.env` files
2. **Service Accounts:** Use workload identity or Cloud Run's default service account
3. **Monitoring:** Add logging for authentication events
4. **Rate Limiting:** Consider adding rate limiting to prevent abuse
5. **Data Backup:** Set up automated backups for your Datastore data
