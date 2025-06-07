// favorite-button.ts
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { authService } from '../utility/auth-service';
import { userPreferencesService } from '../utility/user-preferences-service';

@customElement('favorite-button')
export class FavoriteButton extends LitElement {
  @property({ type: String })
  siteCode = '';

  @property({ type: String })
  riverName = '';

  @state()
  private isFavorite = false;

  @state()
  private isLoading = false;

  @state()
  private isSignedIn = false;

  @state()
  private showSignInPromptPopover = false;

  static styles = css`
    :host {
      display: inline-block;
      position: relative; /* For popover positioning */
    }

    .favorite-button {
      background: none;
      border: none;
      cursor: pointer;
      padding: 0.5rem;
      border-radius: 4px;
      display: flex;
      align-items: center;
      gap: 0.25rem;
      transition: background-color 0.2s;
      font-size: 0.875rem;
    }

    .favorite-button:hover {
      background-color: rgba(0, 0, 0, 0.05);
    }

    .favorite-button.disabled-look:not(:disabled) { /* Style for when not signed in but clickable */
      cursor: not-allowed;
      opacity: 0.6;
    }

    .heart-icon {
      width: 18px;
      height: 18px;
      transition: all 0.2s;
    }

    .heart-filled {
      color: #e74c3c;
    }

    .heart-empty {
      color: #95a5a6;
    }

    .popover {
      position: absolute;
      background-color: #333;
      color: white;
      padding: 0.5rem 0.75rem;
      border-radius: 4px;
      font-size: 0.75rem;
      z-index: 10;
      bottom: 100%; /* Position above the button */
      left: 50%;
      transform: translateX(-50%) translateY(-0.5rem); /* Center and add some space */
      white-space: nowrap;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    }
    .popover::after { /* Arrow for the popover */
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      margin-left: -5px; /* Half of border-width */
      border-width: 5px;
      border-style: solid;
      border-color: #333 transparent transparent transparent;
    }

    @media (max-width: 768px) {
      .favorite-button {
        padding: 0.25rem;
      }

      .heart-icon {
        width: 16px;
        height: 16px;
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();

    // Listen for auth state changes
    authService.onAuthStateChanged((user) => {
      this.isSignedIn = !!user;
      if (user && this.siteCode) {
        this.checkIfFavorite();
      } else {
        this.isFavorite = false;
      }
    });

    // Initial check if already signed in
    if (authService.isSignedIn() && this.siteCode) {
      this.isSignedIn = true;
      this.checkIfFavorite();
    }
  }

  private async checkIfFavorite() {
    if (!this.siteCode || !this.isSignedIn) return;

    try {
      this.isFavorite = await userPreferencesService.isFavoriteRiver(this.siteCode);
    } catch (error) {
      console.error('Error checking favorite status:', error);
    }
  }

  private async toggleFavorite() {
    if (!this.siteCode) return;

    if (!this.isSignedIn) {
      this.showSignInPromptPopover = true;
      // Auto-hide popover after a few seconds
      setTimeout(() => {
        this.showSignInPromptPopover = false;
      }, 3000);
      return;
    }

    if (this.isLoading) return;

    this.isLoading = true;
    try {
      if (this.isFavorite) {
        await userPreferencesService.removeFavoriteRiver(this.siteCode);
        this.isFavorite = false;
      } else {
        await userPreferencesService.addFavoriteRiver(this.siteCode);
        this.isFavorite = true;
        // Dispatch a custom event to notify that favorites might have changed
        this.dispatchEvent(new CustomEvent('favorite-changed', {
          bubbles: true, // Allow event to bubble up the DOM tree
          composed: true // Allow event to cross shadow DOM boundaries
        }));
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      // Optionally show user-friendly error message
    } finally {
      this.isLoading = false;
    }
  }

  private renderHeartIcon() {
    const iconClass = this.isFavorite ? 'heart-filled' : 'heart-empty';

    if (this.isFavorite) {
      // Filled heart
      return html`
        <svg class="heart-icon ${iconClass}" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg>
      `;
    } else {
      // Empty heart
      return html`
        <svg class="heart-icon ${iconClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
      `;
    }
  }

  render() {
    const buttonTitle = this.isFavorite
      ? `Remove ${this.riverName || 'river'} from favorites`
      : `Add ${this.riverName || 'river'} to favorites`;

    // Apply 'disabled-look' class if user is not signed in
    const buttonClasses = `favorite-button ${!this.isSignedIn ? 'disabled-look' : ''}`;

    return html`
      <button
        class="${buttonClasses}"
        title="${buttonTitle}"
        @click=${this.toggleFavorite}
        ?disabled=${this.isLoading && this.isSignedIn}
      >
        ${this.renderHeartIcon()}
        ${this.isLoading && this.isSignedIn ? 'Loading...' : ''}
      </button>
      ${this.showSignInPromptPopover && !this.isSignedIn ? html`
        <div class="popover">
          Sign in to save favorites
        </div>
      ` : ''}
    `;
  }
}
