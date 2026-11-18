import { Component } from '@theme/component';
import { fetchConfig } from '@theme/utilities';
import { CartLinesUpdateEvent, CartErrorEvent } from '@shopify/events';

/**
 * @typedef {object} CrossSellItemRefs
 * @property {HTMLButtonElement} addButton - Outlined "+ Add" button.
 * @property {HTMLElement} label - Text inside the add button.
 * @property {HTMLElement} status - Live region for add results.
 * @property {HTMLFieldSetElement} [options] - Option buttons, only for products with variants.
 */

/**
 * One Cross-sell. Adds its variant to the cart in place, tagged with a hidden `_cross_sell`
 * line property, and leaves the cart drawer closed (`data-cart-auto-open="false"`).
 *
 * @extends {Component<CrossSellItemRefs>}
 */
class CrossSellItem extends Component {
  requiredRefs = ['addButton', 'label', 'status'];

  /** @type {AbortController | undefined} */
  #controller;

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#controller?.abort();
  }

  /**
   * Adds the default variant, or opens the option buttons when the product has variants.
   */
  handleAdd() {
    const { options, addButton } = this.refs;

    if (!options || this.dataset.state === 'added') {
      this.#add(this.dataset.variantId);
      return;
    }

    const open = options.hidden;
    options.hidden = !open;
    addButton.setAttribute('aria-expanded', String(open));
    if (open) {
      this.dataset.state = 'open';
      options.querySelector('button:not([disabled])')?.focus();
    } else {
      delete this.dataset.state;
    }
  }

  /**
   * Adds the variant of the option button that was pressed.
   * @param {Event} event
   */
  handleOptionAdd(event) {
    const button = event.target;
    if (!(button instanceof HTMLButtonElement)) return;
    this.#add(button.dataset.variantId);
  }

  /**
   * @param {string | undefined} variantId
   */
  async #add(variantId) {
    if (!variantId) return;

    this.#controller?.abort();
    this.#controller = new AbortController();
    const { signal } = this.#controller;

    this.setAttribute('aria-busy', 'true');

    const sectionIds = [...document.querySelectorAll('cart-items-component')]
      .map((element) => (element instanceof HTMLElement ? element.dataset.sectionId : undefined))
      .filter(Boolean);

    const deferred = CartLinesUpdateEvent.createPromise();
    this.dispatchEvent(
      new CartLinesUpdateEvent({
        action: 'add',
        context: 'product',
        lines: [{ merchandiseId: variantId, quantity: 1 }],
        promise: deferred.promise,
      })
    );

    try {
      const response = await fetch(Theme.routes.cart_add_url, {
        ...fetchConfig('json', {
          body: JSON.stringify({
            items: [
              {
                id: Number(variantId),
                quantity: 1,
                properties: { _cross_sell: this.dataset.source || 'product' },
              },
            ],
            sections: sectionIds.join(','),
          }),
        }),
        signal,
      });
      const result = await response.json();

      if (result.status) {
        this.dispatchEvent(new CartErrorEvent({ error: result.message, code: 'INVALID', detail: result }));
        throw new Error(result.description || result.message);
      }

      const cart = await (await fetch(`${Theme.routes.cart_url}.js`, { signal })).json();
      deferred.resolve({
        cart: CartLinesUpdateEvent.createCartFromAjaxResponse(cart),
        detail: {
          items: cart.items,
          sections: result.sections,
          source: 'cross-sell-item',
          itemCount: 1,
          didError: false,
        },
      });

      this.#showAdded();
    } catch (error) {
      deferred.reject(error);
      if (error instanceof Error && error.name === 'AbortError') return;
      this.refs.status.textContent = this.dataset.errorText ?? '';
      console.warn('[cross-sell] Add failed:', error);
    } finally {
      this.removeAttribute('aria-busy');
    }
  }

  #showAdded() {
    const { options, addButton, label, status } = this.refs;
    const added = this.dataset.addedText ?? Theme.translations.added;

    this.dataset.state = 'added';
    label.textContent = `${added} ✓`;
    status.textContent = added;

    if (options) {
      options.hidden = true;
      addButton.setAttribute('aria-expanded', 'false');
      addButton.focus();
    }
  }
}

if (!customElements.get('cross-sell-item')) {
  customElements.define('cross-sell-item', CrossSellItem);
}
