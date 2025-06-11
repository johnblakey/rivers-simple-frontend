// auth-ui.ts
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { createRef, ref, type Ref } from 'lit/directives/ref.js';
import { authService, type AuthUser } from './auth-service';

@customElement('auth-ui')
export class AuthUI extends LitElement {
  @state()
  private user: AuthUser | null = null;

  @state()
  private loading = false;

  @state()
  private error: string | null = null;

  @state()
  private showUserInfoPopup = false;

  private popupRef: Ref<HTMLDivElement> = createRef();

  static styles = css`
    :host {
      display: flex; /* Ensures the component aligns well in a flex container like the nav bar */
      align-items: center;
    }

    .auth-wrapper {
      display: flex;
      align-items: center;
      justify-content: flex-end; /* Align content to the right */
      gap: 1rem;
      flex-wrap: wrap;
      position: relative; /* For pop-up positioning */
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .user-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      object-fit: cover;
      cursor: pointer;
    }

    .user-name {
      font-weight: 500;
      color: #ffffff; /* Changed for visibility on dark nav background */
    }

    .user-email {
      font-size: 0.875rem;
      color: #e0e0e0; /* Changed for visibility on dark nav background */
    }

    .auth-button {
      background: #4285f4;
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.875rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      transition: background-color 0.2s;
    }

    .auth-button:hover {
      background: #3367d6;
    }

    .auth-button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }

    .sign-out-button {
      background: #dc3545;
    }

    .sign-out-button:hover {
      background: #c82333;
    }

    .error-message {
      color: #dc3545;
      font-size: 0.875rem;
      margin-top: 0.5rem;
    }

    .loading {
      color: #666;
      font-style: italic;
    }

    .user-popup {
      position: absolute;
      top: calc(100% + 8px); /* Position below the avatar */
      right: 0;
      background-color: #ffffff;
      color: #333333;
      border: 1px solid #ccc;
      border-radius: 4px;
      padding: 1rem;
      z-index: 100;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      min-width: 200px;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .user-popup .user-name,
    .user-popup .user-email {
      color: #333; /* Dark text for light popup background */
    }
    .user-popup .user-email {
      font-size: 0.8rem;
    }
    @media (max-width: 768px) {
      .auth-container {
        flex-direction: column;
        align-items: flex-start;
      }
    }
  `;

  private handleClickOutside = (event: MouseEvent) => {
    const path = event.composedPath();
    const popupElement = this.popupRef.value;
    const avatarElement = this.shadowRoot?.querySelector('.user-avatar');
    // More specific selector for the clickable name span when no avatar is present
    const nameTriggerElement = this.shadowRoot?.querySelector('span.user-name[style*="cursor:pointer"]');

    // If the popup isn't shown, or the click is inside the popup, do nothing.
    if (!this.showUserInfoPopup || !popupElement || path.includes(popupElement)) {
      return;
    }

    // If the click is on the avatar or the name trigger, do nothing here.
    // The click handler on those elements will toggle the popup.
    if (avatarElement && path.includes(avatarElement)) {
      return;
    }
    if (nameTriggerElement && path.includes(nameTriggerElement)) {
      return;
    }

    // If we reach here, the popup is shown and the click was outside the popup
    // AND outside the avatar/name trigger. So, close the popup.
    this.showUserInfoPopup = false;
  };

  connectedCallback() {
    super.connectedCallback();

    // Listen for auth state changes
    authService.onAuthStateChanged((user) => {
      this.user = user;
      this.loading = false;
      if (!user) { // If user signs out or was never logged in
        this.showUserInfoPopup = false; // Ensure pop-up is closed
      }
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('mousedown', this.handleClickOutside);
  }

  protected updated(changedProperties: Map<string | number | symbol, unknown>) {
    if (changedProperties.has('showUserInfoPopup')) {
      this.toggleClickOutsideListener(this.showUserInfoPopup);
    }
  }

  private async handleSignIn() {
    this.loading = true;
    this.error = null;

    try {
      await authService.signInWithGoogle();
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Sign in failed';
      this.loading = false;
    }
  }

  private async handleSignOut() {
    this.loading = true;
    this.error = null;
    this.showUserInfoPopup = false; // Close pop-up immediately on initiating sign-out

    try {
      await authService.signOut();
      // onAuthStateChanged will set user to null and loading to false.
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Sign out failed';
      // Ensure loading is false on error, as onAuthStateChanged might not fire
      // or might fire before this catch block in some scenarios.
      this.loading = false;
    }
  }

  private toggleUserInfoPopup() {
    this.showUserInfoPopup = !this.showUserInfoPopup;
  }

  private toggleClickOutsideListener(enable: boolean) {
    if (enable) {
      document.addEventListener('mousedown', this.handleClickOutside);
    } else {
      document.removeEventListener('mousedown', this.handleClickOutside);
    }
  }

  render() {
    // Show loading only if not already displaying user info (i.e., user is null)
    if (this.loading && !this.user) {
      return html`
        <div class="auth-wrapper">
          <span class="loading">Loading...</span>
        </div>
      `;
    }

    if (this.user) {
      const tooltipText = `${this.user.displayName || 'User'}\n${this.user.email || '(No email provided)'}`;
      return html`
        <div class="auth-wrapper">
          ${this.user.photoURL ? html`
            <img
              class="user-avatar"
              src="${this.user.photoURL}"
              alt="User avatar"
              title="${tooltipText}"
              @click=${this.toggleUserInfoPopup}
              @keydown=${(e: KeyboardEvent) => e.key === 'Enter' || e.key === ' ' ? this.toggleUserInfoPopup() : null}
              tabindex="0"
              role="button"
              aria-haspopup="true"
              aria-expanded="${this.showUserInfoPopup}"
              aria-label="User menu"
            />
          ` : html`
            <span
              @click=${this.toggleUserInfoPopup}
              @keydown=${(e: KeyboardEvent) => e.key === 'Enter' || e.key === ' ' ? this.toggleUserInfoPopup() : null}
              class="user-name"
              style="cursor:pointer;"
              title="${tooltipText}"
              tabindex="0"
              role="button"
              aria-haspopup="true"
              aria-expanded="${this.showUserInfoPopup}"
              aria-label="User menu"
            >${this.user.displayName || 'User'}</span>
          `}

          ${this.showUserInfoPopup ? html`
            <div class="user-popup" ${ref(this.popupRef)} role="menu">
              <div class="user-info">
                <div>
                  <div class="user-name">${this.user.displayName || 'User'}</div>
                  <div class="user-email">${this.user.email}</div>
                </div>
              </div>
              <button
                class="auth-button sign-out-button"
                @click=${this.handleSignOut}
                ?disabled=${this.loading} /* Disable while any auth operation is in progress */
                role="menuitem"
              >
                Sign Out
              </button>
            </div>
          ` : ''}
        </div>
        ${this.error ? html`<div class="error-message">${this.error}</div>` : ''}
      `;
    }

    return html`
      <div class="auth-wrapper">
        <button
          class="auth-button"
          @click=${this.handleSignIn}
          ?disabled=${this.loading}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google
        </button>
      </div>
      ${this.error ? html`<div class="error-message">${this.error}</div>` : ''}
    `;
  }
}
