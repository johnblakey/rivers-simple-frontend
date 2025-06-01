import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { Chart, registerables, type ChartConfiguration, type ChartData } from 'chart.js/auto';
import AnnotationPlugin, { type AnnotationOptions } from 'chartjs-plugin-annotation';
import 'chartjs-adapter-date-fns';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';

import {
  getRiverLevelsBySiteCode,
  type RiverLevel,
  type RiverDetail,
} from '../utility/data';

Chart.register(...registerables, AnnotationPlugin);

@customElement('river-level-chart')
export class RiverLevelChart extends LitElement {
  @property({ type: String })
  siteCode: string = '';

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
    if (changedProperties.has('siteCode') || changedProperties.has('riverDetail')) {
      // If riverDetail changed, it might imply siteCode should also be updated if derived,
      // or at least titles might need refresh. Fetching data ensures consistency.
      if (this.siteCode && this.riverDetail) {
        this.fetchData();
      } else {
        // siteCode or riverDetail is missing, clear chart and data
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
    if (!this.siteCode || this.siteCode.trim() === '') {
      console.debug(`Skipping fetchData for ${this.riverDetail?.siteName || 'Unknown Site'}: no siteCode provided.`);
      this.clearChartAndData();
      return;
    }
    if (!this.riverDetail) {
      console.debug(`Skipping fetchData for site code ${this.siteCode}: no riverDetail provided.`);
      this.clearChartAndData();
      return;
    }

    if (this._isFetchingOperationInProgress) {
      console.warn(`fetchData skipped for site code ${this.siteCode}: operation already in progress.`);
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
      const levels = await getRiverLevelsBySiteCode(this.siteCode);

      if (!this.isConnected) {
        console.debug(`Component disconnected for site code ${this.siteCode} after await. Aborting.`);
        this._isFetchingOperationInProgress = false; // Release lock
        return;
      }

      // API returns newest first, reverse for chronological chart
      this._levels = levels.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      this._hasData = this._levels.length > 0;

    } catch (err) {
      this._error = err instanceof Error ? err.message : "Failed to load river levels.";
      console.error(`Error fetching data for site code ${this.siteCode}:`, err);
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
        // Use unitCode from the first available level for the dataset label
        label: `Flow (${this._levels.length > 0 ? this._levels[0].unitCode : 'N/A'})`,
        data: this._levels.map(level => level.value),
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1,
        fill: false,
      }],
    };

    const lowAdvised = this.riverDetail?.lowAdvisedCFS;
    const highAdvised = this.riverDetail?.highAdvisedCFS;

    const hasLow = typeof lowAdvised === 'number';
    const hasHigh = typeof highAdvised === 'number';

    if (hasLow && hasHigh && lowAdvised >= highAdvised) { // Now hasLow and hasHigh are defined
      console.warn(`RiverLevelChart: Low advised CFS (${lowAdvised}) is not less than high advised CFS (${highAdvised}). Bands might overlap or not appear as expected.`);
    }

    // Prepare annotations
    const bandAnnotations = getBandAnnotations(lowAdvised, highAdvised, CHART_COLORS.bands);
    const lineAnnotations = getLineAnnotations(lowAdvised, highAdvised, CHART_COLORS.lines, CHART_COLORS.text.annotationLabelOnDarkBg);

    const allAnnotations = [...bandAnnotations, ...lineAnnotations];

    // Get the latest level for the subtitle
    const latestLevel = this._levels.length > 0 ? this._levels[this._levels.length - 1] : null;
    // Pre-condition: this.chartInstance should be null when this method is called.
    // The calling logic in `updated` ensures this.
    // If an old instance existed, it should have been destroyed by `fetchData` or `clearChartAndData`.
    const config: ChartConfiguration = {
        type: 'line',
        data: chartData,
        options: {
          responsive: true,
          maintainAspectRatio: true,
          layout: {
            padding: {
              // Padding between the bottom of the subtitle element (if displayed)
              // and the top of the chart plot area. The subtitle itself has its own
              // bottom padding (e.g., 10px via `plugins.subtitle.padding.bottom`).
              top: 15 // Reduced from 50 to minimize whitespace
            }
          },
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
              },
              grace: '5%' // Add 5% grace to the top/bottom of the scale to prevent clipping
            }
          },
          plugins: {
            subtitle: {
              display: !!latestLevel, // Only display if there's a latest level
              text: latestLevel ? `Current Level: ${latestLevel.value} ${latestLevel.unitCode}` : '',
              color: latestLevel
                ? getCurrentLevelLabelColor(
                    latestLevel.value,
                    lowAdvised,
                    highAdvised,
                    CHART_COLORS.text
                  )
                : CHART_COLORS.text.subtitleDefault,
              font: {
                size: 14, weight: 'bold'
              },
              padding: {
                top: 0, // Adjust spacing if needed
                bottom: 10 // Adds some space between subtitle and chart plot area
              }
            },
            annotation: {
              annotations: [
                ...allAnnotations
              ]
            }
          },
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
    const displayName = this.riverDetail?.siteName || this.siteCode || 'Loading River Data...';

    return html`
      <div class="river-info-container">
        <h2>${displayName}</h2>
        ${this.riverDetail ? html`
          <div class="details">
            <!-- Removed Site Code display -->
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
            ${this.riverDetail.comments ? html`
              <p><strong>Comments:</strong> ${unsafeHTML(linkify(this.riverDetail.comments))}</p>
            ` : ''}
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

const CHART_COLORS = {
  bands: {
    belowLow: 'rgba(255, 99, 132, 0.2)',    // Light red
    optimal: 'rgba(76, 175, 80, 0.2)',     // Light green
    aboveHigh: 'rgba(54, 162, 235, 0.2)',  // Light blue
  },
  lines: {
    low: 'rgba(200, 0, 0, 0.9)',           // Darker red
    high: 'rgba(0, 0, 200, 0.9)',          // Darker blue
  },
  text: {
    annotationLabelOnDarkBg: 'white',        // For text on colored line annotation labels (e.g., "Low: 100")
    subtitleDefault: 'rgba(0, 0, 0, 0.87)',  // Default subtitle text color (dark gray)
    subtitleLow: 'rgb(211, 47, 47)',         // More intense red for subtitle text when level is low
    subtitleOptimal: 'rgb(56, 142, 60)',     // Darker green for subtitle text when level is optimal
    subtitleHigh: 'rgb(25, 118, 210)',       // More intense blue for subtitle text when level is high
  },
};

/**
 * Generates box annotations for different river level zones.
 */
function getBandAnnotations(
  low: number | undefined,
  high: number | undefined,
  colors: typeof CHART_COLORS.bands
): AnnotationOptions[] {
  const bands: AnnotationOptions[] = [];
  const commonBoxOptions = {
    borderColor: 'transparent',
    borderWidth: 0,
    drawTime: 'beforeDatasetsDraw' as const,
  };

  // Band for levels below 'lowAdvised'
  if (typeof low === 'number') {
    bands.push({ type: 'box', yMax: low, backgroundColor: colors.belowLow, ...commonBoxOptions });
  }

  // Band for "optimal" or "advisable" levels
  if (typeof low === 'number' && typeof high === 'number' && low < high) {
    // Between low and high
    bands.push({ type: 'box', yMin: low, yMax: high, backgroundColor: colors.optimal, ...commonBoxOptions });
  } else if (typeof low === 'number' && typeof high !== 'number') {
    // No high defined, so optimal is above low
    bands.push({ type: 'box', yMin: low, backgroundColor: colors.optimal, ...commonBoxOptions });
  } else if (typeof high === 'number' && typeof low !== 'number') {
    // No low defined, so optimal is below high
    bands.push({ type: 'box', yMax: high, backgroundColor: colors.optimal, ...commonBoxOptions });
  }

  // Band for levels above 'highAdvised'
  if (typeof high === 'number') {
    bands.push({ type: 'box', yMin: high, backgroundColor: colors.aboveHigh, ...commonBoxOptions });
  }
  return bands;
}

/**
 * Generates line annotations for low and high advised levels.
 */
function getLineAnnotations(
  low: number | undefined,
  high: number | undefined,
  lineColors: typeof CHART_COLORS.lines,
  labelTextColor: string
): AnnotationOptions[] {
  const lines: AnnotationOptions[] = [];
  const commonLineOptions = {
    borderWidth: 1.5,
    borderDash: [6, 6],
  };
  const commonLabelOptions = {
    display: true,
    position: 'start' as const,
    color: labelTextColor,
    font: { size: 10 },
    padding: 3,
  };

  if (typeof low === 'number') {
    lines.push({
      type: 'line', yMin: low, yMax: low, borderColor: lineColors.low, ...commonLineOptions,
      label: { ...commonLabelOptions, content: `Low: ${low}`, backgroundColor: lineColors.low },
    } as AnnotationOptions);
  }
  if (typeof high === 'number') {
    lines.push({
      type: 'line', yMin: high, yMax: high, borderColor: lineColors.high, ...commonLineOptions,
      label: { ...commonLabelOptions, content: `High: ${high}`, backgroundColor: lineColors.high },
    } as AnnotationOptions);
  }
  return lines;
}

function getCurrentLevelLabelColor(
  value: number,
  low: number | undefined,
  high: number | undefined,
  textColors: Pick<typeof CHART_COLORS.text, 'subtitleLow' | 'subtitleOptimal' | 'subtitleHigh' | 'subtitleDefault'>
): string {
  if (typeof high === 'number' && value > high) return textColors.subtitleHigh;
  if (typeof low === 'number' && value < low) return textColors.subtitleLow;

  if (typeof low === 'number' && typeof high === 'number' && low < high && value >= low && value <= high) return textColors.subtitleOptimal;
  if (typeof low === 'number' && typeof high !== 'number' && value >= low) return textColors.subtitleOptimal;
  if (typeof high === 'number' && typeof low !== 'number' && value <= high) return textColors.subtitleOptimal;

  return textColors.subtitleDefault;
}

function linkify(text: string): string {
  // Matches http(s) URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, url => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
}
