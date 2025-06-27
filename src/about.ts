import { AuthUI } from './utility/auth-ui'; // Named import for AuthUI class

// Setup Auth UI in the header for the About page
document.addEventListener('DOMContentLoaded', () => {
  const headerAuthContainer = document.getElementById('auth-container');
  if (headerAuthContainer) {
    const authUI = new AuthUI(); // Instantiate directly using the imported class
    headerAuthContainer.innerHTML = ''; // Clear any placeholder
    headerAuthContainer.appendChild(authUI);
  } else {
    console.warn('#auth-container element not found in the about page header.');
  }
});
