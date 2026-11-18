import { ComparisonSliderComponent } from '@theme/comparison-slider';

/**
 * Before/after slider for landing feature cards.
 *
 * Extends the shared comparison slider with direct pointer control: the whole image is the
 * drag surface, so the divider follows the pointer exactly (native range inputs offset the
 * value by the thumb width, and iOS only drags from the thumb). The hidden range input stays
 * the keyboard and assistive-technology control.
 *
 * Touch: vertical swipes keep scrolling the page (`touch-action: pan-y` in CSS); a horizontal
 * swipe drags, and a tap without movement jumps the divider to that point.
 *
 * @extends {ComparisonSliderComponent}
 */
class LandingCompareComponent extends ComparisonSliderComponent {
  /** @type {AbortController | undefined} */
  #controller;

  /** @type {number[]} */
  #timers = [];

  /** @type {number | null} */
  #pointerId = null;

  #moved = false;

  connectedCallback() {
    super.connectedCallback();

    this.#controller?.abort();
    this.#controller = new AbortController();
    const { signal } = this.#controller;
    const { mediaWrapper } = this.refs;

    mediaWrapper.addEventListener('pointerdown', this.#handlePointerDown, { signal });
    mediaWrapper.addEventListener('pointermove', this.#handlePointerMove, { signal });
    mediaWrapper.addEventListener('pointerup', this.#handlePointerUp, { signal });
    mediaWrapper.addEventListener('pointercancel', this.#handlePointerCancel, { signal });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#controller?.abort();
    this.#cancelHint();
  }

  /**
   * Plays the 40% → 60% → 50% hint once. Skipped under reduced motion and cancelled as soon
   * as the shopper interacts.
   */
  animateSlider() {
    if (this.hasAnimated) return;
    this.hasAnimated = true;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const { mediaWrapper } = this.refs;
    this.isAnimating = true;
    mediaWrapper.style.setProperty('--transition-duration', '0.5s');

    const steps = [
      [100, '40'],
      [600, '60'],
      [1100, '50'],
    ];

    for (const [delay, value] of steps) {
      this.#timers.push(window.setTimeout(() => mediaWrapper.style.setProperty('--compare', value), delay));
    }

    this.#timers.push(window.setTimeout(() => this.#cancelHint(), 1600));
  }

  #cancelHint() {
    for (const timer of this.#timers) window.clearTimeout(timer);
    this.#timers = [];

    if (!this.isAnimating) return;
    this.isAnimating = false;
    this.refs.mediaWrapper?.style.setProperty('--transition-duration', '0s');
    this.sync();
  }

  /**
   * Converts a pointer position to the range value. In RTL the range runs right to left.
   * @param {number} clientX
   */
  #setFromPointer(clientX) {
    const rect = this.refs.mediaWrapper.getBoundingClientRect();
    if (rect.width === 0) return;

    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    const isRtl = getComputedStyle(this).direction === 'rtl';
    this.setValue(Math.round((isRtl ? 1 - ratio : ratio) * 100));
  }

  /**
   * Keeps receiving moves outside the image. Capture fails if the pointer is already gone.
   * @param {number} pointerId
   */
  #capture(pointerId) {
    try {
      this.refs.mediaWrapper.setPointerCapture(pointerId);
    } catch {
      // Dragging still works while the pointer stays over the image.
    }
  }

  /** @param {PointerEvent} event */
  #handlePointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    this.#cancelHint();
    this.#pointerId = event.pointerId;
    this.#moved = false;

    if (event.pointerType === 'mouse') {
      // Mouse: jump immediately and keep text from being selected while dragging.
      event.preventDefault();
      this.refs.slider.focus({ preventScroll: true });
      this.#capture(event.pointerId);
      this.#setFromPointer(event.clientX);
    }
  };

  /** @param {PointerEvent} event */
  #handlePointerMove = (event) => {
    if (event.pointerId !== this.#pointerId) return;

    if (!this.#moved && event.pointerType !== 'mouse') {
      // First horizontal touch movement: the browser kept the gesture, so start dragging.
      this.#capture(event.pointerId);
    }

    this.#moved = true;
    this.#setFromPointer(event.clientX);
  };

  /** @param {PointerEvent} event */
  #handlePointerUp = (event) => {
    if (event.pointerId !== this.#pointerId) return;

    // Touch tap without a drag jumps to the tapped point.
    if (!this.#moved && event.pointerType !== 'mouse') this.#setFromPointer(event.clientX);
    this.#pointerId = null;
  };

  #handlePointerCancel = () => {
    // The browser took the gesture for vertical scrolling.
    this.#pointerId = null;
  };
}

if (!customElements.get('landing-compare')) {
  customElements.define('landing-compare', LandingCompareComponent);
}
