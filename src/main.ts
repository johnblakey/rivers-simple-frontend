import { LitElement, html, css, type PropertyValueMap } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { Chart, registerables, type ChartConfiguration, type ChartData } from 'chart.js/auto';
import 'chartjs-adapter-date-fns'; // Import the date adapter

import {
  getRiverDetails,
  getRiverLevelsBySiteName,
  type RiverLevel,
  type RiverDetail,
} from './utility/data';


Chart.register(...registerables);

@customElement('river-level-chart')
export class RiverLevelChart extends LitElement {
  static styles = css`
    :host {
      display: block;
      margin: 16px;
      padding: 16px;
      border: 1px solid #ccc;
      border-radius: 8px;
      max-width: 800px;
    }
    canvas {
      max-width: 100%;
      height: auto;
    }
    canvas.hidden {
      display: none;
    }
    .loading, .error {
      padding: 20px;
      text-align: center;
    }
  `;

  @property({ type: String })
  siteNameToQuery: string = '';

  @property({ type: String })
  chartTitle: string = 'River Levels';

  @state()
  private _levels: RiverLevel[] = [];

  @state()
  private _isLoading: boolean = false;

  @state()
  private _error: string | null = null;

  @state()
  private _isFetchingOrRendering: boolean = false;

  private chartInstance: Chart | null = null;
  private canvasRef: HTMLCanvasElement | null = null;

  protected firstUpdated(_: PropertyValueMap<this> | Map<PropertyKey, unknown>): void {
      // This line "uses" the variable '_' to satisfy the ESLint rule
      // when the `argsIgnorePattern` for `no-unused-vars` is not configured
      // to ignore parameters named or prefixed with an underscore.
      // The ideal solution is to configure ESLint (e.g., "argsIgnorePattern": "^_").
      void _;

      this.canvasRef = this.shadowRoot?.querySelector('#riverChartCanvas') as HTMLCanvasElement;
      if (this.siteNameToQuery) {
        this.fetchAndRenderChart();
      }
  }

  protected updated(changedProperties: Map<string | number | symbol, unknown>): void {
    if (changedProperties.has('siteNameToQuery') && this.siteNameToQuery) {
      this.fetchAndRenderChart();
    }
  }

  async fetchAndRenderChart() {
    if (!this.siteNameToQuery || !this.canvasRef) {
      // console.debug('Skipping fetchAndRenderChart: no siteNameToQuery or canvasRef');
      return;
    }

    if (this._isFetchingOrRendering) {
      console.warn(`fetchAndRenderChart skipped for ${this.siteNameToQuery}: operation already in progress.`);
      return;
    }

    this._isFetchingOrRendering = true;
    this._isLoading = true;
    this._error = null;

    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }

    try {
      const levels = await getRiverLevelsBySiteName(this.siteNameToQuery);

      // Ensure component is still connected and canvas is available after await
      if (!this.isConnected || !this.canvasRef) {
        // console.debug(`Component disconnected or canvasRef lost for ${this.siteNameToQuery} after await. Aborting render.`);
        return; // finally block will still run to reset flags
      }
      // API returns newest first, reverse for chronological chart
      this._levels = levels.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      const chartData: ChartData = {
        labels: this._levels.map(level => new Date(level.timestamp)),
        datasets: [{
          label: `Flow (${this._levels.length > 0 ? this._levels[0].unitCode : 'ft3/s'})`,
          data: this._levels.map(level => level.value),
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1,
          fill: false,
        }],
      };

      const config: ChartConfiguration = {
        type: 'line',
        data: chartData,
        options: {
          responsive: true,
          maintainAspectRatio: true,
          scales: {
            x: {
              type: 'time',
              time: {
                unit: 'hour',
                tooltipFormat: 'MMM d, yyyy HH:mm',
                 displayFormats: {
                    hour: 'HH:mm'
                 }
              },
              title: {
                display: true,
                text: 'Time'
              }
            },
            y: {
              title: {
                display: true,
                text: `Level (${this._levels.length > 0 ? this._levels[0].unitCode : 'ft3/s'})`
              }
            }
          },
          plugins: {
            title: {
                display: true,
                text: this.chartTitle
            }
          }
        }
      };
      this.chartInstance = new Chart(this.canvasRef, config);
    } catch (err) {
      this._error = err instanceof Error ? err.message : "Failed to load river levels.";
      console.error("Error fetching or rendering chart:", err);
    } finally {
      this._isLoading = false;
      this._isFetchingOrRendering = false;
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }
  }

  render() {
    if (this._isLoading) {
      // Keep rendering the basic structure even when loading, but hide the canvas
      // and show a loading message.
    }
    if (this._error) {
      return html`<div class="error">Error loading chart for ${this.chartTitle}: ${this._error}</div>`;
    }

    // Always render the canvas structure.
    // Show loading message if applicable.
    // Hide canvas via CSS if loading.
    return html`
      <h2>${this.chartTitle}</h2>
      ${this._isLoading ? html`<div class="loading">Loading chart data for ${this.chartTitle}...</div>` : ''}
      <canvas id="riverChartCanvas" class=${this._isLoading ? 'hidden' : ''}></canvas>
    `;
  }
}

async function initializeApp() {
  document.body.innerHTML = ''; // Clear any existing content

  try {
    const riverDetails = await getRiverDetails();

    // For demonstration, let's try to find "Sauk River near Sauk, Wa" (siteCode 12189500)
    // The API endpoint /riverlevels/sitename/ expects a name like "SAUK RIVER NEAR SAUK, WA"
    // which is the `siteName` from the `riverlevels` data.
    // The `RiverDetail` object for siteCode 12189500 has `siteName: "Sauk River near Sauk, Wa"`.
    // We'll use this and rely on the API being somewhat flexible or matching it.
    // A more robust solution might involve matching siteCodes if siteNames are inconsistent.
    const targetSiteDetail: RiverDetail | undefined = riverDetails.find(
      // Using a known siteName from the riverlevels data for reliability with the API endpoint.
      // This name corresponds to siteCode "12106700"
      // The RiverDetail for 12106700 is "Green River - Upper Gorge"
      // Let's use the siteName from the API example in data.txt for the query
      // and find the corresponding detail for the title.
      detail => detail.siteCode === "12106700" // Green River
    );

    const siteNameToQueryApi = "GREEN RIVER AT PURIFICATION PLANT NEAR PALMER, WA"; // From data.txt example
    let chartTitle = siteNameToQueryApi;

    if (targetSiteDetail) {
        chartTitle = targetSiteDetail.siteName; // Use the more descriptive name from details for the title
    } else {
        console.warn(`Could not find a specific RiverDetail for siteCode 12106700, using default title.`);
        // Fallback if the specific detail isn't found, still try to chart the example site
    }

    if (siteNameToQueryApi) {
      const chartElement = document.createElement('river-level-chart') as RiverLevelChart;
      chartElement.siteNameToQuery = siteNameToQueryApi;
      chartElement.chartTitle = chartTitle;
      document.body.appendChild(chartElement);

      // Example: Add another chart for a different river
      const saukRiverDetail = riverDetails.find(d => d.siteCode === "12189500"); // Sauk River
      // The riverlevels data for siteCode 12189500 has siteName: "SAUK RIVER NEAR SAUK, WA"
      const saukSiteNameToQueryApi = "SAUK RIVER NEAR SAUK, WA";
      let saukChartTitle = saukSiteNameToQueryApi;
      if (saukRiverDetail) {
        saukChartTitle = saukRiverDetail.siteName;
      } else {
        console.warn(`Could not find RiverDetail for Sauk River (12189500).`);
      }

      const saukChartElement = document.createElement('river-level-chart') as RiverLevelChart;
      saukChartElement.siteNameToQuery = saukSiteNameToQueryApi;
      saukChartElement.chartTitle = saukChartTitle;
      document.body.appendChild(saukChartElement);

    } else {
      document.body.textContent = 'Could not determine a site to display.';
    }

  } catch (error) {
    console.error("Failed to initialize application:", error);
    document.body.textContent = `Error initializing application: ${error instanceof Error ? error.message : String(error)}`;
  }
}

initializeApp();
