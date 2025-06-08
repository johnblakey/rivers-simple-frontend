import { getRiverDetails } from './utility/data';
import type { RiverDetail } from './utility/data';
import { RiverLevelChart } from './components/river-level-chart';
import { slugify } from './utility/string-utils';
import { FavoriteButton } from './components/favorite-button.ts'; // Import FavoriteButton
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
    // Listen for favorite changes on the charts container
    // Since the event bubbles, we can listen here for changes from any button
    chartsContainer.addEventListener('favorite-changed', applySorting);

    // Fetch and render charts initially
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

    // Re-apply sorting when the user signs in, in case favorites changed
    if (user) {
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

  let favoriteSiteCodes: string[] = [];
  if (authService.isSignedIn()) {
    try {
      const { userPreferencesService } = await import('./utility/user-preferences-service');
      const preferences = await userPreferencesService.getUserPreferences();
      favoriteSiteCodes = preferences?.favoriteRivers || [];
    } catch (error) {
      console.error('Error fetching favorites for sorting:', error);
      // Continue without favorites if fetching fails, items will be sorted without pinning.
    }
  }

  const isSiteFavorite = (siteCode: string) => favoriteSiteCodes.includes(siteCode);

  chartWrappers.sort((aWrapper, bWrapper) => {
    const aChart = aWrapper.querySelector('river-level-chart') as RiverLevelChart;
    const bChart = bWrapper.querySelector('river-level-chart') as RiverLevelChart;

    if (!aChart || !bChart) return 0; // Should not happen if wrappers are structured correctly

    const aIsFav = isSiteFavorite(aChart.siteCode);
    const bIsFav = isSiteFavorite(bChart.siteCode);

    // Pinning logic: favorites always come before non-favorites
    if (aIsFav && !bIsFav) return -1;
    if (!aIsFav && bIsFav) return 1;

    // If both are favorites or both are non-favorites, apply current sort order
    if (currentSortOrder === 'alphabetical' || currentSortOrder === 'favorites') {
      return aChart.displayName.toLowerCase().localeCompare(bChart.displayName.toLowerCase());
    } else if (currentSortOrder === 'runnable') {
      const statusDiff = aChart.sortKeyRunnable - bChart.sortKeyRunnable;
      if (statusDiff !== 0) return statusDiff;
      return aChart.displayName.toLowerCase().localeCompare(bChart.displayName.toLowerCase());
    }
    return 0;
  });

  // Re-append in sorted order
  chartWrappers.forEach(wrapper => chartsContainer!.appendChild(wrapper));

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
