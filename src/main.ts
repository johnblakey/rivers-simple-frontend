// src/main.ts
import { getRiverDetails } from './utility/data-service.ts';
import type { RiverDetail } from './utility/data-service.ts';
import { RiverLevelChart } from './components/river-chart.ts';
import { slugify } from './utility/slugify-string.ts';
import { FavoriteButton } from './components/favorite-button.ts';
import './utility/auth-ui';
import { authService } from './utility/auth-service';
import { userPreferencesService } from './utility/user-preferences-service';

console.info("Welcome to the rivers.johnblakey.org. Email me at johnblakeyorg@gmail.com if you find any bugs, security issues, or have feedback. Blunt tone welcome.");

let allRiverDetails: RiverDetail[] = [];
let chartsContainer: HTMLDivElement | null = null;

// Enhanced lazy loading state tracking
let pendingResortTimeout: number | null = null;
let hasInitialSortBeenApplied = false; // New flag to ensure hash scroll only happens once
let isInitialAuthCheckComplete = false;

// Promise to resolve when the initial auth state is confirmed.
// This is crucial to prevent sorting before we know if the user is logged in,
// which would cause a race condition with the hash-based scrolling.
let resolveInitialAuth: () => void;
const initialAuthPromise = new Promise<void>(resolve => {
  resolveInitialAuth = resolve;
});

async function initializeApp() {
  const appHost = document.getElementById('charts-host');
  if (!appHost) {
    console.error('Application host element (#charts-host) not found');
    document.body.textContent = 'Error: Application host element not found';
    return;
  }

  // Listen for auth state changes immediately.
  // The first time this fires, it resolves the promise to signal that
  // the initial user state is known. Subsequent fires will trigger a resort.
  authService.onAuthStateChanged(() => {
    if (!isInitialAuthCheckComplete) {
      isInitialAuthCheckComplete = true;
      resolveInitialAuth();
    } else {
      scheduleResort('auth-change');
    }
  });

  // Setup Auth UI in the header
  const headerAuthContainer = document.getElementById('auth-container');
  if (headerAuthContainer) {
    const authUI = document.createElement('auth-ui');
    headerAuthContainer.innerHTML = '';
    headerAuthContainer.appendChild(authUI);
  } else {
    console.warn('#auth-container element not found in the header.');
  }

  // Create charts container
  appHost.innerHTML = '';
  chartsContainer = document.createElement('div');
  appHost.appendChild(chartsContainer);

  try {
    // Listen for favorite changes and chart load completions
    chartsContainer.addEventListener('favorite-changed', handleFavoriteChange); // Keep favorite change listener

    // Fetch and render charts initially
    allRiverDetails = await getRiverDetails();
    if (!allRiverDetails?.length) {
      chartsContainer.textContent = 'No river details found.';
      return;
    }
    renderCharts(); // Render all charts with initial (unsorted) data

    // Wait for the initial authentication check to complete before sorting.
    // This ensures that if a user is signed in, we have their favorites
    // before we attempt to sort and scroll to a hashed URL.
    await initialAuthPromise;

    applySorting(true); // Now apply the definitive initial sort and handle hash scroll
  } catch (error) {
    console.error("Failed to initialize:", error);
    chartsContainer.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function renderCharts() {
  if (!chartsContainer) return;

  chartsContainer.innerHTML = '';

  for (const detail of allRiverDetails) {
    // A siteName is the minimum required property to render a chart card.
    if (!detail.siteName?.trim()) {
      console.warn(`Skipping river with missing siteName:`, detail);
      continue;
    }

    // Create a consistent, unique identifier for each river.
    // Use the siteCode if it exists, otherwise use a prefixed database ID.
    // This ensures that even rivers without a gauge can be favorited.
    const riverIdentifier = detail.siteCode || `db-id-${detail.id}`;

    const chartWrapper = document.createElement('div');
    chartWrapper.className = 'chart-with-favorite-wrapper';
    chartWrapper.id = `wrapper-${slugify(detail.siteName)}`;

    const chartElement = new RiverLevelChart();
    chartElement.siteCode = detail.siteCode;
    chartElement.riverId = riverIdentifier;
    chartElement.riverDetail = detail;

    const favoriteButton = document.createElement('favorite-button') as FavoriteButton;
    favoriteButton.siteCode = riverIdentifier; // Pass the unique identifier
    favoriteButton.riverName = detail.siteName;

    chartWrapper.appendChild(favoriteButton);
    chartWrapper.appendChild(chartElement);
    chartsContainer.appendChild(chartWrapper);
  }
}

/**
 * Schedules a resort operation with debouncing to prevent excessive resorting
 */
function scheduleResort(reason: string, delay: number = 300) { // Debouncing is still useful for rapid favorite changes
  if (pendingResortTimeout !== null) {
    clearTimeout(pendingResortTimeout);
  }

  pendingResortTimeout = setTimeout(() => {
    console.log(`Resorting charts (reason: ${reason})`);
    applySorting(false); // Not an initial sort
    pendingResortTimeout = null;
  }, delay);
}

/**
 * Handles favorite button changes
 */
function handleFavoriteChange() {
  scheduleResort('favorite-change');
}

async function applySorting(isInitial: boolean = false): Promise<void> {
  if (!chartsContainer) return;

  const chartWrappers = Array.from(chartsContainer.children) as HTMLElement[];
  const sortedWrappers = await sortChartWrappers(chartWrappers);

  // Only reorder if the order actually changed to prevent unnecessary DOM manipulation
  const hasOrderChanged = chartWrappers.some((wrapper, index) => wrapper !== sortedWrappers[index]);

  if (hasOrderChanged) {
    // Re-append in sorted order
    sortedWrappers.forEach(wrapper => chartsContainer!.appendChild(wrapper));

    // Rebuild charts after DOM reordering
    rebuildCharts(sortedWrappers);
  }

  if (isInitial && !hasInitialSortBeenApplied) {
    handleHashScroll();
    hasInitialSortBeenApplied = true;
  }
}

async function sortChartWrappers(chartWrappers: HTMLElement[]): Promise<HTMLElement[]> {
  let favoriteSiteCodes: string[] = [];
  if (authService.isSignedIn()) {
    try {
      const preferences = await userPreferencesService.getUserPreferences();
      favoriteSiteCodes = preferences?.favoriteRivers || [];
    } catch (error) {
      console.error('Error fetching favorites for sorting:', error);
    }
  }

  const isSiteFavorite = (siteCode: string) => favoriteSiteCodes.includes(siteCode);

  return [...chartWrappers].sort((aWrapper, bWrapper) => {
    const aChart = aWrapper.querySelector('river-level-chart') as RiverLevelChart;
    const bChart = bWrapper.querySelector('river-level-chart') as RiverLevelChart;

    if (!aChart || !bChart) return 0;

    const aIsFav = isSiteFavorite(aChart.riverId);
    const bIsFav = isSiteFavorite(bChart.riverId);

    // Pinning logic: favorites always come before non-favorites
    if (aIsFav && !bIsFav) return -1;
    if (!aIsFav && bIsFav) return 1;

    // If both are favorites or both are non-favorites, sort alphabetically
    // This is the only secondary sort now
    return aChart.displayName.toLowerCase().localeCompare(bChart.displayName.toLowerCase());
  });
}

function rebuildCharts(chartWrappers: HTMLElement[]): void {
  setTimeout(() => {
    chartWrappers.forEach(wrapper => {
      const chart = wrapper.querySelector('river-level-chart') as RiverLevelChart;
      chart?.rebuildChart();
    });
  }, 50);
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
    setTimeout(() => {
      targetWrapper.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  }
}

initializeApp();
