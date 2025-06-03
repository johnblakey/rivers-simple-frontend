import { getRiverDetails } from './utility/data';
import type { RiverDetail } from './utility/data';
import { RiverLevelChart } from './components/river-level-chart';

console.info("Welcome to the rivers.johnblakey.org. Email me at johnblakeyorg@gmail.com if you find any bugs, security issues, or have feedback. Blunt tone welcome.");

let currentSortOrder: 'alphabetical' | 'runnable' = 'alphabetical';
let allRiverDetails: RiverDetail[] = [];
let chartsContainer: HTMLDivElement | null = null;
let sortButton: HTMLButtonElement | null = null;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

async function initializeApp() {
  const appHost = document.getElementById('charts-host');
  if (!appHost) {
    console.error('Application host element (#charts-host) not found');
    document.body.textContent = 'Error: Application host element not found';
    return;
  }

  appHost.innerHTML = '';

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
}

function toggleSort() {
  currentSortOrder = currentSortOrder === 'alphabetical' ? 'runnable' : 'alphabetical';
  updateSortButtonText();

  // Clear the URL hash when toggling sort modes
  history.replaceState(null, "", window.location.pathname);

  applySorting();
}

function updateSortButtonText() {
  if (sortButton) {
    sortButton.textContent = `Sort by: ${currentSortOrder === 'alphabetical' ? 'Alphabetical' : 'Runnable'}`;
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

function applySorting() {
  if (!chartsContainer) return;

  const chartElements = Array.from(chartsContainer.children).filter(
    (el): el is RiverLevelChart => el instanceof RiverLevelChart
  );

  // Sort elements
  chartElements.sort((a, b) => {
    if (currentSortOrder === 'alphabetical') {
      return a.displayName.toLowerCase().localeCompare(b.displayName.toLowerCase());
    } else {
      // Runnable sort
      const statusDiff = a.sortKeyRunnable - b.sortKeyRunnable;
      if (statusDiff !== 0) return statusDiff;
      // Tie-breaker: alphabetical
      return a.displayName.toLowerCase().localeCompare(b.displayName.toLowerCase());
    }
  });

  // Re-append in sorted order
  chartElements.forEach(el => chartsContainer!.appendChild(el));

  // Rebuild all charts after DOM reordering (Chart.js doesn't handle moves well)
  setTimeout(() => {
    chartElements.forEach(el => el.rebuildChart());
  }, 50);

  // Handle hash scrolling
  handleHashScroll();
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
