// src/components/river-chart/river-chart-canvas.ts
import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Chart, registerables, type ChartConfiguration } from "chart.js/auto";
import AnnotationPlugin, { type AnnotationOptions } from "chartjs-plugin-annotation";
import "chartjs-adapter-date-fns";
import { getRiverLevelsBySiteCode, type RiverLevel, type RiverDetail } from "../../utility/data-service";
import { CHART_COLORS } from "../../utility/chart-colors";

Chart.register(...registerables, AnnotationPlugin);

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

@customElement("river-chart-canvas")
export class RiverChartCanvas extends LitElement {
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
    }

    canvas {
      max-width: 100%;
      height: auto;
    }

    .loading, .error {
      padding: 20px;
      text-align: center;
    }

    .error {
      color: #d32f2f;
    }
  `;

  get loadCompleted(): boolean {
    return this.isLoadComplete;
  }

  protected async willUpdate(changed: Map<string | number | symbol, unknown>) {
    if ((changed.has("siteCode") || changed.has("riverDetail")) && this.siteCode && this.riverDetail) {
      this.isLoadComplete = false;
      await this.fetchData();
    }
  }

  protected updated(changedProperties: Map<string | number | symbol, unknown>) {
    if (changedProperties.has("levels") && this.levels.length > 0) {
      this.renderChart();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.destroyChart();
  }

  private async fetchData(): Promise<void> {
    if (!this.siteCode) return;

    this.isLoading = true;
    this.error = null;

    try {
      if (RiverChartCanvas.cache[this.siteCode]) {
        this.levels = RiverChartCanvas.cache[this.siteCode];
      } else {
        const levels = await getRiverLevelsBySiteCode(this.siteCode);
        this.levels = levels.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        RiverChartCanvas.cache[this.siteCode] = this.levels;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load data";
      this.error = errorMessage;
    } finally {
      this.isLoading = false;
      this.isLoadComplete = true;
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

  public rebuildChart(): void {
    if (this.levels.length > 0 && !this.isLoading && !this.error) {
      this.renderChart();
    }
  }

  render() {
    return html`
      ${this.isLoading ? html`<div class="loading">Loading data...</div>` :
        this.error ? html`<div class="error">Error: ${this.error}</div>` :
        this.levels.length ? html`<canvas></canvas>` : null}
    `;
  }
}
