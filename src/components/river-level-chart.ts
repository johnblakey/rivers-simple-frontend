import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  Chart,
  registerables,
  type ChartConfiguration,
  type ChartData,
} from "chart.js/auto";
import AnnotationPlugin, {
  type AnnotationOptions,
} from "chartjs-plugin-annotation";
import "chartjs-adapter-date-fns";
import { unsafeHTML } from "lit/directives/unsafe-html.js";

import {
  getRiverLevelsBySiteCode,
  type RiverLevel,
  type RiverDetail,
} from "../utility/data";

Chart.register(...registerables, AnnotationPlugin);

@customElement("river-level-chart")
export class RiverLevelChart extends LitElement {
  @property({ type: String }) siteCode = "";
  @property({ type: Object }) riverDetail: RiverDetail | null = null;

  @state() private _levels: RiverLevel[] = [];
  @state() private _isLoading = false;
  @state() private _error: string | null = null;
  @state() private _hasData = false;

  // Chart instance
  private chartInstance: Chart | null = null;
  // Fetching state
  private _isFetchingOperationInProgress = false;

  // Intersection Observer properties
  private _intersectionObserver: IntersectionObserver | null = null;
  private _observedElement: HTMLElement | null = null;
  private _currentObservedId: string = ""; // Tracks the ID of the element currently targeted by the observer

  protected willUpdate(changed: Map<string | number | symbol, unknown>) {
    if (changed.has("siteCode") || changed.has("riverDetail")) {
      if (this.siteCode && this.riverDetail) {
        this.fetchData();
      } else {
        this.clearChartAndData();
      }
    }
  }

  protected updated(changedProperties: Map<string | number | symbol, unknown>) {
    super.updated(changedProperties); // Call super.updated()

    // Original chart rendering logic
    if (
      !this._isLoading &&
      !this._error &&
      this._hasData &&
      !this.chartInstance
    ) {
      const canvas = this.shadowRoot?.querySelector(
        "#riverChartCanvas",
      ) as HTMLCanvasElement | null;
      if (canvas) this.renderChart(canvas);
    }

    // Intersection Observer setup/update logic
    // Determine the ID that would be rendered for the main container.
    // This must match the ID generation in the render() method.
    const nameForId = this.riverDetail?.siteName || this.siteCode || "Loading River Data...";
    const expectedId = nameForId ? this._slugify(nameForId) : "";

    // If the expected ID has changed from what we are currently observing,
    // or if we have an expected ID but nothing is observed yet (initial setup).
    if (this._currentObservedId !== expectedId || (expectedId && !this._observedElement)) {
      // If we were observing an old element, unobserve it.
      if (this._intersectionObserver && this._observedElement) {
        this._intersectionObserver.unobserve(this._observedElement);
      }

      this._observedElement = null; // Reset the reference to the observed element.
      this._currentObservedId = expectedId; // Update to the new ID we intend to observe.

      if (this._currentObservedId) { // Only proceed if there's a valid ID to observe.
        // Query for the element using the current ID. This happens after render, so it should exist.
        const containerElement = this.shadowRoot?.querySelector(`#${this._currentObservedId}`) as HTMLElement | null;

        if (containerElement) {
          if (!this._intersectionObserver) {
            // Initialize the IntersectionObserver if it doesn't exist.
            this._intersectionObserver = new IntersectionObserver(
              this._handleIntersection.bind(this),
              {
                root: null, // Observing intersections with the viewport.
                threshold: 0.5, // Trigger when 50% of the target is visible.
                                // Adjust threshold or use rootMargin for finer control.
                                // e.g., rootMargin: "-40% 0px -40% 0px" could target when the middle 20% is visible.
              }
            );
          }
          // Start observing the new target element.
          this._intersectionObserver.observe(containerElement);
          this._observedElement = containerElement; // Store a reference to the currently observed element.
        }
      } else if (this._intersectionObserver && this._observedElement) {
        // If expectedId became empty but we were observing something, unobserve it.
        this._intersectionObserver.unobserve(this._observedElement);
        this._observedElement = null;
      }
    }
  }

  private clearChartAndData() {
    this.chartInstance?.destroy();
    this.chartInstance = null;
    this._levels = [];
    this._hasData = false;
    this._error = null;
    this._isLoading = false;
  }

  async fetchData() {
    if (!this.siteCode || !this.riverDetail) {
      this.clearChartAndData();
      return;
    }
    if (this._isFetchingOperationInProgress) return;

    this._isFetchingOperationInProgress = true;
    this._isLoading = true;
    this._error = null;
    this._hasData = false;

    this.chartInstance?.destroy();
    this.chartInstance = null;

    try {
      const levels = await getRiverLevelsBySiteCode(this.siteCode);
      if (!this.isConnected) return;

      this._levels = levels.sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );
      this._hasData = this._levels.length > 0;
    } catch (err) {
      this._error =
        err instanceof Error ? err.message : "Failed to load river levels.";
    } finally {
      this._isLoading = false;
      this._isFetchingOperationInProgress = false;
    }
  }

  private renderChart(canvas: HTMLCanvasElement) {
    const chartData: ChartData = {
      labels: this._levels.map((l) => new Date(l.timestamp)),
      datasets: [
        {
          label: `Flow (${this._levels[0]?.unitCode || "N/A"})`,
          data: this._levels.map((l) => l.value),
          borderColor: "rgb(75, 192, 192)",
          tension: 0.1,
          fill: false,
        },
      ],
    };

    const low = this.riverDetail?.lowAdvisedCFS;
    const high = this.riverDetail?.highAdvisedCFS;

    const bandAnnotations = getBandAnnotations(low, high, CHART_COLORS.bands);
    const lineAnnotations = getLineAnnotations(
      low,
      high,
      CHART_COLORS.lines,
      CHART_COLORS.text.annotationLabelOnDarkBg,
    );
    const latestLevel = this._levels[this._levels.length - 1];

    const config: ChartConfiguration = {
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
              text: `Level (${this._levels[0]?.unitCode || "N/A"})`,
            },
            grace: "5%",
          },
        },
        plugins: {
          subtitle: {
            display: !!latestLevel,
            text: latestLevel
              ? `Current Level: ${latestLevel.value} ${latestLevel.unitCode}`
              : "",
            color: latestLevel
              ? getCurrentLevelLabelColor(
                  latestLevel.value,
                  low,
                  high,
                  CHART_COLORS.text,
                )
              : CHART_COLORS.text.subtitleDefault,
            font: { size: 14, weight: "bold" },
            padding: { top: 0, bottom: 10 },
          },
          annotation: {
            annotations: [...bandAnnotations, ...lineAnnotations],
          },
        },
      },
    };

    this.chartInstance = new Chart(canvas, config);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.chartInstance?.destroy();
    this.chartInstance = null;

    // Clean up Intersection Observer
    if (this._intersectionObserver) {
      if (this._observedElement) { // Check if _observedElement exists before trying to unobserve
        this._intersectionObserver.unobserve(this._observedElement);
      }
      this._intersectionObserver.disconnect(); // Disconnect the observer entirely
      this._intersectionObserver = null;
    }
    this._observedElement = null;
    this._currentObservedId = "";
  }

  render() {
    const name =
      this.riverDetail?.siteName || this.siteCode || "Loading River Data...";

    // Note: The 'linkify' function is used here but not defined within this file.
    // Ensure it's available in the scope (e.g., imported or globally defined).

    return html`
      <div class="river-info-container" id="${this._slugify(name)}">
        <div class="river-info-container">
          <h2>${name}</h2>
          ${this.riverDetail
            ? html`
                <div class="details">
                  ${this.riverDetail.americanWhitewaterLink
                    ? html`<p>
                        <a
                          href="${this.riverDetail.americanWhitewaterLink}"
                          target="_blank"
                          >American Whitewater Details</a
                        >
                      </p>`
                    : ""}
                  <p>
                    <strong>Advised Flow (CFS):</strong> Low:
                    ${this.riverDetail.lowAdvisedCFS ?? "N/A"} - High:
                    ${this.riverDetail.highAdvisedCFS ?? "N/A"}
                  </p>
                  ${this.riverDetail.comments
                    ? html`<p>
                        <strong>Comments:</strong> ${unsafeHTML(
                          linkify(this.riverDetail.comments),
                        )}
                      </p>`
                    : ""}
                  ${this.riverDetail.gaugeSource
                    ? html`<p>
                        <strong>Gauge Source:</strong>
                        <a
                          href="${this.riverDetail.gaugeSource}"
                          target="_blank"
                          >Link</a
                        >
                      </p>`
                    : ""}
                  ${this.riverDetail.localWeatherNOAA
                    ? html`<p>
                        <strong>NOAA Weather:</strong>
                        <a
                          href="${this.riverDetail.localWeatherNOAA}"
                          target="_blank"
                          >Link</a
                        >
                      </p>`
                    : ""}
                </div>
              `
            : html`<p>River details not available.</p>`}

          <div class="chart-status-container">
            ${this._isLoading
              ? html`<div class="loading">
                  Loading level data for ${name}...
                </div>`
              : this._error
                ? html`<div class="error">
                    Error loading level data: ${this._error}
                  </div>`
                : this._hasData
                  ? html`<canvas id="riverChartCanvas"></canvas>`
                  : html`<div class="no-data">
                      No river gauge data available for ${name}.
                    </div>`}
          </div>
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

  private _slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/\s+/g, "-") // Replace spaces with -
      .replace(/[^\w-]+/g, "") // Remove all non-word chars
      .replace(/--+/g, "-") // Replace multiple - with single -
      .replace(/^-+/, "") // Trim - from start of text
      .replace(/-+$/, ""); // Trim - from end of text
  }

  private _handleIntersection(entries: IntersectionObserverEntry[]) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const targetElement = entry.target as HTMLElement;
        const targetId = targetElement.id;

        // Ensure this is the element we intend to track (matches _currentObservedId)
        // and the component has data and is not in a loading/error state.
        if (targetId && targetId === this._currentObservedId &&
            this._hasData && !this._isLoading && !this._error) {
          // Update the URL hash if it's not already set to this target's ID.
          // Using replaceState to avoid polluting browser history during scroll.
          if (window.location.hash !== `#${targetId}`) {
            history.replaceState(null, '', `#${targetId}`);
          }
        }
      }
    });
  }
}

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

function getBandAnnotations(
  low: number | undefined,
  high: number | undefined,
  colors: typeof CHART_COLORS.bands,
): AnnotationOptions[] {
  const common = {
    borderColor: "transparent",
    borderWidth: 0,
    drawTime: "beforeDatasetsDraw" as const,
  };
  const bands: AnnotationOptions[] = [];
  if (typeof low === "number")
    bands.push({
      type: "box",
      yMax: low,
      backgroundColor: colors.belowLow,
      ...common,
    });
  if (typeof low === "number" && typeof high === "number" && low < high)
    bands.push({
      type: "box",
      yMin: low,
      yMax: high,
      backgroundColor: colors.optimal,
      ...common,
    });
  else if (typeof low === "number")
    bands.push({
      type: "box",
      yMin: low,
      backgroundColor: colors.optimal,
      ...common,
    });
  else if (typeof high === "number")
    bands.push({
      type: "box",
      yMax: high,
      backgroundColor: colors.optimal,
      ...common,
    });
  if (typeof high === "number")
    bands.push({
      type: "box",
      yMin: high,
      backgroundColor: colors.aboveHigh,
      ...common,
    });
  return bands;
}

function getLineAnnotations(
  low: number | undefined,
  high: number | undefined,
  lines: typeof CHART_COLORS.lines,
  labelColor: string,
): AnnotationOptions[] {
  const commonLine = { borderWidth: 1.5, borderDash: [6, 6] };
  const label = {
    display: true,
    position: "start" as const,
    color: labelColor,
    font: { size: 10 },
    padding: 3,
  };
  const annotations: AnnotationOptions[] = [];
  if (typeof low === "number")
    annotations.push({
      type: "line",
      yMin: low,
      yMax: low,
      borderColor: lines.low,
      ...commonLine,
      label: { ...label, content: `Low: ${low}`, backgroundColor: lines.low },
    });
  if (typeof high === "number")
    annotations.push({
      type: "line",
      yMin: high,
      yMax: high,
      borderColor: lines.high,
      ...commonLine,
      label: {
        ...label,
        content: `High: ${high}`,
        backgroundColor: lines.high,
      },
    });
  return annotations;
}

function getCurrentLevelLabelColor(
  value: number,
  low: number | undefined,
  high: number | undefined,
  colors: typeof CHART_COLORS.text,
): string {
  if (typeof low === "number" && value < low) {
    return colors.subtitleLow;
  }
  if (
    typeof low === "number" &&
    typeof high === "number" &&
    value >= low &&
    value <= high
  ) {
    return colors.subtitleOptimal;
  }
  if (typeof high === "number" && value > high) {
    return colors.subtitleHigh;
  }
  return colors.subtitleDefault;
}
