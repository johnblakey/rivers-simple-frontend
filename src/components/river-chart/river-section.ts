// src/components/river-chart/river-section.ts
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { type RiverDetail } from "../../utility/river-service";
import { slugify } from "../../utility/slugify-string";
import "./river-chart-canvas";
import "./river-details";
import "./river-notes";

@customElement("river-section") // Renamed custom element tag
export class RiverSection extends LitElement { // Renamed class
  @property({ type: String }) siteCode = "";
  @property({ type: String }) riverId = "";
  @property({ type: Object }) riverDetail: RiverDetail | null = null;

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
    :host(:hover) {
      background-color: #f5f5f5;
    }

    h2 {
      margin-top: 0;
    }

    @media (max-width: 768px) {
      :host {
        padding: 16px 8px;
      }
    }
  `;

  get displayName() {
    return this.riverDetail?.siteName || this.siteCode || "Loading...";
  }

  get loadCompleted(): boolean {
    const chartCanvas = this.shadowRoot?.querySelector('river-chart-canvas') as HTMLElement & { loadCompleted?: boolean } | null;
    return chartCanvas?.loadCompleted || false;
  }

  private handleClick(e: Event): void {
    const target = e.target as HTMLElement;
    // Don't update URL if user is interacting with interactive elements
    if (target.closest('a, button, textarea, input')) {
      return;
    }
    const slug = slugify(this.displayName);
    history.replaceState(null, "", `#${slug}`);
  }

  public rebuildChart(): void {
    const chartCanvas = this.shadowRoot?.querySelector('river-chart-canvas') as { rebuildChart?: () => void } | null;
    chartCanvas?.rebuildChart?.();
  }

  render() {
    const slug = slugify(this.displayName);

    return html`
      <div
        id="${slug}"
        @click=${this.handleClick}
        tabindex="0"
        role="article"
        aria-labelledby="chart-title-${slug}"
      >
        <h2 id="chart-title-${slug}">${this.displayName}</h2>

        <river-details .riverDetail=${this.riverDetail}></river-details>

        <river-chart-canvas
          .siteCode=${this.siteCode}
          .riverDetail=${this.riverDetail}>
        </river-chart-canvas>

        <river-notes .riverId=${this.riverId}></river-notes>
      </div>
    `;
  }
}
