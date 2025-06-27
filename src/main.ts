// src/main.ts
import { getRiverDetails, getRiverLevelsBySiteCode } from './utility/river-service.ts';
import type { RiverDetail, RiverLevel } from './utility/river-service.ts';
import { RiverSection } from './components/river-chart/river-section.ts';
import { slugify } from './utility/slugify-string.ts';
import { FavoriteButton } from './components/favorite-button.ts';
import { AuthUI } from './utility/auth-ui';
import { authService } from './utility/auth-service';
import { userPreferencesService } from './utility/user-preferences-service';

console.info("Welcome to the rivers.johnblakey.org. Email me at johnblakeyorg@gmail.com if you find any bugs, security issues, or have feedback. Blunt tone welcome.");

let allRiverDetails: RiverDetail[] = [];
let riverLevelsCache = new Map<string, RiverLevel[]>();
let expandedSections = new Set<string>();

// Enhanced lazy loading state tracking
let pendingResortTimeout: number | null = null;
let hasInitialSortBeenApplied = false;
let isInitialAuthCheckComplete = false;

// Promise to resolve when the initial auth state is confirmed
let resolveInitialAuth: () => void;
const initialAuthPromise = new Promise<void>(resolve => {
  resolveInitialAuth = resolve;
});

interface RiverTableData {
  detail: RiverDetail;
  currentLevel: number | null;
  status: 'low' | 'good' | 'high' | 'no-data';
  statusColor: string;
}

function determineRiverStatus(currentLevel: number | null, lowAdvised: number, highAdvised: number): { status: 'low' | 'good' | 'high' | 'no-data'; color: string } {
  if (currentLevel === null) {
    return { status: 'no-data', color: '#999' };
  }

  if (lowAdvised === 0 && highAdvised === 0) {
    return { status: 'no-data', color: '#999' };
  }

  if (currentLevel < lowAdvised) {
    return { status: 'low', color: '#dc3545' }; // Red
  } else if (currentLevel > highAdvised) {
    return { status: 'high', color: '#ffc107' }; // Yellow/Orange
  } else {
    return { status: 'good', color: '#28a745' }; // Green
  }
}

async function getCurrentRiverLevel(siteCode: string): Promise<number | null> {
  if (!siteCode) return null;

  try {
    // Check cache first
    let levels = riverLevelsCache.get(siteCode);
    if (!levels) {
      levels = await getRiverLevelsBySiteCode(siteCode);
      riverLevelsCache.set(siteCode, levels);
    }

    if (levels.length === 0) return null;

    // Get the most recent level
    const sortedLevels = levels.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return sortedLevels[0].value;
  } catch (error) {
    console.error(`Error fetching levels for ${siteCode}:`, error);
    return null;
  }
}

async function createTableData(): Promise<RiverTableData[]> {
  const tableData: RiverTableData[] = [];

  for (const detail of allRiverDetails) {
    const currentLevel = await getCurrentRiverLevel(detail.siteCode);
    const { status, color } = determineRiverStatus(currentLevel, detail.lowAdvisedCFS, detail.highAdvisedCFS);

    tableData.push({
      detail,
      currentLevel,
      status,
      statusColor: color
    });
  }

  return tableData;
}

async function renderRiversTable() {
  const tableBody = document.getElementById('rivers-table-body');
  if (!tableBody) return;

  const tableData = await createTableData();

  // Sort table data (favorites first, then alphabetical)
  let favoriteSiteCodes: string[] = [];
  if (authService.isSignedIn()) {
    try {
      const preferences = await userPreferencesService.getUserPreferences();
      favoriteSiteCodes = preferences?.favoriteRivers || [];
    } catch (error) {
      console.error('Error fetching favorites for table sorting:', error);
    }
  }

  const sortedData = tableData.sort((a, b) => {
    const aRiverId = a.detail.siteCode || `db-id-${a.detail.id}`;
    const bRiverId = b.detail.siteCode || `db-id-${b.detail.id}`;

    const aIsFav = favoriteSiteCodes.includes(aRiverId);
    const bIsFav = favoriteSiteCodes.includes(bRiverId);

    if (aIsFav && !bIsFav) return -1;
    if (!aIsFav && bIsFav) return 1;

    return a.detail.siteName.toLowerCase().localeCompare(b.detail.siteName.toLowerCase());
  });

  tableBody.innerHTML = '';

  sortedData.forEach(data => {
    const row = document.createElement('tr');
    const riverId = data.detail.siteCode || `db-id-${data.detail.id}`;
    row.className = 'river-row';
    row.dataset.riverId = riverId;

    // Add favorite class if applicable
    if (favoriteSiteCodes.includes(riverId)) {
      row.classList.add('favorite-river');
    }

    const levelText = data.currentLevel !== null ? `${data.currentLevel.toFixed(1)} CFS` : 'No Data';
    const statusText = data.status === 'no-data' ? 'No Data' :
                      data.status === 'low' ? 'Low' :
                      data.status === 'high' ? 'High' : 'Good';

    row.innerHTML = `
      <td class="river-name">${data.detail.siteName}</td>
      <td class="river-level">${levelText}</td>
      <td class="river-status">
        <span class="status-indicator" style="background-color: ${data.statusColor}"></span>
        ${statusText}
      </td>
    `;

    row.addEventListener('click', () => toggleRiverSection(data.detail));
    tableBody.appendChild(row);
  });
}

function toggleRiverSection(riverDetail: RiverDetail) {
  const riverId = riverDetail.siteCode || `db-id-${riverDetail.id}`;
  const expandedContainer = document.getElementById('expanded-sections');
  if (!expandedContainer) return;

  const existingSection = document.getElementById(`expanded-${riverId}`);

  if (existingSection) {
    // Section is already expanded, leave it open (as requested)
    existingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  // Create new expanded section
  const sectionWrapper = document.createElement('div');
  sectionWrapper.id = `expanded-${riverId}`;
  sectionWrapper.className = 'expanded-river-section';

  // Add close button
  const closeButton = document.createElement('button');
  closeButton.className = 'close-section-btn';
  closeButton.innerHTML = '×';
  closeButton.title = 'Close section';
  closeButton.addEventListener('click', (e) => {
    e.stopPropagation();
    sectionWrapper.remove();
    expandedSections.delete(riverId);
  });

  // Create river section component
  const riverSection = new RiverSection();
  riverSection.siteCode = riverDetail.siteCode;
  riverSection.riverId = riverId;
  riverSection.riverDetail = riverDetail;

  // Create favorite button
  const favoriteButton = document.createElement('favorite-button') as FavoriteButton;
  favoriteButton.siteCode = riverId;
  favoriteButton.riverName = riverDetail.siteName;

  // Assemble the section
  const headerDiv = document.createElement('div');
  headerDiv.className = 'expanded-section-header';
  headerDiv.appendChild(favoriteButton);
  headerDiv.appendChild(closeButton);

  sectionWrapper.appendChild(headerDiv);
  sectionWrapper.appendChild(riverSection);

  expandedContainer.appendChild(sectionWrapper);
  expandedSections.add(riverId);

  // Scroll to the new section
  setTimeout(() => {
    sectionWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

async function initializeApp() {
  const appHost = document.getElementById('charts-host');
  if (!appHost) {
    console.error('Application host element (#charts-host) not found');
    document.body.textContent = 'Error: Application host element not found';
    return;
  }

  // Listen for auth state changes
  authService.onAuthStateChanged(() => {
    if (!isInitialAuthCheckComplete) {
      isInitialAuthCheckComplete = true;
      resolveInitialAuth();
    } else {
      // Re-render table when auth state changes
      renderRiversTable();
    }
  });

  // Setup Auth UI in the header
  const headerAuthContainer = document.getElementById('auth-container');
  if (headerAuthContainer) {
    const authUI = new AuthUI();
    headerAuthContainer.innerHTML = '';
    headerAuthContainer.appendChild(authUI);
  } else {
    console.warn('#auth-container element not found in the header.');
  }

  // Listen for favorite changes
  document.addEventListener('favorite-changed', () => {
    renderRiversTable();
  });

  try {
    // Fetch river details
    allRiverDetails = await getRiverDetails();
    if (!allRiverDetails?.length) {
      const tableContainer = document.getElementById('rivers-table-container');
      if (tableContainer) {
        tableContainer.innerHTML = '<p>No river details found.</p>';
      }
      return;
    }

    // Wait for initial auth check
    await initialAuthPromise;

    // Render the table
    await renderRiversTable();

  } catch (error) {
    console.error("Failed to initialize:", error);
    const tableContainer = document.getElementById('rivers-table-container');
    if (tableContainer) {
      tableContainer.innerHTML = `<p>Error: ${error instanceof Error ? error.message : String(error)}</p>`;
    }
  }
}

initializeApp();
