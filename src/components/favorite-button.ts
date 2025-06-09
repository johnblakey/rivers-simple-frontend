// favorite-button.ts
import { LitElement, html, css } from 'lit';
import { createRef, ref } from 'lit/directives/ref.js';
import type { Ref } from 'lit/directives/ref.js';
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

  private popoverRef: Ref<HTMLDivElement> = createRef();

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

    .signin-prompt-popup {
      position: absolute;
      background-color: #ffffff;
      color: #333333;
      padding: 1rem;
      border-radius: 4px;
      z-index: 10;
      bottom: 100%; /* Position above the button */
      left: 50%;
      transform: translateX(-50%) translateY(-0.5rem); /* Center and add some space */
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      min-width: 240px;
      text-align: center;
    }

    .signin-prompt-popup p {
      margin: 0 0 0.75rem 0;
      font-size: 0.9rem;
      color: #555555;
    }

    .signin-prompt-popup .google-signin-button {
      background: #4285f4;
      color: white;
      border: none;
      padding: 0.6rem 1rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.875rem;
      display: inline-flex;
      align-items: center;
      gap: 0.6rem; /* Increased gap slightly */
      transition: background-color 0.2s;
      line-height: 1; /* Ensure consistent button height */
    }

    .signin-prompt-popup .google-signin-button:hover {
      background: #3367d6;
    }

    .signin-prompt-popup .google-signin-button svg {
      width: 18px;
      height: 18px;
    }

    /* Optional: Style for the text within the button if needed */
    .signin-prompt-popup .google-signin-button span {
      display: inline-block;
      vertical-align: middle;
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

  private handleClickOutside = (event: MouseEvent) => {
    const path = event.composedPath();
    if (
      this.showSignInPromptPopover &&
      this.popoverRef.value &&
      !path.includes(this.popoverRef.value) &&
      !path.includes(this)
    ) {
      this.showSignInPromptPopover = false;
    }
  };

  private adjustPopoverPosition() {
    if (!this.showSignInPromptPopover || !this.popoverRef.value) {
      return;
    }

    const popover = this.popoverRef.value;

    requestAnimationFrame(() => {
      if (!this.popoverRef.value || !this.showSignInPromptPopover) return;

      const popoverRect = popover.getBoundingClientRect();
      const windowWidth = window.innerWidth;
      const PADDING = 8; // Minimum space from viewport edge

      let shiftPixels = 0;

      // Check right edge
      if (popoverRect.right > windowWidth - PADDING) {
        shiftPixels = (windowWidth - PADDING) - popoverRect.right; // Negative value to shift left
      }
      // Check left edge
      else if (popoverRect.left < PADDING) {
        shiftPixels = PADDING - popoverRect.left; // Positive value to shift right
      }

      if (shiftPixels !== 0) {
        popover.style.transform = `translateX(calc(-50% + ${shiftPixels}px)) translateY(-0.5rem)`;
      } else {
        // Ensure it's at the default centered position if no adjustment is needed
        popover.style.transform = 'translateX(-50%) translateY(-0.5rem)';
      }
    });
  }


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

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('mousedown', this.handleClickOutside);
  }

  protected updated(changedProperties: Map<string | number | symbol, unknown>) {
    if (changedProperties.has('showSignInPromptPopover')) {
      if (this.showSignInPromptPopover) {
        document.addEventListener('mousedown', this.handleClickOutside);
        this.adjustPopoverPosition();
      } else {
        document.removeEventListener('mousedown', this.handleClickOutside);
        if (this.popoverRef.value) {
          this.popoverRef.value.style.transform = ''; // Reset inline style, CSS default will apply
        }
      }
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
      return;
    }

    if (this.isLoading) return;

    this.isLoading = true;
    const originalIsFavorite = this.isFavorite; // Store original state
    try {
      if (this.isFavorite) {
        await userPreferencesService.removeFavoriteRiver(this.siteCode);
        this.isFavorite = false;
      } else {
        await userPreferencesService.addFavoriteRiver(this.siteCode);
        this.isFavorite = true;
      }
      // Dispatch event if the state actually changed successfully
      if (originalIsFavorite !== this.isFavorite) {
        this.dispatchEvent(new CustomEvent('favorite-changed', {
          bubbles: true, // Allow event to bubble up the DOM tree
          composed: true // Allow event to cross shadow DOM boundaries
        }));
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      this.isFavorite = originalIsFavorite; // Revert optimistic update on error
    } finally {
      this.isLoading = false;
    }
  }

  private async handleSignInViaPopup() {
    this.showSignInPromptPopover = false; // Hide pop-up first
    try {
      await authService.signInWithGoogle();
      // The authService.onAuthStateChanged listener in connectedCallback
      // will handle UI updates once sign-in completes.
    } catch (error) {
      console.error("Sign-in attempt from favorite button pop-up failed:", error);
      // Optionally, you could show a temporary error message here or rely on a global error handler
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
    // If there's no siteCode, don't render the button at all.
    if (!this.siteCode) {
      return html``;
    }

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
        <div class="signin-prompt-popup" ${ref(this.popoverRef)}>
          <p>Sign in to save your favorite rivers</p>
          <button class="google-signin-button" @click=${this.handleSignInViaPopup}>
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span>Sign in with Google</span>
          </button>
        </div>
      ` : ''}
    `;
  }
}
