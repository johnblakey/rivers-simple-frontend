// src/components/river-chart/river-details.ts
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { type RiverDetail } from "../../utility/river-service";

const linkify = (text: string) => text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');

@customElement("river-details")
export class RiverDetailsComponent extends LitElement {
  @property({ type: Object }) riverDetail: RiverDetail | null = null;

  static styles = css`
    .details {
      margin-bottom: 16px;
      padding-bottom: 16px;
      border-bottom: 1px solid #eee;
    }

    .details-below {
      margin-top: 16px;
    }

    .details p, .details-below p {
      margin: 8px 0;
      font-size: 0.95em;
      color: #455a64;
      line-height: 1.5;
    }

    .details strong, .details-below strong {
      color: #263238;
      font-weight: 600;
    }

    .details a, .details-below a {
      color: #007bff;
      text-decoration: none;
      font-weight: 500;
      border-bottom: 1px solid transparent;
      transition: all 0.2s ease;
    }

    .details a:hover, .details a:focus,
    .details-below a:hover, .details-below a:focus {
      color: #0056b3;
      border-bottom-color: #0056b3;
    }
  `;

  private renderTopDetails() {
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

  private renderBottomDetails() {
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
    return html`
      ${this.renderTopDetails()}
      <slot></slot>
      ${this.renderBottomDetails()}
    `;
  }
}
