import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  Chart,
  registerables,
  type ChartConfiguration,
  type ChartData,
} from "chart.js/auto";
import AnnotationPlugin, { type AnnotationOptions } from "chartjs-plugin-annotation";
import "chartjs-adapter-date-fns";
import { unsafeHTML } from "lit/directives/unsafe-html.js";

import {
  getRiverLevelsBySiteCode,
  type RiverLevel,
  type RiverDetail,
} from "../utility/data";

function linkify(text: string): string {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
}

Chart.register(...registerables, AnnotationPlugin);

const CHART_COLORS = {
  bands: {
    belowLow: "rgba(255, 99, 132, 0.2)",
    optimal: "rgba(76, 175, 80, 0.2)",
    aboveHigh: "rgba(54, 162, 235, 0.2)",
  },
  lines: {
    low: "rgba(200, 0, 0, 0.9)",
    high: "rgba(0, 0, 200, 0.9)",
  },
  text: {
    annotationLabelOnDarkBg: "white",
    subtitleDefault: "rgba(0, 0, 0, 0.87)",
    subtitleLow: "rgb(211, 47, 47)",
    subtitleOptimal: "rgb(56, 142, 60)",
    subtitleHigh: "rgb(25, 118, 210)",
  },
};

const INTERSECTION_OBSERVER_CONFIG = {
  root: null,
  threshold: 0.5,
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

function getBandAnnotations(low: number | undefined, high: number | undefined, colors: typeof CHART_COLORS.bands): AnnotationOptions[] {
  const common = {
    borderColor: "transparent",
    borderWidth: 0,
    drawTime: "beforeDatasetsDraw" as const,
  };

  const bands: AnnotationOptions[] = [];

  if (typeof low === "number") {
    bands.push({ type: "box", yMax: low, backgroundColor: colors.belowLow, ...common });
  }

  if (typeof low === "number" && typeof high === "number" && low < high) {
    bands.push({ type: "box", yMin: low, yMax: high, backgroundColor: colors.optimal, ...common });
  } else if (typeof low === "number") {
    bands.push({ type: "box", yMin: low, backgroundColor: colors.optimal, ...common });
  } else if (typeof high === "number") {
    bands.push({ type: "box", yMax: high, backgroundColor: colors.optimal, ...common });
  }

  if (typeof high === "number") {
    bands.push({ type: "box", yMin: high, backgroundColor: colors.aboveHigh, ...common });
  }

  return bands;
}

function getLineAnnotations(low: number | undefined, high: number | undefined, lines: typeof CHART_COLORS.lines, labelColor: string): AnnotationOptions[] {
  const commonLine = { borderWidth: 1.5, borderDash: [6, 6] };
  const label = {
    display: true,
    position: "start" as const,
    color: labelColor,
    font: { size: 10 },
    padding: 3,
  };

  const annotations: AnnotationOptions[] = [];

  if (typeof low === "number") {
    annotations.push({
      type: "line",
      yMin: low,
      yMax: low,
      borderColor: lines.low,
      ...commonLine,
      label: { ...label, content: `Low: ${low}`, backgroundColor: lines.low },
    });
  }

  if (typeof high === "number") {
    annotations.push({
      type: "line",
      yMin: high,
      yMax: high,
      borderColor: lines.high,
      ...commonLine,
      label: { ...label, content: `High: ${high}`, backgroundColor: lines.high },
    });
  }

  return annotations;
}

function getCurrentLevelLabelColor(value: number, low: number | undefined, high: number | undefined, colors: typeof CHART_COLORS.text): string {
  if (typeof low === "number" && value < low) return colors.subtitleLow;
  if (typeof low === "number" && typeof high === "number" && value >= low && value <= high) return colors.subtitleOptimal;
  if (typeof high === "number" && value > high) return colors.subtitleHigh;
  return colors.subtitleDefault;
}

@customElement("river-level-chart")
export class RiverLevelChart extends LitElement {
  @property({ type: String }) siteCode = "";
  @property({ type: Object }) riverDetail: RiverDetail | null = null;

  @state() private levels: RiverLevel[] = [];
  @state() private isLoading = false;
  @state() private error: string | null = null;
  @state() private hasData = false;
  @state() private shouldScrollIntoView = false;
  @state() private latestLevelValue: number | null = null;

  private chartInstance: Chart | null = null;
  private isFetchingInProgress = false;
  private intersectionObserver: IntersectionObserver | null = null;
  private observedElement: HTMLElement | null = null;
  private currentObservedId = "";

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

    .river-info-container h2 {
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

    .details strong {
      color: #333;
    }

    canvas {
      max-width: 100%;
      height: auto;
    }

    .loading,
    .error,
    .no-data {
      padding: 20px;
      text-align: center;
    }

    .no-data {
      color: #757575;
      font-style: italic;
    }
  `;

  protected willUpdate(changed: Map<string | number | symbol, unknown>) {
    if (changed.has("siteCode") || changed.has("riverDetail")) {
      if (this.siteCode && this.riverDetail) {
        const slug = slugify(this.displayName);
        if (window.location.hash === `#${slug}`) {
          this.shouldScrollIntoView = true;
        }
        this.fetchData();
      } else {
        this.clearChartAndData();
      }
    }
  }

  protected updated() {
    this.renderChartIfReady();
    this.updateIntersectionObserver();

    if (this.shouldScrollIntoView && this.hasData && !this.isLoading) {
      const slug = slugify(this.displayName);
      const target = this.shadowRoot?.getElementById(slug);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        this.shouldScrollIntoView = false;
      }
    }
  }

  protected firstUpdated() {
    // Scroll to this river if the slug matches the URL hash on initial load
    const slug = slugify(this.displayName);
    if (window.location.hash === `#${slug}`) {
      const target = this.shadowRoot?.getElementById(slug);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.cleanupChart();
    this.cleanupIntersectionObserver();
  }

  private static levelsCache: Record<string, RiverLevel[]> = {};

  private async fetchData(): Promise<void> {
    if (!this.siteCode || !this.riverDetail || this.isFetchingInProgress) return;

    this.isFetchingInProgress = true;
    this.isLoading = true;
    this.error = null;
    this.hasData = false;
    this.cleanupChart();

    try {
      if (RiverLevelChart.levelsCache[this.siteCode]) {
        this.levels = RiverLevelChart.levelsCache[this.siteCode];
      } else {
        const levels = await getRiverLevelsBySiteCode(this.siteCode);
        RiverLevelChart.levelsCache[this.siteCode] = levels;
        this.levels = levels;
      }
      this.levels = this.levels.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      this.latestLevelValue = this.levels.length > 0 ? this.levels[this.levels.length - 1].value : null;
      this.hasData = this.levels.length > 0;
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Failed to load river levels.";
      this.latestLevelValue = null; // Ensure reset on error
    } finally {
      this.isLoading = false;
      this.isFetchingInProgress = false;
      this.dispatchEvent(new CustomEvent('data-updated', { bubbles: true, composed: true }));
    }
  }

  /**
   * Provides a sort key for "runnable" status.
   * Lower numbers indicate higher priority (more runnable).
   * 0: Optimal/Runnable
   * 1: Not Optimal/Runnable (but criteria were clear, e.g., too low/high)
   * 2: Runnability criteria unclear or invalid (e.g., lowAdvised > highAdvised, or no advised levels)
   * 3: RiverDetail object missing (cannot determine advised CFS)
   * 4: Chart data is currently loading
   * 5: No chart data available
   */
  public get sortKeyRunnable(): number {
    if (this.isLoading) return 4;
    if (!this.hasData || this.latestLevelValue === null) return 5;
    if (!this.riverDetail) return 3;

    const value = this.latestLevelValue;
    const { lowAdvisedCFS: low, highAdvisedCFS: high } = this.riverDetail;
    const lowIsNum = typeof low === 'number';
    const highIsNum = typeof high === 'number';

    if (lowIsNum && highIsNum && low < high) { // Standard range
      if (value >= low && value <= high) return 0; // Optimal
    } else if (lowIsNum && !highIsNum) { // Only low defined
      if (value >= low) return 0; // Optimal
    } else if (!lowIsNum && highIsNum) { // Only high defined
      if (value <= high) return 0; // Optimal
    } else if (lowIsNum && highIsNum && low === high) { // Exact point
      if (value === low) return 0; // Optimal
    } else if (lowIsNum && highIsNum && low > high) {
      return 2; // Invalid range
    }

    if ((lowIsNum && highIsNum && low < high) || (lowIsNum && !highIsNum) || (!lowIsNum && highIsNum) || (lowIsNum && highIsNum && low === high)) {
      return 1; // Not optimal, but criteria existed
    }
    return 2; // Runnability criteria unclear/invalid
  }

  private renderChartIfReady(): void {
    if (this.isLoading || this.error || !this.hasData || this.chartInstance) return;

    const canvas = this.shadowRoot?.querySelector("#riverChartCanvas") as HTMLCanvasElement | null;
    if (canvas) {
      this.createChart(canvas);
      // No hash update here!
    }
  }

  private createChart(canvas: HTMLCanvasElement): void {
    const chartData = this.buildChartData();
    const config = this.buildChartConfig(chartData);
    this.chartInstance = new Chart(canvas, config);
  }

  private buildChartData(): ChartData {
    return {
      labels: this.levels.map((l) => new Date(l.timestamp)),
      datasets: [
        {
          label: `Flow (${this.levels[0]?.unitCode || "N/A"})`,
          data: this.levels.map((l) => l.value),
          borderColor: "rgb(75, 192, 192)",
          tension: 0.1,
          fill: false,
        },
      ],
    };
  }

  private buildChartConfig(chartData: ChartData): ChartConfiguration {
    const { lowAdvisedCFS: low, highAdvisedCFS: high } = this.riverDetail || {};
    const latestLevel = this.levels[this.levels.length - 1];

    const bandAnnotations = getBandAnnotations(low, high, CHART_COLORS.bands);
    const lineAnnotations = getLineAnnotations(low, high, CHART_COLORS.lines, CHART_COLORS.text.annotationLabelOnDarkBg);

    return {
      type: "line",
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: true,
        layout: { padding: { top: 15 } },
        scales: {
          x: {
            type: "time",
            time: {
              unit: "day",
              tooltipFormat: "MMM d, yyyy HH:mm",
              displayFormats: {
                hour: "MMM d, HH:mm",
                day: "MMM d",
                minute: "HH:mm",
                month: "MMM yyyy",
                year: "yyyy",
              },
            },
            title: { display: true, text: "Time" },
          },
          y: {
            title: {
              display: true,
              text: `Level (${this.levels[0]?.unitCode || "N/A"})`,
            },
            grace: "5%",
          },
        },
        plugins: {
          legend: { display: false },
          subtitle: {
            display: !!latestLevel,
            text: latestLevel ? `Current Level: ${latestLevel.value} ${latestLevel.unitCode}` : "",
            color: latestLevel ? getCurrentLevelLabelColor(latestLevel.value, low, high, CHART_COLORS.text) : CHART_COLORS.text.subtitleDefault,
            font: { size: 14, weight: "bold" },
            padding: { top: 0, bottom: 10 },
          },
          annotation: {
            annotations: [...bandAnnotations, ...lineAnnotations],
          },
        },
      },
    };
  }

  private updateIntersectionObserver(): void {
    const nameForId = this.riverDetail?.siteName || this.siteCode || "Loading River Data...";
    const expectedId = slugify(nameForId);

    if (this.currentObservedId === expectedId && this.observedElement) return;

    this.cleanupCurrentObservation();
    this.currentObservedId = expectedId;

    if (!expectedId) return;

    const containerElement = this.shadowRoot?.getElementById(expectedId) as HTMLElement | null;
    if (!containerElement) return;

    this.initializeIntersectionObserver();
    this.intersectionObserver?.observe(containerElement);
    this.observedElement = containerElement;
  }

  private initializeIntersectionObserver(): void {
    if (this.intersectionObserver) return;
    this.intersectionObserver = new IntersectionObserver(this.handleIntersection.bind(this), INTERSECTION_OBSERVER_CONFIG);
  }

  private cleanupCurrentObservation(): void {
    if (this.intersectionObserver && this.observedElement) {
      this.intersectionObserver.unobserve(this.observedElement);
      this.observedElement = null;
    }
  }

  private clearChartAndData(): void {
    this.cleanupChart();
    this.levels = [];
    this.hasData = false;
    this.error = null;
    this.latestLevelValue = null;
    this.isLoading = false;
  }

  private cleanupChart(): void {
    this.chartInstance?.destroy();
    this.chartInstance = null;
  }

  private cleanupIntersectionObserver(): void {
    if (this.intersectionObserver) {
      if (this.observedElement) {
        this.intersectionObserver.unobserve(this.observedElement);
      }
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }
    this.observedElement = null;
    this.currentObservedId = "";
  }

  public get displayName(): string {
    return this.riverDetail?.siteName || this.siteCode || "Loading River Data...";
  }

  private handleClick() {
    const slug = slugify(this.displayName);
    history.replaceState(null, "", `#${slug}`);
    this.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  private renderRiverDetails() {
    if (!this.riverDetail) return html`<p>River details not available.</p>`;

    const { americanWhitewaterLink, lowAdvisedCFS, highAdvisedCFS, comments, gaugeSource, localWeatherNOAA } = this.riverDetail;

    return html`
      <div class="details">
        ${americanWhitewaterLink ? html`
          <p><a href="${americanWhitewaterLink}" target="_blank">American Whitewater Details</a></p>
        ` : ""}
        <p><strong>Advised Flow (CFS):</strong> Low: ${lowAdvisedCFS ?? "N/A"} - High: ${highAdvisedCFS ?? "N/A"}</p>
        ${comments ? html`
          <p><strong>Comments:</strong> ${unsafeHTML(linkify(comments))}</p>
        ` : ""}
        ${gaugeSource ? html`
          <p><strong>Gauge Source:</strong> <a href="${gaugeSource}" target="_blank">Link</a></p>
        ` : ""}
        ${localWeatherNOAA ? html`
          <p><strong>NOAA Weather:</strong> <a href="${localWeatherNOAA}" target="_blank">Link</a></p>
        ` : ""}
      </div>
    `;
  }

  private renderChartContainer() {
    const name = this.displayName;
    if (this.isLoading) return html`<div class="loading">Loading level data for ${name}...</div>`;
    if (this.error) return html`<div class="error">Error loading level data: ${this.error}</div>`;
    if (this.hasData) return html`<canvas id="riverChartCanvas"></canvas>`;
    return html`<div class="no-data">No river gauge data available for ${name}.</div>`;
  }

  render() {
    const slug = slugify(this.displayName);

    return html`
      <div
        class="river-info-container"
        id="${slug}"
        @click=${this.handleClick}
        style="cursor: pointer;"
        tabindex="0"
        role="button"
        aria-label="Show details for ${this.displayName}"
      >
        <h2>${this.displayName}</h2>
        ${this.renderRiverDetails()}
        <div class="chart-status-container">
          ${this.renderChartContainer()}
        </div>
      </div>
    `;
  }

  private handleIntersection(_entries: IntersectionObserverEntry[]) {
    // You can implement logic here if you want to react to visibility changes.
    // For now, this can be left empty or used for debugging.
  }
}
