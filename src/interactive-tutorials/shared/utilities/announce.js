/**
 * Accessible announcements via aria-live regions.
 *
 * Two problems this module exists to solve, learned from VoiceOver testing:
 *
 *   1. CLOBBERING. A single live region that is cleared and re-set on every
 *      call loses messages: if two announcements fire close together (e.g. the
 *      trainer opens and immediately renders its first step), the second wipes
 *      the first before the screen reader has spoken it. So we QUEUE messages
 *      and release them one at a time, pacing by an estimate of how long each
 *      takes to speak. Passive narration therefore plays in full, in order.
 *
 *   2. POLITE GETS DROPPED. A `polite` message announced while the screen
 *      reader is busy (e.g. reading a freshly loaded page) is discarded. For
 *      messages that must cut through — a page-load instruction, "Correct!",
 *      the next prompt the moment the learner acts — pass `{ assertive: true }`.
 *      Assertive messages clear the queue and speak immediately through a
 *      separate `aria-live="assertive"` / `role="alert"` region.
 *
 * Backward compatible: `announce(message)` keeps working and stays polite.
 */

let politeRegion = null;
let assertiveRegion = null;

/** Queue of pending polite messages: [{ message }]. */
const queue = [];
let releasing = false;

function makeRegion(level) {
  const el = document.createElement('div');
  el.setAttribute('role', level === 'assertive' ? 'alert' : 'status');
  el.setAttribute('aria-live', level);
  el.setAttribute('aria-atomic', 'true');
  el.className = 'sr-only';
  // Visually hidden but still spoken. NB: never use display:none / visibility:
  // hidden here — those remove the node from the accessibility tree and silence
  // it. The off-screen clip is the accessible-hiding pattern.
  el.style.cssText =
    'position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden;';
  document.body.appendChild(el);
  return el;
}

/**
 * Create the live regions once. Safe to call repeatedly. Returns the polite
 * region for backward compatibility with earlier callers.
 */
export function initLiveRegion() {
  if (!politeRegion) politeRegion = makeRegion('polite');
  if (!assertiveRegion) assertiveRegion = makeRegion('assertive');
  return politeRegion;
}

// Roughly how long a screen reader needs to speak `text`, so queued messages do
// not overlap. ~13 characters/second is deliberately conservative (most voices
// are faster); better a little dead air than two messages talking over each
// other. Floored so short messages still get a beat, capped so a very long one
// cannot wedge the queue.
function speakMs(text) {
  const ms = Math.round((text.length / 13) * 1000) + 300;
  return Math.min(Math.max(ms, 1100), 12000);
}

function releaseNext() {
  if (releasing) return;
  const item = queue.shift();
  if (!item) return;
  releasing = true;
  politeRegion.textContent = '';
  // A tick of empty-then-text makes the change register reliably.
  setTimeout(() => { if (politeRegion) politeRegion.textContent = item.message; }, 50);
  setTimeout(() => { releasing = false; releaseNext(); }, speakMs(item.message));
}

/**
 * Announce a message to screen readers.
 * @param {string} message - The message to speak.
 * @param {object} [opts]
 * @param {boolean} [opts.assertive=false] - Interrupt: clear the queue and
 *   speak immediately. Use for page-load instructions and active feedback.
 */
export function announce(message, opts = {}) {
  initLiveRegion();
  if (!message || typeof message !== 'string') {
    console.warn('announce() called with invalid message:', message);
    return;
  }
  // Tolerate the old numeric-delay second argument: treat anything non-object
  // as "no options".
  const assertive = !!(opts && typeof opts === 'object' && opts.assertive);

  if (assertive) {
    // Drop anything queued; an assertive message supersedes passive narration.
    queue.length = 0;
    releasing = false;
    assertiveRegion.textContent = '';
    setTimeout(() => { if (assertiveRegion) assertiveRegion.textContent = message; }, 50);
    return;
  }

  queue.push({ message });
  releaseNext();
}

/**
 * Announce success message
 * @param {string} message - Success message
 */
export function announceSuccess(message) {
  announce(`Success: ${message}`);
}

/**
 * Announce error message
 * @param {string} message - Error message
 */
export function announceError(message) {
  announce(`Error: ${message}`, { assertive: true });
}

/**
 * Announce progress update
 * @param {number} current - Current step/lesson number
 * @param {number} total - Total steps/lessons
 * @param {string} context - Optional context (e.g., "lessons", "steps")
 */
export function announceProgress(current, total, context = 'items') {
  const percentage = Math.round((current / total) * 100);
  announce(`Progress: ${current} of ${total} ${context} complete. ${percentage} percent.`);
}

/**
 * Clean up live regions and the pending queue on disposal.
 */
export function disposeLiveRegion() {
  queue.length = 0;
  releasing = false;
  [politeRegion, assertiveRegion].forEach((el) => {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  });
  politeRegion = null;
  assertiveRegion = null;
}
