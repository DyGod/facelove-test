import { morph } from '@theme/morph';
import { Component } from '@theme/component';
import { StandardEvents, ProductSelectEvent } from '@shopify/events';

/**
 * Re-renders variant-dependent landing gift content (free gift rows and their hidden
 * `free_gift_id` inputs, gift unlock tiles) from the section HTML fetched for a new variant.
 * Matches its counterpart in that HTML by tag name and `data-block-id`.
 */
class LandingFreeGift extends Component {
  /** @type {AbortController | undefined} */
  #abortController;

  connectedCallback() {
    super.connectedCallback();
    this.#abortController?.abort();
    this.#abortController = new AbortController();
    const closestSection = this.closest('.shopify-section, dialog');
    closestSection?.addEventListener(StandardEvents.productSelect, this.#handleProductSelect, {
      signal: this.#abortController.signal,
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#abortController?.abort();
  }

  /**
   * @param {ProductSelectEvent} event
   */
  #handleProductSelect = (event) => {
    if (!(event.target instanceof Element) || event.target.closest('product-card')) return;

    event.promise
      .then(({ detail }) => {
        if (!detail?.html) return;
        if (!detail.newProduct && detail.productId && detail.productId !== this.dataset.productId) return;

        const next = detail.html.querySelector(`${this.localName}[data-block-id="${this.dataset.blockId}"]`);
        if (!next) return;

        morph(this, next.cloneNode(true), { childrenOnly: true });
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') console.warn('[landing-free-gift] Event promise rejected:', error);
      });
  };
}

if (!customElements.get('landing-free-gift')) {
  customElements.define('landing-free-gift', LandingFreeGift);
}

if (!customElements.get('landing-gift-unlocks')) {
  customElements.define('landing-gift-unlocks', class LandingGiftUnlocks extends LandingFreeGift {});
}
