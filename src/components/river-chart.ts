import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Chart, registerables, type ChartConfiguration } from "chart.js/auto";
import AnnotationPlugin, { type AnnotationOptions } from "chartjs-plugin-annotation";
import "chartjs-adapter-date-fns";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { getRiverLevelsBySiteCode, type RiverLevel, type RiverDetail } from "../utility/data-service";
import { slugify } from "../utility/string-utils";
import { userPreferencesService } from "../utility/user-preferences-service";
import { authService } from "../utility/auth-service";
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
  @state() private userNote: string | null = null;
  @state() private isEditingNote = false;
  @state() private noteIsLoading = false;
  @state() private noteError: string | null = null;
  @state() private isSignedIn = false;


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

    .notes-section {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #eee;
    }
    .notes-section h3 {
      margin-top: 0;
      margin-bottom: 8px;
      font-size: 1.1em;
      color: #263238;
    }
    .notes-section textarea {
      width: 100%;
      box-sizing: border-box;
      min-height: 80px;
      padding: 8px;
      border-radius: 4px;
      border: 1px solid #ccc;
      resize: vertical;
      font-family: inherit;
      font-size: 0.95em;
    }
    .notes-section .note-display {
      white-space: pre-wrap; /* preserve whitespace and newlines */
      word-wrap: break-word;
      background-color: #f9f9f9;
      padding: 10px;
      border-radius: 4px;
      border: 1px solid #eee;
      min-height: 40px;
    }
    .notes-actions {
      margin-top: 8px;
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
    .notes-actions button {
      padding: 6px 12px;
      border-radius: 4px;
      border: 1px solid transparent;
      cursor: pointer;
      font-weight: 500;
      transition: background-color 0.2s;
    }
    .notes-actions .save-btn { background-color: #28a745; color: white; border-color: #28a745; }
    .notes-actions .save-btn:hover { background-color: #218838; }
    .notes-actions .cancel-btn { background-color: #6c757d; color: white; border-color: #6c757d; }
    .notes-actions .cancel-btn:hover { background-color: #5a6268; }
    .notes-actions .edit-btn { background-color: #007bff; color: white; border-color: #007bff; }
    .notes-actions .edit-btn:hover { background-color: #0069d9; }
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

  connectedCallback() {
    super.connectedCallback();
    // Subscribe to auth state changes
    authService.onAuthStateChanged(user => {
      const wasSignedIn = this.isSignedIn;
      this.isSignedIn = !!user;
      if (this.isSignedIn && !wasSignedIn) {
        // User just signed in, fetch their note
        this.fetchUserNote();
      } else if (!this.isSignedIn && wasSignedIn) {
        // User just signed out, clear note info
        this.userNote = null;
        this.isEditingNote = false;
        this.noteError = null;
      }
    });
    // Set initial sign-in state
    this.isSignedIn = authService.isSignedIn();
  }

  protected async willUpdate(changed: Map<string | number | symbol, unknown>) {
    if ((changed.has("siteCode") || changed.has("riverDetail")) && this.siteCode && this.riverDetail) {
      this.isLoadComplete = false; // Reset load completion state
      await this.fetchData();
      if (this.isSignedIn) {
        this.fetchUserNote();
      }
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

  private async fetchUserNote(): Promise<void> {
    if (!this.siteCode || !this.isSignedIn) {
      this.userNote = null;
      return;
    }
    this.noteIsLoading = true;
    this.noteError = null;
    try {
      const noteData = await userPreferencesService.getUserNote(this.siteCode);
      // The service returns null on auth error, or an object with a note property.
      this.userNote = noteData?.note ?? null;
    } catch (error) {
      this.noteError = "Could not load your note.";
      console.error(`Failed to fetch note for ${this.siteCode}`, error);
    } finally {
      this.noteIsLoading = false;
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

  private handleClick(e: Event): void {
    const target = e.target as HTMLElement;
    // Do not trigger navigation if the user is interacting with a link, button, or textarea.
    if (target.closest('a, button, textarea')) {
      return;
    }
    const slug = slugify(this.displayName);
    history.replaceState(null, "", `#${slug}`);
    this.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  public rebuildChart(): void {
    if (this.levels.length > 0 && !this.isLoading && !this.error) {
      this.renderChart();
    }
  }

  private handleNoteEdit() {
    this.isEditingNote = true;
  }

  private handleNoteCancel() {
    this.isEditingNote = false;
    this.noteError = null; // Clear any previous save errors
  }

  private async handleNoteSave() {
    if (!this.siteCode) return;

    const textarea = this.shadowRoot?.querySelector('.notes-section textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const newNote = textarea.value;
    this.noteIsLoading = true;
    this.noteError = null;

    try {
      await userPreferencesService.saveUserNote(this.siteCode, newNote);
      this.userNote = newNote.trim() ? newNote : null; // Treat empty save as null
      this.isEditingNote = false;
    } catch (error) {
      this.noteError = "Failed to save note.";
      console.error(`Failed to save note for ${this.siteCode}`, error);
    } finally {
      this.noteIsLoading = false;
    }
  }

  private renderNotesSection() {
    if (!this.isSignedIn) {
      return null;
    }

    return html`
      <div class="notes-section">
        <h3>My Notes</h3>
        ${this.noteIsLoading
          ? html`<p>Loading...</p>`
          : this.noteError
          ? html`<p class="error">${this.noteError}</p>`
          : this.isEditingNote
            ? html`
                <textarea
                  aria-label="River note"
                  .value=${this.userNote || ''}
                ></textarea>
                <div class="notes-actions">
                  <button class="save-btn" @click=${this.handleNoteSave}>Save</button>
                  <button class="cancel-btn" @click=${this.handleNoteCancel}>Cancel</button>
                </div>
              `
            : html`
                <div class="note-display">
                  ${this.userNote ? html`${this.userNote}` : html`<em style="color: #666;">No notes for this river yet.</em>`}
                </div>
                <div class="notes-actions">
                  <button class="edit-btn" @click=${this.handleNoteEdit}>
                    ${this.userNote ? 'Edit Note' : 'Add Note'}
                  </button>
                </div>
              `}
      </div>
    `;
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
      <div id="${slug}" @click=${this.handleClick} tabindex="0" role="article" aria-labelledby="chart-title-${slug}">
        <h2>${this.displayName}</h2>
        ${this.renderDetails()}

        ${this.isLoading ? html`<div class="loading">Loading data...</div>` :
          this.error ? html`<div class="error">Error: ${this.error}</div>` :
          this.levels.length ? html`<canvas></canvas>` : null}

        ${this.renderDetailsBelow()}
        ${this.renderNotesSection()}
      </div>
    `;
  }
}
