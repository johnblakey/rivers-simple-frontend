// user-preferences-service.ts
import { authService } from './auth-service';

export interface UserPreferences {
  favoriteRivers: string[];
  userId: string;
  userEmail: string;
}

class UserPreferencesService {
  private baseUrl: string;

  constructor() {
    // Use environment variable for API base URL
    this.baseUrl = import.meta.env.API_BASE_URL || 'http://localhost:8080';
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
}

// Export singleton instance
export const userPreferencesService = new UserPreferencesService();
