import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Chart, registerables, type ChartConfiguration, type ChartData } from "chart.js/auto";
import AnnotationPlugin, { type AnnotationOptions } from "chartjs-plugin-annotation";
import "chartjs-adapter-date-fns";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { getRiverLevelsBySiteCode, type RiverLevel, type RiverDetail } from "../utility/data";
import { slugify } from "../utility/string-utils";

Chart.register(...registerables, AnnotationPlugin);
import { CHART_COLORS } from "../utility/chart-colors";

function linkify(text: string): string {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
}

function getCurrentLevelColor(value: number, low: number | undefined, high: number | undefined): string {
  if (typeof low === "number" && value < low) return CHART_COLORS.text.subtitleLow;
  if (typeof low === "number" && typeof high === "number" && value >= low && value <= high) return CHART_COLORS.text.subtitleOptimal;
  if (typeof high === "number" && value > high) return CHART_COLORS.text.subtitleHigh;
  return CHART_COLORS.text.subtitleDefault;
}

@customElement("river-level-chart")
export class RiverLevelChart extends LitElement {
  @property({ type: String }) siteCode = "";
  @property({ type: Object }) riverDetail: RiverDetail | null = null;

  @state() private levels: RiverLevel[] = [];
  @state() private isLoading = false;
  @state() private error: string | null = null;
  @state() private latestValue: number | null = null;

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
    }
    :host(:hover) {
      background-color: #f5f5f5;
    }
    h2 {
      margin-top: 0;
      cursor: pointer;
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

    @media (max-width: 768px) {
      :host {
        padding: 16px 8px; /* Reduced left/right padding for mobile */
      }
    }
  `;

  protected async willUpdate(changed: Map<string | number | symbol, unknown>) {
    if ((changed.has("siteCode") || changed.has("riverDetail")) && this.siteCode && this.riverDetail) {
      await this.fetchData();
    }
  }

  protected updated() {
    this.renderChart();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.destroyChart();
  }

  public get displayName(): string {
    return this.riverDetail?.siteName || this.siteCode || "Loading...";
  }

  public get sortKeyRunnable(): number {
    if (this.isLoading) return 4;
    if (!this.levels.length || this.latestValue === null) return 5;
    if (!this.riverDetail) return 3;

    const { lowAdvisedCFS: low, highAdvisedCFS: high } = this.riverDetail;
    const value = this.latestValue;

    // Check if we have valid range criteria
    const lowIsNum = typeof low === 'number';
    const highIsNum = typeof high === 'number';

    if (lowIsNum && highIsNum && low < high) {
      // Standard range: low < high
      return (value >= low && value <= high) ? 0 : 1;
    } else if (lowIsNum && !highIsNum) {
      // Only low threshold
      return value >= low ? 0 : 1;
    } else if (!lowIsNum && highIsNum) {
      // Only high threshold
      return value <= high ? 0 : 1;
    } else if (lowIsNum && highIsNum && low === high) {
      // Exact point
      return value === low ? 0 : 1;
    }

    return 2; // Invalid or unclear criteria
  }

  private async fetchData(): Promise<void> {
    if (!this.siteCode) return;

    this.isLoading = true;
    this.error = null;

    try {
      // Use cache if available
      if (RiverLevelChart.cache[this.siteCode]) {
        this.levels = RiverLevelChart.cache[this.siteCode];
      } else {
        const levels = await getRiverLevelsBySiteCode(this.siteCode);
        this.levels = levels.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        RiverLevelChart.cache[this.siteCode] = this.levels;
      }

      this.latestValue = this.levels.length > 0 ? this.levels[this.levels.length - 1].value : null;
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Failed to load data";
      this.latestValue = null;
    } finally {
      this.isLoading = false;
    }
  }

  private getDisplayUnit(unitCode: string | undefined): string {
    if (unitCode === 'ft3/s') {
      return 'Cubic Feet Per Second (CFS)';
    }
    return unitCode || "N/A";
  }

  private renderChart(): void {
    if (this.isLoading || this.error || !this.levels.length) {
      this.destroyChart();
      return;
    }

    const canvas = this.shadowRoot?.querySelector("canvas") as HTMLCanvasElement;
    if (!canvas) return;

    // Always destroy existing chart before creating new one
    this.destroyChart();

    // Small delay to ensure canvas is ready after DOM operations
    requestAnimationFrame(() => {
      const chartData: ChartData = {
        labels: this.levels.map(l => new Date(l.timestamp)),
        datasets: [{
          label: `Flow (${this.getDisplayUnit(this.levels[0]?.unitCode)})`,
          data: this.levels.map(l => l.value),
          borderColor: "rgb(75, 192, 192)",
          tension: 0.1,
          fill: false,
        }],
      };

      const config = this.buildChartConfig(chartData);
      this.chart = new Chart(canvas, config);
    });
  }

  // Public method to rebuild chart after DOM reordering
  public rebuildChart(): void {
    if (this.levels.length > 0 && !this.isLoading && !this.error) {
      this.renderChart();
    }
  }

  private buildChartConfig(chartData: ChartData): ChartConfiguration {
    const { lowAdvisedCFS: low, highAdvisedCFS: high } = this.riverDetail || {};
    const latest = this.levels[this.levels.length - 1];
    const currentUnitDisplay = this.getDisplayUnit(latest?.unitCode);

    return {
      type: "line",
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 1.5, // Default is 2. Smaller value makes chart taller for its width.
        scales: {
          x: {
            type: "time",
            time: {
              unit: "day",
              tooltipFormat: "MMM d, yyyy h:mm a", // Changed to 12-hour format with AM/PM
              displayFormats: { // Added to ensure axis labels also use 12-hour format if hours are shown
                hour: "h a",
                minute: "h:mm a",
                second: "h:mm:ss a"
                // You can add other formats (day, week, month, etc.) if needed
              }
            },
            title: { display: true, text: "Time" },
          },
          y: {
            title: { display: true, text: `Level (${currentUnitDisplay})` },
            grace: "5%",
          },
        },
        plugins: {
          legend: { display: false },
          subtitle: {
            display: !!latest,
            text: latest ? `Current Flow: ${latest.value} ${currentUnitDisplay}` : "",
            color: latest ? getCurrentLevelColor(latest.value, low, high) : CHART_COLORS.text.subtitleDefault,
            font: { size: 14, weight: "bold" },
            padding: { bottom: 10 },
          },
          annotation: {
            annotations: this.buildAnnotations(low, high),
          },
        },
      },
    };
  }

  private buildAnnotations(low: number | undefined, high: number | undefined): AnnotationOptions[] {
    const annotations: AnnotationOptions[] = [];
    const common = { borderWidth: 0, drawTime: "beforeDatasetsDraw" as const };

    // Background bands
    if (typeof low === "number") {
      annotations.push({ type: "box", yMax: low, backgroundColor: CHART_COLORS.bands.belowLow, ...common });
    }

    if (typeof low === "number" && typeof high === "number" && low < high) {
      annotations.push({ type: "box", yMin: low, yMax: high, backgroundColor: CHART_COLORS.bands.optimal, ...common });
    } else if (typeof low === "number") {
      annotations.push({ type: "box", yMin: low, backgroundColor: CHART_COLORS.bands.optimal, ...common });
    } else if (typeof high === "number") {
      annotations.push({ type: "box", yMax: high, backgroundColor: CHART_COLORS.bands.optimal, ...common });
    }

    if (typeof high === "number") {
      annotations.push({ type: "box", yMin: high, backgroundColor: CHART_COLORS.bands.aboveHigh, ...common });
    }

    // Threshold lines
    const lineCommon = { borderWidth: 1.5, borderDash: [6, 6] };
    const label = { display: true, position: "start" as const, color: "white", font: { size: 10 }, padding: 3 };

    if (typeof low === "number") {
      annotations.push({
        type: "line", yMin: low, yMax: low, borderColor: CHART_COLORS.lines.low, ...lineCommon,
        label: { ...label, content: `Low: ${low}`, backgroundColor: CHART_COLORS.lines.low },
      });
    }

    if (typeof high === "number") {
      annotations.push({
        type: "line", yMin: high, yMax: high, borderColor: CHART_COLORS.lines.high, ...lineCommon,
        label: { ...label, content: `High: ${high}`, backgroundColor: CHART_COLORS.lines.high },
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

  render() {
    const slug = slugify(this.displayName);

    return html`
      <div id="${slug}" @click=${this.handleClick} style="cursor: pointer;" tabindex="0">
        <h2>${this.displayName}</h2>

        ${this.riverDetail ? html`
          <div class="details">
            ${this.riverDetail.americanWhitewaterLink ? html`
              <p><a href="${this.riverDetail.americanWhitewaterLink}" target="_blank">American Whitewater</a></p>
            ` : ""}
            <p><strong>Advised Flow:</strong> ${this.riverDetail.lowAdvisedCFS ?? "N/A"} - ${this.riverDetail.highAdvisedCFS ?? "N/A"} CFS</p>
            ${this.riverDetail.comments ? html`
              <p><strong>Comments:</strong> ${unsafeHTML(linkify(this.riverDetail.comments))}</p>
            ` : ""}
            ${this.riverDetail.gaugeSource ? html`
              <p><strong>Gauge:</strong> <a href="${this.riverDetail.gaugeSource}" target="_blank">Link</a></p>
            ` : ""}
            ${this.riverDetail.localWeatherNOAA ? html`
              <p><strong>Weather:</strong> <a href="${this.riverDetail.localWeatherNOAA}" target="_blank">NOAA</a></p>
            ` : ""}
          </div>
        ` : ""}

        ${this.isLoading ? html`
          <div class="loading">Loading data...</div>
        ` : this.error ? html`
          <div class="error">Error: ${this.error}</div>
        ` : this.levels.length ? html`
          <canvas></canvas>
        ` : null}
      </div>
    `;
  }
}
