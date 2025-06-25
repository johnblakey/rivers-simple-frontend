import { getRiverDetails } from './utility/data-service.ts';
import type { RiverDetail } from './utility/data-service.ts';
import { RiverLevelChart } from './components/river-chart.ts';
import { slugify } from './utility/string-utils';
import { FavoriteButton } from './components/favorite-button.ts';
import './utility/auth-ui';
import { authService } from './utility/auth-service';
import { userPreferencesService } from './utility/user-preferences-service';

console.info("Welcome to the rivers.johnblakey.org. Email me at johnblakeyorg@gmail.com if you find any bugs, security issues, or have feedback. Blunt tone welcome.");

let currentSortOrder: 'runnable' | 'alphabetical' = 'runnable';
let allRiverDetails: RiverDetail[] = [];
let chartsContainer: HTMLDivElement | null = null;
let sortToggleContainer: HTMLElement | null = null;
let runnableSortOption: HTMLElement | null = null;
let alphabeticalSortOption: HTMLElement | null = null;

// Enhanced lazy loading state tracking
let isInitialSortComplete = false;
let pendingResortTimeout: number | null = null;
let chartsLoadedCount = 0;

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
    headerAuthContainer.innerHTML = '';
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
  appHost.innerHTML = '';
  chartsContainer = document.createElement('div');
  appHost.appendChild(chartsContainer);

  try {
    // Listen for favorite changes and chart load completions
    chartsContainer.addEventListener('favorite-changed', handleFavoriteChange);
    chartsContainer.addEventListener('chart-loaded', handleChartLoaded);

    // Fetch and render charts initially
    allRiverDetails = await getRiverDetails();
    if (!allRiverDetails?.length) {
      chartsContainer.textContent = 'No river details found.';
      return;
    }
    renderCharts(allRiverDetails);
  } catch (error) {
    console.error("Failed to initialize:", error);
    chartsContainer.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
  }

  // Listen for auth state changes
  authService.onAuthStateChanged((_user) => {
    updateSortToggleVisuals();
    scheduleResort('auth-change');
  });
}

function setupSortToggle() {
  if (!sortToggleContainer) return;

  sortToggleContainer.innerHTML = '';
  sortToggleContainer.style.display = 'inline-flex';
  sortToggleContainer.style.border = '1px solid #ccc';
  sortToggleContainer.style.borderRadius = '4px';
  sortToggleContainer.style.overflow = 'hidden';
  if (sortToggleContainer instanceof HTMLButtonElement) {
    sortToggleContainer.style.padding = '0';
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
        history.replaceState(null, "", window.location.pathname);
        scheduleResort('sort-change');
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

function renderCharts(_riverDetails: RiverDetail[]) {
  if (!chartsContainer) return;

  chartsContainer.innerHTML = '';
  chartsLoadedCount = 0;
  isInitialSortComplete = false;

  for (const detail of allRiverDetails) {
    // A siteName is the minimum required property to render a chart card.
    if (!detail.siteName?.trim()) {
      console.warn(`Skipping river with missing siteName:`, detail);
      continue;
    }

    const chartWrapper = document.createElement('div');
    chartWrapper.className = 'chart-with-favorite-wrapper';
    chartWrapper.id = `wrapper-${slugify(detail.siteName)}`;

    const chartElement = new RiverLevelChart();
    chartElement.siteCode = detail.siteCode;
    chartElement.riverId = detail.siteCode || `db-id-${detail.id}`; // Use siteCode if available, otherwise fallback to db id
    chartElement.riverDetail = detail;

    const favoriteButton = document.createElement('favorite-button') as FavoriteButton;
    favoriteButton.siteCode = detail.siteCode;
    favoriteButton.riverName = detail.siteName;

    chartWrapper.appendChild(favoriteButton);
    chartWrapper.appendChild(chartElement);
    chartsContainer.appendChild(chartWrapper);
  }

  // Initial sort with alphabetical ordering (since data isn't loaded yet)
  scheduleResort('initial', 0);
}

/**
 * Schedules a resort operation with debouncing to prevent excessive resorting
 */
function scheduleResort(reason: string, delay: number = 300) {
  if (pendingResortTimeout !== null) {
    clearTimeout(pendingResortTimeout);
  }

  pendingResortTimeout = setTimeout(() => {
    console.log(`Resorting charts (reason: ${reason}, loaded: ${chartsLoadedCount}/${allRiverDetails.length})`);
    applySorting();
    pendingResortTimeout = null;
  }, delay);
}

/**
 * Handles individual chart load completion events
 */
function handleChartLoaded() {
  chartsLoadedCount++;

  // Only trigger resorts after initial load if we're in runnable sort mode
  // and we haven't completed the initial sort yet
  if (currentSortOrder === 'runnable') {
    scheduleResort('chart-loaded');
  }

  // Mark initial sort as complete once all charts are loaded
  if (chartsLoadedCount >= allRiverDetails.length && !isInitialSortComplete) {
    isInitialSortComplete = true;
    console.log('All charts loaded, initial sorting complete');
  }
}

/**
 * Handles favorite button changes
 */
function handleFavoriteChange() {
  scheduleResort('favorite-change');
}

async function applySorting(): Promise<void> {
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

  handleHashScroll();
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

    const aIsFav = isSiteFavorite(aChart.siteCode);
    const bIsFav = isSiteFavorite(bChart.siteCode);

    // Pinning logic: favorites always come before non-favorites
    if (aIsFav && !bIsFav) return -1;
    if (!aIsFav && bIsFav) return 1;

    // If both are favorites or both are non-favorites, apply current sort order
    if (currentSortOrder === 'alphabetical') {
      return aChart.displayName.toLowerCase().localeCompare(bChart.displayName.toLowerCase());
    } else if (currentSortOrder === 'runnable') {
      // For runnable sort, use the chart's sort key if available
      // Fall back to alphabetical if sort keys are the same or unavailable
      const aKey = aChart.sortKeyRunnable;
      const bKey = bChart.sortKeyRunnable;

      const statusDiff = aKey - bKey;
      if (statusDiff !== 0) return statusDiff;
      return aChart.displayName.toLowerCase().localeCompare(bChart.displayName.toLowerCase());
    }
    return 0;
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
