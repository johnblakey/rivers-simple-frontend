// user-preferences-service.ts
import { authService } from './auth-service';

export interface UserPreferences {
  favoriteRivers: string[];
  userId: string;
  userEmail: string;
}

export interface UserNote {
  note: string;
  siteCode: string;
  userId?: string;
  userEmail?: string;
  createdAt?: string; // ISO Date string
  updatedAt?: string; // ISO Date string
}

class UserPreferencesService {
  private baseUrl: string;

  constructor() {
    const apiUrl = import.meta.env.VITE_API_BASE_URL;
    if (!apiUrl) {
      const errorMessage = `Missing API base URL.
Ensure the VITE_API_BASE_URL environment variable is set and accessible to the Vite build process
(e.g., in .env files for local development, or as an ENV var in Docker during the build stage).`;
      console.error(errorMessage);
      // Throwing an error here will stop the service from being initialized with an invalid state.
      throw new Error(errorMessage);
    }
    this.baseUrl = apiUrl;
  }

  private async makeAuthenticatedRequest(url: string, options: RequestInit = {}): Promise<Response> {
    const token = await authService.getIdToken();

    if (!token) {
      throw new Error('User not authenticated');
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    };

    return fetch(url, {
      ...options,
      headers
    });
  }

  async getUserPreferences(): Promise<UserPreferences | null> {
    try {
      const response = await this.makeAuthenticatedRequest(`${this.baseUrl}/user/preferences`);

      if (response.status === 404) {
        // User preferences don't exist yet
        return null;
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch user preferences: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching user preferences:', error);
      throw error;
    }
  }

  async addFavoriteRiver(siteCode: string): Promise<void> {
    try {
      const response = await this.makeAuthenticatedRequest(
        `${this.baseUrl}/user/preferences/favorites`,
        {
          method: 'POST',
          body: JSON.stringify({ siteCode })
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to add favorite river: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error adding favorite river:', error);
      throw error;
    }
  }

  async removeFavoriteRiver(siteCode: string): Promise<void> {
    try {
      const response = await this.makeAuthenticatedRequest(
        `${this.baseUrl}/user/preferences/favorites`,
        {
          method: 'DELETE',
          body: JSON.stringify({ siteCode })
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to remove favorite river: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error removing favorite river:', error);
      throw error;
    }
  }

  async isFavoriteRiver(siteCode: string): Promise<boolean> {
    try {
      const preferences = await this.getUserPreferences();
      return preferences?.favoriteRivers.includes(siteCode) || false;
    } catch (error) {
      console.error('Error checking if river is favorite:', error);
      return false;
    }
  }

  async getUserNote(siteCode: string): Promise<UserNote | null> {
    try {
      const response = await this.makeAuthenticatedRequest(`${this.baseUrl}/user/notes/${siteCode}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch user note: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      // Don't re-throw auth errors, just return null.
      if (error instanceof Error && error.message.includes('authenticated')) {
        return null;
      }
      console.error(`Error fetching user note for site ${siteCode}:`, error);
      throw error; // Re-throw other errors
    }
  }

  async saveUserNote(siteCode: string, note: string): Promise<void> {
    try {
      const response = await this.makeAuthenticatedRequest(
        `${this.baseUrl}/user/notes/${siteCode}`,
        {
          method: 'POST', // Backend handles POST as an upsert
          body: JSON.stringify({ note })
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to save user note: ${response.statusText}`);
      }
    } catch (error) {
      console.error(`Error saving user note for site ${siteCode}:`, error);
      throw error;
    }
  }

  async deleteUserNote(siteCode: string): Promise<void> {
    try {
      const response = await this.makeAuthenticatedRequest(
        `${this.baseUrl}/user/notes/${siteCode}`,
        {
          method: 'DELETE'
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to delete user note: ${response.statusText}`);
      }
    } catch (error) {
      console.error(`Error deleting user note for site ${siteCode}:`, error);
      throw error;
    }
  }

  async getAllUserNotes(): Promise<UserNote[]> {
    try {
      const response = await this.makeAuthenticatedRequest(`${this.baseUrl}/user/notes`);
      if (!response.ok) {
        throw new Error(`Failed to fetch all user notes: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      // Don't re-throw auth errors, just return empty array.
      if (error instanceof Error && error.message.includes('authenticated')) {
        return [];
      }
      console.error('Error fetching all user notes:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const userPreferencesService = new UserPreferencesService();
