import { getRiverDetails } from './utility/data';
import type { RiverDetail } from './utility/data';
import { RiverLevelChart } from './components/river-level-chart';
import { slugify } from './utility/string-utils';
import './utility/auth-ui'; // Import the auth UI component
import { authService } from './utility/auth-service';

console.info("Welcome to the rivers.johnblakey.org. Email me at johnblakeyorg@gmail.com if you find any bugs, security issues, or have feedback. Blunt tone welcome.");

let currentSortOrder: 'alphabetical' | 'runnable' | 'favorites' = 'alphabetical';
let allRiverDetails: RiverDetail[] = [];
let chartsContainer: HTMLDivElement | null = null;
let sortButton: HTMLButtonElement | null = null;
let authContainer: HTMLDivElement | null = null;

async function initializeApp() {
  const appHost = document.getElementById('charts-host');
  if (!appHost) {
    console.error('Application host element (#charts-host) not found');
    document.body.textContent = 'Error: Application host element not found';
    return;
  }

  appHost.innerHTML = '';

  // Create auth container and add auth UI
  authContainer = document.createElement('div');
  authContainer.id = 'auth-container';
  const authUI = document.createElement('auth-ui');
  authContainer.appendChild(authUI);
  appHost.appendChild(authContainer);

  // Setup sort button
  sortButton = document.getElementById('sort-toggle') as HTMLButtonElement;
  if (sortButton) {
    updateSortButtonText();
    sortButton.addEventListener('click', toggleSort);
  }

  // Create charts container
  chartsContainer = document.createElement('div');
  appHost.appendChild(chartsContainer);

  try {
    allRiverDetails = await getRiverDetails();
    if (!allRiverDetails?.length) {
      chartsContainer.textContent = 'No river details found.';
      return;
    }
    renderCharts();
  } catch (error) {
    console.error("Failed to initialize:", error);
    chartsContainer.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
  }

  // Listen for auth state changes to update sorting options
  authService.onAuthStateChanged((user) => {
    updateSortButtonText();
    if (currentSortOrder === 'favorites' && !user) {
      // If user signs out while on favorites sort, switch to alphabetical
      currentSortOrder = 'alphabetical';
      updateSortButtonText();
      applySorting();
    }
  });
}

function toggleSort() {
  const isSignedIn = authService.isSignedIn();

  if (currentSortOrder === 'alphabetical') {
    currentSortOrder = 'runnable';
  } else if (currentSortOrder === 'runnable') {
    currentSortOrder = isSignedIn ? 'favorites' : 'alphabetical';
  } else if (currentSortOrder === 'favorites') {
    currentSortOrder = 'alphabetical';
  }

  updateSortButtonText();

  // Clear the URL hash when toggling sort modes
  history.replaceState(null, "", window.location.pathname);

  applySorting();
}

function updateSortButtonText() {
  if (sortButton) {
    let buttonText = '';
    switch (currentSortOrder) {
      case 'alphabetical':
        buttonText = 'Sort by: Alphabetical';
        break;
      case 'runnable':
        buttonText = 'Sort by: Runnable';
        break;
      case 'favorites':
        buttonText = 'Sort by: Favorites';
        break;
    }

    sortButton.textContent = buttonText;
    sortButton.setAttribute('data-sort', currentSortOrder);
  }
}

function renderCharts() {
  if (!chartsContainer) return;

  chartsContainer.innerHTML = '';

  // Create all chart elements
  for (const detail of allRiverDetails) {
    if (!detail.siteName?.trim()) {
      console.warn(`Skipping river with missing siteName:`, detail);
      continue;
    }

    const chartElement = new RiverLevelChart();
    chartElement.siteCode = detail.siteCode;
    chartElement.riverDetail = detail;
    chartsContainer.appendChild(chartElement);
  }

  // Apply initial sorting
  applySorting();
}

async function applySorting() {
  if (!chartsContainer) return;

  const chartElements = Array.from(chartsContainer.children).filter(
    (el): el is RiverLevelChart => el instanceof RiverLevelChart
  );

  // Sort elements
  if (currentSortOrder === 'alphabetical') {
    chartElements.sort((a, b) => {
      return a.displayName.toLowerCase().localeCompare(b.displayName.toLowerCase());
    });
  } else if (currentSortOrder === 'runnable') {
    chartElements.sort((a, b) => {
      const statusDiff = a.sortKeyRunnable - b.sortKeyRunnable;
      if (statusDiff !== 0) return statusDiff;
      // Tie-breaker: alphabetical
      return a.displayName.toLowerCase().localeCompare(b.displayName.toLowerCase());
    });
  } else if (currentSortOrder === 'favorites') {
    // For favorites sorting, we need to check which rivers are favorites
    // This is async, so we'll handle it differently
    await sortByFavorites(chartElements);
  }

  // Re-append in sorted order (only if not favorites sorting, which handles its own reordering)
  if (currentSortOrder !== 'favorites') {
    chartElements.forEach(el => chartsContainer!.appendChild(el));
  }

  // Rebuild all charts after DOM reordering (Chart.js doesn't handle moves well)
  setTimeout(() => {
    chartElements.forEach(el => el.rebuildChart());
  }, 50);

  // Handle hash scrolling
  handleHashScroll();
}

async function sortByFavorites(chartElements: RiverLevelChart[]) {
  if (!authService.isSignedIn()) {
    return;
  }

  try {
    // We'll need to import the user preferences service
    const { userPreferencesService } = await import('./utility/user-preferences-service');
    const preferences = await userPreferencesService.getUserPreferences();
    const favoriteRivers = preferences?.favoriteRivers || [];

    chartElements.sort((a, b) => {
      const aIsFavorite = favoriteRivers.includes(a.siteCode);
      const bIsFavorite = favoriteRivers.includes(b.siteCode);

      if (aIsFavorite && !bIsFavorite) return -1;
      if (!aIsFavorite && bIsFavorite) return 1;

      // If both are favorites or both are not favorites, sort alphabetically
      return a.displayName.toLowerCase().localeCompare(b.displayName.toLowerCase());
    });

    // Re-append in sorted order
    chartElements.forEach(el => chartsContainer!.appendChild(el));
  } catch (error) {
    console.error('Error sorting by favorites:', error);
    // Fall back to alphabetical sorting
    chartElements.sort((a, b) => {
      return a.displayName.toLowerCase().localeCompare(b.displayName.toLowerCase());
    });
    chartElements.forEach(el => chartsContainer!.appendChild(el));
  }
}

function handleHashScroll() {
  const hash = window.location.hash.substring(1);
  if (!hash) return;

  const chartElements = Array.from(chartsContainer!.children) as RiverLevelChart[];
  const targetElement = chartElements.find(el => slugify(el.displayName) === hash);

  if (targetElement) {
    // Delay to ensure charts are rebuilt and DOM is ready
    setTimeout(() => {
      targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  }
}

initializeApp();
