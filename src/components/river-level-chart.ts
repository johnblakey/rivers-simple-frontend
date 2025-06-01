import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { Chart, registerables, type ChartConfiguration, type ChartData } from 'chart.js/auto';
import 'chartjs-adapter-date-fns';

import {
  getRiverLevelsBySiteName,
  type RiverLevel,
  type RiverDetail,
} from '../utility/data';

Chart.register(...registerables);

@customElement('river-level-chart')
export class RiverLevelChart extends LitElement {
  @property({ type: String })
  siteNameToQuery: string = '';

  @state()
  private _levels: RiverLevel[] = [];

  @state()
  private _isLoading: boolean = false;

  @state()
  private _error: string | null = null;

  @state()
  private _hasData: boolean = false; // Initialize to false, set to true when data is loaded

  private chartInstance: Chart | null = null;

  @property({ type: Object })
  riverDetail: RiverDetail | null = null;

  // _isFetchingOrRendering is now part of fetchData logic, not a separate state for render logic
  private _isFetchingOperationInProgress: boolean = false;

  protected willUpdate(changedProperties: Map<string | number | symbol, unknown>): void {
    if (changedProperties.has('siteNameToQuery') || changedProperties.has('riverDetail')) {
      // If riverDetail changed, it might imply siteNameToQuery should also be updated if derived,
      // or at least titles might need refresh. Fetching data ensures consistency.
      if (this.siteNameToQuery && this.riverDetail) {
        this.fetchData();
      } else {
        // siteNameToQuery or riverDetail is missing, clear chart and data
        this.clearChartAndData();
      }
    }
  }

  protected updated(_changedProperties: Map<string | number | symbol, unknown>): void {
    // After states (_isLoading, _error, _hasData) are settled and component has re-rendered:
    // Render the chart if data is available, we are not loading, there's no error,
    // and a chart instance doesn't already exist.
    // The chart instance is destroyed in fetchData or clearChartAndData before new states are set.
    if (!this._isLoading && !this._error && this._hasData && !this.chartInstance) {
      const canvas = this.shadowRoot?.querySelector('#riverChartCanvas') as HTMLCanvasElement | null;
      if (canvas) {
        this.renderChart(canvas);
      } else {
        console.warn('RiverLevelChart: Canvas element not found after update, though data is present and chart should be rendered.');
      }
    }
  }

  private clearChartAndData() {
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }
    this._levels = [];
    this._hasData = false;
    this._error = null;
    this._isLoading = false; // Ensure loading state is reset
    // State changes will trigger re-render
  }

  async fetchData() {
    if (!this.siteNameToQuery) {
      console.debug(`Skipping fetchData for ${this.riverDetail?.siteName || 'Unknown Site'}: no siteNameToQuery provided.`);
      this.clearChartAndData();
      return;
    }
    if (!this.riverDetail) {
      console.debug(`Skipping fetchData for site ${this.siteNameToQuery}: no riverDetail provided.`);
      this.clearChartAndData();
      return;
    }

    if (this._isFetchingOperationInProgress) {
      console.warn(`fetchData skipped for ${this.siteNameToQuery}: operation already in progress.`);
      return;
    }

    this._isFetchingOperationInProgress = true;
    this._isLoading = true;
    this._error = null;
    this._hasData = false; // Reset hasData before fetching

    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }

    try {
      const levels = await getRiverLevelsBySiteName(this.siteNameToQuery);

      if (!this.isConnected) {
        console.debug(`Component disconnected for ${this.siteNameToQuery} after await. Aborting.`);
        this._isFetchingOperationInProgress = false; // Release lock
        return;
      }

      // API returns newest first, reverse for chronological chart
      this._levels = levels.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      this._hasData = this._levels.length > 0;

    } catch (err) {
      this._error = err instanceof Error ? err.message : "Failed to load river levels.";
      console.error(`Error fetching data for ${this.siteNameToQuery}:`, err);
      this._hasData = false;
    } finally {
      this._isLoading = false;
      this._isFetchingOperationInProgress = false;
      // State changes (_isLoading, _error, _hasData) will trigger `updated` and re-render.
    }
  }

  private renderChart(canvas: HTMLCanvasElement) {
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

    const displayName = this.riverDetail?.siteName || 'River Levels';

    // Pre-condition: this.chartInstance should be null when this method is called.
    // The calling logic in `updated` ensures this.
    // If an old instance existed, it should have been destroyed by `fetchData` or `clearChartAndData`.
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
                text: `Level (${this._levels[0]?.unitCode || 'N/A'})` // Safe access
              }
            }
          },
          plugins: {
            title: {
                display: true,
                text: displayName
            }
          }
        }
      };
    this.chartInstance = new Chart(canvas, config);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }
  }

  render() {
    const displayName = this.riverDetail?.siteName || this.siteNameToQuery || 'Loading River Data...';

    return html`
      <div class="river-info-container">
        <h2>${displayName}</h2>
        ${this.riverDetail ? html`
          <div class="details">
            <p>
              <strong>Site Code:</strong> ${this.riverDetail.siteCode || 'N/A'}
            </p>
            ${this.riverDetail.americanWhitewaterLink ? html`
              <p>
                <a href="${this.riverDetail.americanWhitewaterLink}" target="_blank" rel="noopener noreferrer">
                  American Whitewater Details
                </a>
              </p>
            ` : ''}
            <p>
              <strong>Advised Flow (CFS):</strong>
              Low: ${this.riverDetail.lowAdvisedCFS ?? 'N/A'} -
              High: ${this.riverDetail.highAdvisedCFS ?? 'N/A'}
            </p>
            ${this.riverDetail.comments ? html`<p><strong>Comments:</strong> ${this.riverDetail.comments}</p>` : ''}
            ${this.riverDetail.gaugeSource ? html`
              <p>
                <strong>Gauge Source:</strong>
                <a href="${this.riverDetail.gaugeSource}" target="_blank" rel="noopener noreferrer">Link</a>
              </p>
            ` : ''}
            ${this.riverDetail.localWeatherNOAA ? html`
              <p>
                <strong>NOAA Weather:</strong>
                <a href="${this.riverDetail.localWeatherNOAA}" target="_blank" rel="noopener noreferrer">Link</a>
              </p>
            ` : ''}
          </div>
        ` : html`<p>River details not available.</p>`}

        <div class="chart-status-container">
          ${this._isLoading
            ? html`<div class="loading">Loading level data for ${displayName}...</div>`
            : this._error
            ? html`<div class="error">Error loading level data: ${this._error}</div>`
            : this._hasData
            ? html`<canvas id="riverChartCanvas"></canvas>`
            : html`<div class="no-data">No river gauge data available for ${displayName}.</div>`
          }
        </div>
      </div>
    `;
  }

  static styles = css`
    :host {
      display: block;
      margin: 16px;
      padding: 16px;
      border: 1px solid #ccc;
      border-radius: 8px;
      max-width: 800px;
    }
    .river-info-container h2 {
      margin-top: 0;
    }
    .details {
      margin-bottom: 16px;
      padding-bottom: 16px;
      border-bottom: 1px solid #eee;
    }
    .details p {
      margin: 4px 0;
      font-size: 0.9em;
    }
    .details strong {
      color: #333;
    }
    canvas {
      max-width: 100%;
      height: auto;
    }
    .loading, .error, .no-data {
      padding: 20px;
      text-align: center;
    }
    .no-data {
      color: #757575;
      font-style: italic;
    }
  `;
}