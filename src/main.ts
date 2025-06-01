import { getRiverDetails } from './utility/data';
import { RiverLevelChart } from './components/river-level-chart'; // Import the component

console.info(
  "Welcome to the rivers.johnblakey.org. If you find any bugs, security issues or have feedback, please email me at johnblakeyorg@gmail.com. Blunt tone welcome."
);

async function initializeApp() {
  const appHost = document.getElementById('charts-host');
  if (!appHost) {
    console.error('Application host element (#charts-host) not found in index.html.');
    document.body.textContent = 'Error: Application host element not found. Please ensure a <div id="charts-host"></div> exists in your HTML.';
    return;
  }
  // Clear only the content of the appHost, not the entire body
  appHost.innerHTML = '';

  try {
    const riverDetails = await getRiverDetails();
    if (!riverDetails || riverDetails.length === 0) {
      appHost.textContent = 'No river details found.';
      return;
    }

    const chartsContainer = document.createElement('div');
    appHost.appendChild(chartsContainer);

    for (const detail of riverDetails) {
      // We must have a siteName to display something meaningful in the component.
      if (!detail.siteName || detail.siteName.trim() === '') {
        console.warn(`Skipping river detail due to missing or empty siteName for display: ${JSON.stringify(detail)}`);
        continue;
      }

      const chartElement = new RiverLevelChart(); // Create an instance of the imported component

      // Pass the siteCode for the API query.
      // The RiverLevelChart component will handle an empty siteCode by not fetching chart data.
      chartElement.siteCode = detail.siteCode;
      chartElement.riverDetail = detail; // Pass the whole detail object
      chartsContainer.appendChild(chartElement);
    }

  } catch (error) {
    console.error("Failed to initialize application:", error);
    appHost.textContent = `Error initializing application: ${error instanceof Error ? error.message : String(error)}`;
  }
}

initializeApp();
