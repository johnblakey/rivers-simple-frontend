import { getRiverDetails } from './utility/data';
import type { RiverDetail } from './utility/data';
import { RiverLevelChart } from './components/river-level-chart';
import { slugify } from './utility/string-utils';
import { FavoriteButton } from './components/firebase-button.ts'; // Import FavoriteButton
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

  for (const detail of allRiverDetails) {
    if (!detail.siteName?.trim()) {
      console.warn(`Skipping river with missing siteName:`, detail);
      continue;
    }

    const chartWrapper = document.createElement('div');
    chartWrapper.className = 'chart-with-favorite-wrapper'; // Wrapper for chart and button
    // Set an ID on the wrapper if needed for direct targeting, e.g., for hash scrolling
    chartWrapper.id = `wrapper-${slugify(detail.siteName)}`;

    const chartElement = new RiverLevelChart();
    chartElement.siteCode = detail.siteCode;
    chartElement.riverDetail = detail;

    const favoriteButton = document.createElement('favorite-button') as FavoriteButton;
    favoriteButton.siteCode = detail.siteCode;
    favoriteButton.riverName = detail.siteName;

    chartWrapper.appendChild(favoriteButton); // Add button to wrapper
    chartWrapper.appendChild(chartElement); // Add chart to wrapper
    chartsContainer.appendChild(chartWrapper); // Add wrapper to container
  }

  // Apply initial sorting
  applySorting();
}

async function applySorting() {
  if (!chartsContainer) return;

  const chartWrappers = Array.from(chartsContainer.children) as HTMLElement[];

  // Sort wrapper elements based on their RiverLevelChart child
  if (currentSortOrder === 'alphabetical') {
    chartWrappers.sort((aWrapper, bWrapper) => {
      const a = aWrapper.querySelector('river-level-chart') as RiverLevelChart;
      const b = bWrapper.querySelector('river-level-chart') as RiverLevelChart;
      return a.displayName.toLowerCase().localeCompare(b.displayName.toLowerCase());
    });
  } else if (currentSortOrder === 'runnable') {
    chartWrappers.sort((aWrapper, bWrapper) => {
      const a = aWrapper.querySelector('river-level-chart') as RiverLevelChart;
      const b = bWrapper.querySelector('river-level-chart') as RiverLevelChart;
      const statusDiff = a.sortKeyRunnable - b.sortKeyRunnable;
      if (statusDiff !== 0) return statusDiff;
      return a.displayName.toLowerCase().localeCompare(b.displayName.toLowerCase());
    });
  } else if (currentSortOrder === 'favorites') {
    await sortByFavorites(chartWrappers); // Pass wrappers to sortByFavorites
  }

  // Re-append in sorted order (sortByFavorites handles its own reordering)
  if (currentSortOrder !== 'favorites') {
    chartWrappers.forEach(wrapper => chartsContainer!.appendChild(wrapper));
  }

  // Rebuild all charts after DOM reordering
  setTimeout(() => {
    chartWrappers.forEach(wrapper => {
      const chart = wrapper.querySelector('river-level-chart') as RiverLevelChart;
      if (chart && typeof chart.rebuildChart === 'function') {
        chart.rebuildChart();
      }
    });
  }, 50);

  handleHashScroll();
}

async function sortByFavorites(chartWrappers: HTMLElement[]) {
  if (!authService.isSignedIn()) {
    return;
  }

  try {
    // We'll need to import the user preferences service
    const { userPreferencesService } = await import('./utility/user-preferences-service');
    // const { userPreferencesService } = await import('./utility/user-preferences-service.ts'); // Ensure .ts if needed
    const preferences = await userPreferencesService.getUserPreferences();
    const favoriteRivers = preferences?.favoriteRivers || [];

    chartWrappers.sort((aWrapper, bWrapper) => {
      const a = aWrapper.querySelector('river-level-chart') as RiverLevelChart;
      const b = bWrapper.querySelector('river-level-chart') as RiverLevelChart;
      const aIsFavorite = favoriteRivers.includes(a.siteCode);
      const bIsFavorite = favoriteRivers.includes(b.siteCode);

      if (aIsFavorite && !bIsFavorite) return -1;
      if (!aIsFavorite && bIsFavorite) return 1;

      return a.displayName.toLowerCase().localeCompare(b.displayName.toLowerCase());
    });

    // Re-append in sorted order
    chartWrappers.forEach(wrapper => chartsContainer!.appendChild(wrapper));
  } catch (error) {
    console.error('Error sorting by favorites:', error);
    // Fall back to alphabetical sorting
    chartWrappers.sort((aWrapper, bWrapper) => {
      const a = aWrapper.querySelector('river-level-chart') as RiverLevelChart;
      const b = bWrapper.querySelector('river-level-chart') as RiverLevelChart;
      return a.displayName.toLowerCase().localeCompare(b.displayName.toLowerCase());
    });
    chartWrappers.forEach(wrapper => chartsContainer!.appendChild(wrapper));
  }
}

function handleHashScroll() {
  const hash = window.location.hash.substring(1);
  if (!hash || !chartsContainer) return;

  const chartWrappers = Array.from(chartsContainer.children) as HTMLElement[];
  const targetWrapper = chartWrappers.find(wrapper => {
    const chart = wrapper.querySelector('river-level-chart') as RiverLevelChart;
    return chart && slugify(chart.displayName) === hash;
  });

  if (targetWrapper) {
    // Delay to ensure charts are rebuilt and DOM is ready
    setTimeout(() => {
      targetWrapper.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  }
}

initializeApp();
