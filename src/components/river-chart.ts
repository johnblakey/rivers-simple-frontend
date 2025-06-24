import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Chart, registerables, type ChartConfiguration } from "chart.js/auto";
import AnnotationPlugin, { type AnnotationOptions } from "chartjs-plugin-annotation";
import "chartjs-adapter-date-fns";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { getRiverLevelsBySiteCode, type RiverLevel, type RiverDetail } from "../utility/data-service";
import { slugify } from "../utility/string-utils";
import { CHART_COLORS } from "../utility/chart-colors";

Chart.register(...registerables, AnnotationPlugin);

// Helper functions
const linkify = (text: string) => text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');

const getCurrentLevelColor = (value: number, low?: number, high?: number): string => {
  if (low !== undefined && value < low) return CHART_COLORS.text.subtitleLow;
  if (low !== undefined && high !== undefined && value >= low && value <= high) return CHART_COLORS.text.subtitleOptimal;
  if (high !== undefined && value > high) return CHART_COLORS.text.subtitleHigh;
  return CHART_COLORS.text.subtitleDefault;
};

const getDisplayUnit = (unitCode?: string, short = false) => {
  if (unitCode === 'ft3/s') return short ? 'CFS' : 'Cubic Feet Per Second (CFS)';
  return unitCode ?? 'N/A';
};

@customElement("river-level-chart")
export class RiverLevelChart extends LitElement {
  @property({ type: String }) siteCode = "";
  @property({ type: Object }) riverDetail: RiverDetail | null = null;

  @state() private levels: RiverLevel[] = [];
  @state() private isLoading = false;
  @state() private error: string | null = null;
  @state() private isLoadComplete = false;

  private chart: Chart | null = null;
  private static cache: Record<string, RiverLevel[]> = {};

  static styles = css`
    :host {
      display: block;
      margin: 16px;
      padding: 16px;
      border: 1px solid #ccc;
      border-radius: 8px;
      max-width: 800px;
      transition: background-color 0.3s ease;
      cursor: pointer;
    }
    :host(:hover) { background-color: #f5f5f5; }

    h2 { margin-top: 0; }

    .details {
      margin-bottom: 16px;
      padding-bottom: 16px;
      border-bottom: 1px solid #eee;
    }

    .details, .details-below {
      p {
        margin: 8px 0;
        font-size: 0.95em;
        color: #455a64;
        line-height: 1.5;
      }
      strong { color: #263238; font-weight: 600; }
      a {
        color: #007bff;
        text-decoration: none;
        font-weight: 500;
        border-bottom: 1px solid transparent;
        transition: all 0.2s ease;
      }
      a:hover, a:focus {
        color: #0056b3;
        border-bottom-color: #0056b3;
      }
    }

    .details-below { margin-top: 16px; }
    canvas { max-width: 100%; height: auto; }
    .loading, .error { padding: 20px; text-align: center; }
    .error { color: #d32f2f; }

    @media (max-width: 768px) {
      :host { padding: 16px 8px; }
    }
  `;

  get displayName() { return this.riverDetail?.siteName || this.siteCode || "Loading..."; }
  get latestValue() { return this.levels.length > 0 ? this.levels[this.levels.length - 1].value : null; }
  get hasValidRange() { return this.riverDetail && (this.riverDetail.lowAdvisedCFS || this.riverDetail.highAdvisedCFS); }

  get sortKeyRunnable(): number {
    if (this.isLoading) return 4;
    if (!this.riverDetail) return 3;
    if (!this.levels.length || this.latestValue === null) return 5;

    const { lowAdvisedCFS: low, highAdvisedCFS: high } = this.riverDetail;
    const value = this.latestValue;

    if (low !== undefined && high !== undefined) {
      if (low < high) return (value >= low && value <= high) ? 0 : 1;
      if (low === high) return value === low ? 0 : 1;
    }
    if (low !== undefined && !high) return value >= low ? 0 : 1;
    if (high !== undefined && !low) return value <= high ? 0 : 1;
    return 2;
  }

  /** Indicates whether the initial data fetch for this chart has completed. */
  get loadCompleted(): boolean {
    return this.isLoadComplete;
  }

  protected async willUpdate(changed: Map<string | number | symbol, unknown>) {
    if ((changed.has("siteCode") || changed.has("riverDetail")) && this.siteCode && this.riverDetail) {
      this.isLoadComplete = false; // Reset load completion state
      await this.fetchData();
    }
  }

  protected updated(changedProperties: Map<string | number | symbol, unknown>) {
    if (changedProperties.has("levels") && this.levels.length > 0) {
      this.renderChart();
    }
  }
  disconnectedCallback() { super.disconnectedCallback(); this.destroyChart(); }

  private dispatchChartLoadedEvent(): void {
    this.dispatchEvent(new CustomEvent('chart-loaded', {
      bubbles: true,
      composed: true,
      detail: { siteCode: this.siteCode }
    }));
  }

  private async fetchData(): Promise<void> {
    if (!this.siteCode) return;

    this.isLoading = true;
    this.error = null;

    try {
      if (RiverLevelChart.cache[this.siteCode]) {
        this.levels = RiverLevelChart.cache[this.siteCode];
      } else {
        const levels = await getRiverLevelsBySiteCode(this.siteCode);
        this.levels = levels.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        RiverLevelChart.cache[this.siteCode] = this.levels;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load data";
      this.error = errorMessage;
    } finally {
      this.isLoading = false;
      this.isLoadComplete = true;
      // Emit the chart-loaded event after data loading is complete
      this.dispatchChartLoadedEvent();
    }
  }

  private renderChart(): void {
    if (this.isLoading || this.error || !this.levels.length) {
      this.destroyChart();
      return;
    }

    const canvas = this.shadowRoot?.querySelector("canvas") as HTMLCanvasElement;
    if (!canvas) return;

    this.destroyChart();
    requestAnimationFrame(() => {
      this.chart = new Chart(canvas, this.createChartConfig());
    });
  }

  private createChartConfig(): ChartConfiguration {
    const { lowAdvisedCFS: low, highAdvisedCFS: high } = this.riverDetail || {};
    const latest = this.levels[this.levels.length - 1];
    const isMobile = window.innerWidth <= 500;
    const unitDisplay = getDisplayUnit(latest?.unitCode, isMobile);

    return {
      type: "line",
      data: {
        labels: this.levels.map(l => new Date(l.timestamp)),
        datasets: [{
          label: getDisplayUnit(this.levels[0]?.unitCode),
          data: this.levels.map(l => l.value),
          borderColor: "rgb(75, 192, 192)",
          tension: 0.1,
          fill: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 1.5,
        scales: {
          x: {
            type: "time",
            time: {
              unit: "day",
              tooltipFormat: "MMM d, yyyy h:mm a",
              displayFormats: { hour: "h a", minute: "h:mm a", second: "h:mm:ss a" }
            },
            title: { display: true, text: "Time" },
          },
          y: {
            title: { display: true, text: unitDisplay },
            grace: "5%",
          },
        },
        plugins: {
          legend: { display: false },
          subtitle: {
            display: !!latest,
            text: latest ? `Current Flow: ${latest.value} ${unitDisplay}` : "",
            color: latest ? getCurrentLevelColor(latest.value, low, high) : CHART_COLORS.text.subtitleDefault,
            font: { size: isMobile ? 12 : 14, weight: "bold" },
            padding: { bottom: 10 },
          },
          annotation: { annotations: this.createAnnotations(low, high) },
        },
      },
    };
  }

  private createAnnotations(low?: number, high?: number): AnnotationOptions[] {
    const annotations: AnnotationOptions[] = [];
    const common = { borderWidth: 0, drawTime: "beforeDatasetsDraw" as const };
    const lineCommon = { borderWidth: 1.5, borderDash: [6, 6] };
    const labelCommon = { display: true, position: "start" as const, color: "white", font: { size: 10 }, padding: 3 };

    // Background bands
    if (low !== undefined) {
      annotations.push({ type: "box", yMax: low, backgroundColor: CHART_COLORS.bands.belowLow, ...common });
    }
    if (low !== undefined && high !== undefined && low < high) {
      annotations.push({ type: "box", yMin: low, yMax: high, backgroundColor: CHART_COLORS.bands.optimal, ...common });
    } else if (low !== undefined) {
      annotations.push({ type: "box", yMin: low, backgroundColor: CHART_COLORS.bands.optimal, ...common });
    } else if (high !== undefined) {
      annotations.push({ type: "box", yMax: high, backgroundColor: CHART_COLORS.bands.optimal, ...common });
    }
    if (high !== undefined) {
      annotations.push({ type: "box", yMin: high, backgroundColor: CHART_COLORS.bands.aboveHigh, ...common });
    }

    // Threshold lines
    if (low !== undefined) {
      annotations.push({
        type: "line", yMin: low, yMax: low, borderColor: CHART_COLORS.lines.low, ...lineCommon,
        label: { ...labelCommon, content: `Low: ${low}`, backgroundColor: CHART_COLORS.lines.low },
      });
    }
    if (high !== undefined) {
      annotations.push({
        type: "line", yMin: high, yMax: high, borderColor: CHART_COLORS.lines.high, ...lineCommon,
        label: { ...labelCommon, content: `High: ${high}`, backgroundColor: CHART_COLORS.lines.high },
      });
    }

    return annotations;
  }

  private destroyChart(): void {
    this.chart?.destroy();
    this.chart = null;
  }

  private handleClick(): void {
    const slug = slugify(this.displayName);
    history.replaceState(null, "", `#${slug}`);
    this.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  public rebuildChart(): void {
    if (this.levels.length > 0 && !this.isLoading && !this.error) {
      this.renderChart();
    }
  }

  private renderDetails() {
    if (!this.riverDetail) return null;

    const { americanWhitewaterLink, lowAdvisedCFS, highAdvisedCFS } = this.riverDetail;
    const showFlowRange = !(lowAdvisedCFS === 0 && highAdvisedCFS === 0);

    return html`
      <div class="details">
        ${americanWhitewaterLink ? html`
          <p><a href="${americanWhitewaterLink}" target="_blank">American Whitewater</a></p>
        ` : ''}
        ${showFlowRange ? html`
          <p><strong>Advised Flow:</strong> ${lowAdvisedCFS ?? "N/A"} - ${highAdvisedCFS ?? "N/A"} CFS</p>
        ` : ''}
      </div>
    `;
  }

  private renderDetailsBelow() {
    if (!this.riverDetail) return null;

    const { comments, gaugeSource, localWeatherNOAA } = this.riverDetail;

    return html`
      <div class="details-below">
        ${comments ? html`
          <p><strong>Comments:</strong> ${unsafeHTML(linkify(comments))}</p>
        ` : ''}
        ${gaugeSource || localWeatherNOAA ? html`
          <p>
            ${gaugeSource ? html`<strong>Gauge:</strong> <a href="${gaugeSource}" target="_blank">Link</a>` : ''}
            ${gaugeSource && localWeatherNOAA ? ' | ' : ''}
            ${localWeatherNOAA ? html`<strong>Weather:</strong> <a href="${localWeatherNOAA}" target="_blank">NOAA</a>` : ''}
          </p>
        ` : ''}
      </div>
    `;
  }

  render() {
    const slug = slugify(this.displayName);

    return html`
      <div id="${slug}" @click=${this.handleClick} tabindex="0">
        <h2>${this.displayName}</h2>
        ${this.renderDetails()}

        ${this.isLoading ? html`<div class="loading">Loading data...</div>` :
          this.error ? html`<div class="error">Error: ${this.error}</div>` :
          this.levels.length ? html`<canvas></canvas>` : null}

        ${this.renderDetailsBelow()}
      </div>
    `;
  }
}
