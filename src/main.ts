import { getRiverDetails } from './utility/data';
import type { RiverDetail } from './utility/data';
import { RiverLevelChart } from './components/river-level-chart';
import { slugify } from './utility/string-utils';
import { FavoriteButton } from './components/favorite-button.ts'; // Import FavoriteButton
import './utility/auth-ui'; // Import the auth UI component
import { authService } from './utility/auth-service';

console.info("Welcome to the rivers.johnblakey.org. Email me at johnblakeyorg@gmail.com if you find any bugs, security issues, or have feedback. Blunt tone welcome.");

let currentSortOrder: 'runnable' | 'alphabetical' = 'runnable'; // Default to Runnable
let allRiverDetails: RiverDetail[] = [];
let chartsContainer: HTMLDivElement | null = null;
// The sortButton element will be repurposed to host the toggle options
let sortToggleContainer: HTMLElement | null = null;
let runnableSortOption: HTMLElement | null = null;
let alphabeticalSortOption: HTMLElement | null = null;

async function initializeApp() {
  const appHost = document.getElementById('charts-host');
  if (!appHost) {
    console.error('Application host element (#charts-host) not found');
    document.body.textContent = 'Error: Application host element not found';
    return;
  }

  // Setup Auth UI in the header
  const headerAuthContainer = document.getElementById('auth-container');
  if (headerAuthContainer) {
    const authUI = document.createElement('auth-ui');
    headerAuthContainer.innerHTML = ''; // Clear any placeholder
    headerAuthContainer.appendChild(authUI);
  } else {
    console.warn('#auth-container element not found in the header.');
  }

  // Setup sort toggle
  sortToggleContainer = document.getElementById('sort-toggle');
  if (sortToggleContainer) {
    setupSortToggle();
  }

  // Create charts container
  appHost.innerHTML = ''; // Clear appHost after auth UI is potentially set up elsewhere
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
  authService.onAuthStateChanged((_user) => {
    updateSortToggleVisuals(); // Update visual state of the toggle
    // Re-apply sorting when auth state changes, to update favorites pinning
    applySorting();
  });
}

function setupSortToggle() {
  if (!sortToggleContainer) return;

  sortToggleContainer.innerHTML = ''; // Clear existing content
  // Basic styling for the container (you might want to use CSS classes)
  sortToggleContainer.style.display = 'inline-flex';
  sortToggleContainer.style.border = '1px solid #ccc';
  sortToggleContainer.style.borderRadius = '4px';
  sortToggleContainer.style.overflow = 'hidden';
  if (sortToggleContainer instanceof HTMLButtonElement) {
    sortToggleContainer.style.padding = '0'; // Remove button padding if it's a button
  }

  runnableSortOption = document.createElement('span');
  runnableSortOption.textContent = 'Runnable';
  runnableSortOption.dataset.sortValue = 'runnable';

  alphabeticalSortOption = document.createElement('span');
  alphabeticalSortOption.textContent = 'Alphabetical';
  alphabeticalSortOption.dataset.sortValue = 'alphabetical';

  [runnableSortOption, alphabeticalSortOption].forEach(option => {
    option.style.padding = '8px 12px';
    option.style.cursor = 'pointer';
    option.style.userSelect = 'none';
    option.addEventListener('click', () => {
      const newSortOrder = option.dataset.sortValue as 'runnable' | 'alphabetical';
      if (currentSortOrder !== newSortOrder) {
        currentSortOrder = newSortOrder;
        updateSortToggleVisuals();
        history.replaceState(null, "", window.location.pathname); // Clear hash
        applySorting();
      }
    });
    sortToggleContainer!.appendChild(option);
  });

  updateSortToggleVisuals();
}

function updateSortToggleVisuals() {
  if (!runnableSortOption || !alphabeticalSortOption) return;

  const activeStyle = { backgroundColor: '#007bff', color: 'white' };
  const inactiveStyle = { backgroundColor: '#f0f0f0', color: 'black' };

  Object.assign(runnableSortOption.style, currentSortOrder === 'runnable' ? activeStyle : inactiveStyle);
  Object.assign(alphabeticalSortOption.style, currentSortOrder === 'alphabetical' ? activeStyle : inactiveStyle);

  // Add hover effect for inactive buttons (optional, better with CSS classes)
  [runnableSortOption, alphabeticalSortOption].forEach(option => {
    if (option.style.backgroundColor === inactiveStyle.backgroundColor) {
      option.onmouseover = () => option.style.backgroundColor = '#e0e0e0';
      option.onmouseout = () => option.style.backgroundColor = inactiveStyle.backgroundColor;
    } else {
      option.onmouseover = null;
      option.onmouseout = null;
    }
  });
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
    if (currentSortOrder === 'alphabetical') {
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
