import { Component } from '@theme/component';

/**
 * Counts down to `data-end` (Unix seconds) and renders HH:MM:SS, prefixed with DD: while
 * more than a day remains. When time runs out it hides the closest `.landing-sale-timer`,
 * except in the theme editor (`data-design-mode`) so merchants can still select the block.
 *
 * @typedef {{ value: HTMLTimeElement }} Refs
 * @extends {Component<Refs>}
 */
class LandingCountdown extends Component {
  requiredRefs = ['value'];

  /** @type {number | undefined} */
  #interval;

  connectedCallback() {
    super.connectedCallback();
    this.#stop();
    this.#tick();
    if (this.#remaining() > 0) {
      this.#interval = window.setInterval(this.#tick, 1000);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#stop();
  }

  /** @returns {number} Remaining whole seconds, never negative. */
  #remaining() {
    const end = Number(this.dataset.end);
    if (!Number.isFinite(end)) return 0;
    return Math.max(0, Math.floor(end - Date.now() / 1000));
  }

  #stop() {
    if (this.#interval !== undefined) {
      window.clearInterval(this.#interval);
      this.#interval = undefined;
    }
  }

  #tick = () => {
    const remaining = this.#remaining();
    const pad = (/** @type {number} */ n) => String(n).padStart(2, '0');
    const days = Math.floor(remaining / 86400);
    const hours = Math.floor((remaining % 86400) / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const seconds = remaining % 60;
    const parts = [hours, minutes, seconds].map(pad);
    if (days > 0) parts.unshift(pad(days));

    const { value } = this.refs;
    value.textContent = parts.join(':');
    value.dateTime = `PT${remaining}S`;

    if (remaining > 0) return;

    this.#stop();
    if (this.hasAttribute('data-design-mode')) return;
    const wrapper = this.closest('.landing-sale-timer');
    if (wrapper instanceof HTMLElement) wrapper.hidden = true;
  };
}

if (!customElements.get('landing-countdown')) {
  customElements.define('landing-countdown', LandingCountdown);
}
