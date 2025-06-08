// auth-service.ts
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
  getIdToken
} from 'firebase/auth';
import { auth, googleProvider } from './firebase-config';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

class AuthService {
  private currentUser: User | null = null;
  private authListeners: ((user: AuthUser | null) => void)[] = [];

  constructor() {
    // Listen for authentication state changes
    onAuthStateChanged(auth, (user) => {
      this.currentUser = user;
      const authUser = user ? this.mapFirebaseUser(user) : null;

      // Notify all listeners
      this.authListeners.forEach(callback => callback(authUser));
    });
  }

  private mapFirebaseUser(user: User): AuthUser {
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL
    };
  }

  async signInWithGoogle(): Promise<AuthUser> {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return this.mapFirebaseUser(result.user);
    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  }

  async signOut(): Promise<void> {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }

  getCurrentUser(): AuthUser | null {
    return this.currentUser ? this.mapFirebaseUser(this.currentUser) : null;
  }

  async getIdToken(): Promise<string | null> {
    if (!this.currentUser) {
      return null;
    }

    try {
      return await getIdToken(this.currentUser);
    } catch (error) {
      console.error('Error getting ID token:', error);
      return null;
    }
  }

  onAuthStateChanged(callback: (user: AuthUser | null) => void): () => void {
    this.authListeners.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.authListeners.indexOf(callback);
      if (index > -1) {
        this.authListeners.splice(index, 1);
      }
    };
  }

  isSignedIn(): boolean {
    return this.currentUser !== null;
  }
}

// Export singleton instance
export const authService = new AuthService();
