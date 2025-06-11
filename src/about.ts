import './utility/auth-ui'; // Import the auth UI component

// Setup Auth UI in the header for the About page
document.addEventListener('DOMContentLoaded', () => {
  const headerAuthContainer = document.getElementById('auth-container');
  if (headerAuthContainer) {
    const authUI = document.createElement('auth-ui');
    headerAuthContainer.innerHTML = ''; // Clear any placeholder
    headerAuthContainer.appendChild(authUI);
  } else {
    console.warn('#auth-container element not found in the about page header.');
  }
});
