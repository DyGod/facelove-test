import { Component } from '@theme/component';

/**
 * Skin concern map on landing pages.
 *
 * Choosing a point is native (radio buttons) and CSS shows the matching card. This only adds
 * the mobile nudge: below 750px the card sits under the photo, so after a shopper picks a point
 * the card is scrolled into view. `block: 'nearest'` leaves the page alone when the card is
 * already visible; the card's scroll margins keep it clear of the header and sticky bar.
 *
 * @typedef {object} Refs
 * @property {HTMLElement[]} cards - One card per point, in the same order as the inputs.
 *
 * @extends {Component<Refs>}
 */
class LandingSkinConcernsComponent extends Component {
  /**
   * @param {Event} event - The change event from a point's radio input.
   */
  handleChange = (event) => {
    if (!(event.target instanceof HTMLInputElement)) return;
    if (window.matchMedia('(min-width: 750px)').matches) return;

    const card = this.refs.cards?.[Number(event.target.dataset.index)];
    if (!card) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Wait a frame so the newly shown card has a layout box to scroll to.
    requestAnimationFrame(() => {
      card.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  };
}

if (!customElements.get('landing-skin-concerns')) {
  customElements.define('landing-skin-concerns', LandingSkinConcernsComponent);
}
