// auth-ui.ts
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { authService, type AuthUser } from './auth-service';

@customElement('auth-ui')
export class AuthUI extends LitElement {
  @state()
  private user: AuthUser | null = null;

  @state()
  private loading = false;

  @state()
  private error: string | null = null;

  static styles = css`
    :host {
      display: block;
      padding: 1rem;
      background: #f8f9fa;
      border-radius: 8px;
      margin-bottom: 1rem;
    }

    .auth-container {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
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
    }

    .user-name {
      font-weight: 500;
      color: #333;
    }

    .user-email {
      font-size: 0.875rem;
      color: #666;
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

    @media (max-width: 768px) {
      .auth-container {
        flex-direction: column;
        align-items: flex-start;
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();

    // Listen for auth state changes
    authService.onAuthStateChanged((user) => {
      this.user = user;
      this.loading = false;
    });
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

    try {
      await authService.signOut();
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Sign out failed';
      this.loading = false;
    }
  }

  render() {
    if (this.loading) {
      return html`
        <div class="auth-container">
          <span class="loading">Loading...</span>
        </div>
      `;
    }

    if (this.user) {
      return html`
        <div class="auth-container">
          <div class="user-info">
            ${this.user.photoURL ? html`
              <img class="user-avatar" src="${this.user.photoURL}" alt="User avatar" />
            ` : ''}
            <div>
              <div class="user-name">${this.user.displayName || 'User'}</div>
              <div class="user-email">${this.user.email}</div>
            </div>
          </div>
          <button
            class="auth-button sign-out-button"
            @click=${this.handleSignOut}
            ?disabled=${this.loading}
          >
            Sign Out
          </button>
        </div>
        ${this.error ? html`<div class="error-message">${this.error}</div>` : ''}
      `;
    }

    return html`
      <div class="auth-container">
        <div>Sign in to save your favorite rivers</div>
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
