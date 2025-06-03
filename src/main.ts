import { getRiverDetails } from './utility/data';
import type { RiverDetail } from './utility/data';
import { RiverLevelChart } from './components/river-level-chart'; // Import the component

console.info(
  "Welcome to the rivers.johnblakey.org. Email me at johnblakeyorg@gmail.com if you find any bugs, security issues, or have feedback. Blunt tone welcome."
);

let currentSortOrder: 'alphabetical' | 'runnable' = 'alphabetical';
// RiverDetail type is now imported from './utility/data'

let allRiverDetails: RiverDetail[] = []; // To store the initial fetch
const appHost = document.getElementById('charts-host');
let chartsContainer: HTMLDivElement | null = null; // Will hold the chart elements
let sortToggleButton: HTMLButtonElement | null = null;
let debounceTimer: number;

// Utility function (can be moved to a shared utility file)
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
  if (!appHost) {
    console.error('Application host element (#charts-host) not found in index.html.');
    document.body.textContent = 'Error: Application host element not found. Please ensure a <div id="charts-host"></div> exists in your HTML.';
    return;
  }
  // Clear only the content of the appHost, not the entire body
  appHost.innerHTML = '';

  sortToggleButton = document.getElementById('sort-toggle') as HTMLButtonElement | null;
  if (sortToggleButton) {
    updateSortButtonText(); // Set initial text
    sortToggleButton.addEventListener('click', () => {
      toggleSortOrder();
      debouncedApplySort(); // Use debounced sort after toggle
    });
  }

  chartsContainer = document.createElement('div');
  chartsContainer.addEventListener('data-updated', () => {
    if (currentSortOrder === 'runnable') {
      debouncedApplySort();
    }
  });
  appHost.appendChild(chartsContainer);

  try {
    const riverDetails = await getRiverDetails();
    allRiverDetails = riverDetails;

    if (!allRiverDetails || allRiverDetails.length === 0) {
      if (chartsContainer) chartsContainer.textContent = 'No river details found.';
      return;
    }

    renderRiverChartsFromMasterList();

  } catch (error) {
    console.error("Failed to initialize application:", error);
    if (chartsContainer) chartsContainer.textContent = `Error initializing application: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function toggleSortOrder() {
  currentSortOrder = currentSortOrder === 'alphabetical' ? 'runnable' : 'alphabetical';
  updateSortButtonText();
}

function updateSortButtonText() {
  if (sortToggleButton) {
    sortToggleButton.textContent = `Sort by: ${currentSortOrder === 'alphabetical' ? 'Alphabetical' : 'Runnable'}`;
    // Optional: Add a data attribute or class for styling based on state
    sortToggleButton.setAttribute('data-sort', currentSortOrder);
  }
}

function renderRiverChartsFromMasterList() {
  if (!chartsContainer || !allRiverDetails) return;
  chartsContainer.innerHTML = ''; // Clear previous charts

  // Initial sort for element creation order (primarily for alphabetical)
  // "Runnable" sort will be properly applied by applySort after components load data.
  const sortedDetails = [...allRiverDetails].sort((a, b) => {
    const nameA = a.siteName?.toLowerCase() || '';
    const nameB = b.siteName?.toLowerCase() || '';
    return nameA.localeCompare(nameB);
  });

  for (const detail of sortedDetails) {
    if (!detail.siteName || detail.siteName.trim() === '') {
      console.warn(`Skipping river detail due to missing or empty siteName for display: ${JSON.stringify(detail)}`);
      continue;
    }

    const chartElement = new RiverLevelChart();
    chartElement.siteCode = detail.siteCode;
    chartElement.riverDetail = detail;
    chartsContainer.appendChild(chartElement);
  }

  // Always apply initial sort based on currentSortOrder
  // Data updates will trigger debouncedApplySort later if needed
  applySort();
}

function debouncedApplySort() {
  clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    applySort();
  }, 250); // Debounce delay
}

function applySort() {
  if (!chartsContainer) return;

  const chartElements = Array.from(chartsContainer.children).filter(
    (el): el is RiverLevelChart => el instanceof RiverLevelChart
  );

  if (currentSortOrder === 'alphabetical') {
    chartElements.sort((a, b) => {
      const nameA = a.displayName.toLowerCase();
      const nameB = b.displayName.toLowerCase();
      return nameA.localeCompare(nameB);
    });
  } else if (currentSortOrder === 'runnable') {
    chartElements.sort((a, b) => {
      const statusA = a.sortKeyRunnable;
      const statusB = b.sortKeyRunnable;

      if (statusA !== statusB) {
        return statusA - statusB; // Lower key means higher priority
      }
      // Tie-breaker: alphabetical by display name
      const nameA = a.displayName.toLowerCase();
      const nameB = b.displayName.toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }

  // Re-append sorted elements
  chartElements.forEach(el => chartsContainer!.appendChild(el));

  // Scroll to hash if present and element moved
  const currentHash = window.location.hash.substring(1);
  if (currentHash) {
    const targetElement = chartElements.find(el => slugify(el.displayName) === currentHash);
    if (targetElement) {
      const rect = targetElement.getBoundingClientRect();
      const isVisible = rect.top >= 0 && rect.bottom <= (window.innerHeight || document.documentElement.clientHeight);
      if (!isVisible) { // Only scroll if not already largely visible
        targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }
}

initializeApp();
