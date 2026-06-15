/**
 * Keyboard Trainer
 *
 * An audio-first, self-paced trainer for the plugin's keyboard shortcuts. It is
 * launched from a persistent keyboard icon and is available in any mode.
 *
 * Per-shortcut loop:  ANNOUNCE -> PROMPT -> (DETECT) -> CONFIRM -> next
 *   ANNOUNCE  speak what the shortcut does (verbosity-tier dependent).
 *   PROMPT    offer "Try it", "Hear again", "Skip".
 *   DETECT    listen for the real keypress (standalone shortcuts only).
 *   CONFIRM   speak success, mark mastered, advance.
 *
 * Design notes grounded in the BVI co-design sessions:
 *   - One announcement at a time; terse by default with a verbosity control.
 *   - Repetition is free: "Hear again" and "Try again" carry no penalty.
 *   - Demonstrate, then let the learner try — matching participant requests.
 *   - Shortcuts that only make sense on a live workspace (movement, edit) are
 *     gated behind `requiresSandbox` and demonstrated, not yet practiced. They
 *     unlock once a practice workspace is wired in (a later, separate step).
 */

import { trapFocus, popFocus, pushFocus } from '../utilities/focus-manager.js';
import { announce } from '../utilities/announce.js';
import { loadProgress, saveProgress } from '../utilities/progress-store.js';
import {
  KEYBOARD_TRACKS,
  matchesShortcut,
  canonicalDetail,
  getAllShortcuts
} from '../data/keyboard-tracks.js';

const PROGRESS_MODE = 'keyboard-trainer';
const LISTEN_TIMEOUT_MS = 9000;
const VERBOSITY = { TERSE: 'terse', DEFAULT: 'default', NOVICE: 'novice' };

let stylesInjected = false;

function injectStyles() {
  if (stylesInjected) return;
  const style = document.createElement('style');
  style.id = 'keyboard-trainer-styles';
  style.textContent = `
    .kbt-overlay { position: fixed; inset: 0; display: flex; align-items: center;
      justify-content: center; padding: var(--spacing-lg, 24px);
      background: rgba(0,0,0,0.7); z-index: var(--z-modal, 500); }
    .kbt-dialog { background: var(--color-surface-elevated, #fff);
      color: var(--color-text-primary, #212529); border-radius: var(--radius-lg, 12px);
      width: 100%; max-width: 640px; max-height: 90vh; overflow-y: auto;
      padding: var(--spacing-xl, 32px); box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      font-family: var(--font-family-base, sans-serif); }
    .kbt-dialog *:focus-visible { outline: var(--focus-outline-width, 3px)
      var(--focus-outline-style, solid) var(--color-focus, #0066cc);
      outline-offset: var(--focus-outline-offset, 2px); }
    .kbt-btn { font-size: var(--font-size-base, 1rem); padding: var(--spacing-sm, 8px) var(--spacing-md, 16px);
      border-radius: var(--radius-md, 8px); border: 1px solid var(--color-border-strong, #adb5bd);
      background: var(--color-surface, #f8f9fa); color: var(--color-text-primary, #212529);
      cursor: pointer; }
    .kbt-btn:hover { background: var(--color-hover-background, #e9ecef); }
    .kbt-btn:disabled { color: var(--color-disabled-text, #6c757d);
      background: var(--color-locked-background, #e9ecef); cursor: not-allowed; }
    .kbt-btn-primary { background: var(--color-focus, #0066cc); color: #fff;
      border-color: var(--color-focus, #0066cc); }
    .kbt-btn-primary:hover { filter: brightness(1.08); background: var(--color-focus, #0066cc); }
    .kbt-listening { background: var(--color-info-background, #cff4fc);
      border: 2px solid var(--color-info, #055160); border-radius: var(--radius-md, 8px);
      padding: var(--spacing-md, 16px); animation: kbt-pulse 1.4s ease-in-out infinite; }
    @keyframes kbt-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.72; } }
    @media (prefers-reduced-motion: reduce) { .kbt-listening { animation: none; } }
    .kbt-kbd { font-family: var(--font-family-mono, monospace);
      background: var(--color-surface, #f8f9fa); border: 1px solid var(--color-border, #dee2e6);
      border-radius: var(--radius-sm, 4px); padding: 2px 6px; }
    /* Live coach: the backdrop drops out so the real workspace stays usable,
       and the dialog docks to the bottom as a compact, non-modal bar. */
    .kbt-overlay--coach { background: transparent; pointer-events: none;
      align-items: flex-end; padding: 0; }
    .kbt-overlay--coach .kbt-dialog { pointer-events: auto; max-width: 760px;
      max-height: 42vh; margin: 0 auto var(--spacing-lg, 24px);
      box-shadow: 0 -8px 32px rgba(0,0,0,0.3);
      border: 2px solid var(--color-focus, #0066cc); }
    .kbt-cue { position: fixed; top: 16px; left: 50%;
      transform: translateX(-50%) translateY(-12px);
      background: var(--color-success, #0f5132); color: #fff;
      padding: 10px 18px; border-radius: var(--radius-md, 8px); font-weight: 600;
      z-index: var(--z-toast, 700); opacity: 0; pointer-events: none;
      max-width: 90vw; text-align: center;
      box-shadow: 0 6px 24px rgba(0,0,0,0.3);
      transition: opacity 0.25s ease, transform 0.25s ease; }
    .kbt-cue--show { opacity: 1; transform: translateX(-50%) translateY(0); }
    @media (prefers-reduced-motion: reduce) { .kbt-cue { transition: none; } }
  `;
  document.head.appendChild(style);
  stylesInjected = true;
}

export class KeyboardTrainer {
  /**
   * @param {object} [options]
   * @param {string} [options.profile] - Profile id for progress scoping.
   * @param {string} [options.verbosity] - One of 'terse' | 'default' | 'novice'.
   */
  constructor(options = {}) {
    this.profile = options.profile || 'default';
    this.verbosity = options.verbosity || VERBOSITY.DEFAULT;

    // Optional live adapter (see blockly-live-adapter.js). When present and
    // available, live-capable steps drive the real editor; otherwise the
    // trainer falls back to rehearsal mode.
    this.live = options.live || null;

    this.tracks = KEYBOARD_TRACKS;
    this.trackIndex = 0;
    this.shortcutIndex = 0;

    this.overlay = null;
    this.removeTrap = null;
    this.isOpen = false;
    this.isListening = false;
    this.listenTimer = null;
    this.onListenKeydown = null;

    // Live-coach state.
    this.coachActive = false;
    this.liveActions = null;
    this.liveIndex = 0;
    this.liveBusy = false;
    this.onLiveKeydown = null;
    this.liveTimer = null;
    this.livePollTimer = null;
    this.cueTimer = null;
    this._cursorBaseline = null;
    // Serialized-workspace snapshot taken when a `workspaceChanged` step is
    // prompted, so we can tell when an edit actually altered the program.
    this._wsBaseline = null;
    // Timestamp of the last bare Escape, for the double-Escape close.
    this._lastEscape = 0;

    this.onLaunchHotkey = null;

    this.mastered = this._loadMastered();
  }

  _isLiveStep(sc) {
    return !!(sc.live && this.live && this.live.available);
  }

  _loadMastered() {
    const saved = loadProgress(PROGRESS_MODE, this.profile);
    return new Set(saved && Array.isArray(saved.mastered) ? saved.mastered : []);
  }

  _persistMastered() {
    saveProgress(PROGRESS_MODE, { mastered: Array.from(this.mastered) }, this.profile);
  }

  get currentTrack() {
    return this.tracks[this.trackIndex];
  }

  get currentShortcut() {
    return this.currentTrack.shortcuts[this.shortcutIndex];
  }

  // ---- lifecycle -----------------------------------------------------------

  open() {
    if (this.isOpen) return;
    injectStyles();

    this.overlay = this._createOverlay();
    document.body.appendChild(this.overlay);

    pushFocus(this.overlay);
    this.isOpen = true;
    this._lastEscape = 0;

    const total = getAllShortcuts().length;
    const parts = [
      `Keyboard trainer opened. ${this.mastered.size} of ${total} shortcuts practiced so far.`
    ];

    // Orient the learner before they touch a key. The keyboard tutorial is its
    // own segment with its own program: drop the small practice stack onto the
    // workspace right away (stashing the learner's own blocks, restored on
    // close) so there is always something concrete to describe and act on — even
    // if the learner arrived with an empty canvas.
    if (this.live && this.live.available) {
      if (this.live.loadSandbox) this.live.loadSandbox();
      // Best-effort: if keyboard nav is already on, start them on the first block
      // so "where am I" has a sensible answer. If it is off, the cursor does not
      // exist yet and this is a no-op — the first navigation drill parks the
      // cursor for them instead.
      if (this.live.placeCursorFirst) this.live.placeCursorFirst();
      if (this.live.describeWorkspace) {
        const summary = this.live.describeWorkspace();
        if (summary) parts.push(summary);
      }
      // Request 3h: a learner who came straight here without enabling keyboard
      // navigation gets the enabling ritual spelled out, rather than pressing
      // keys that silently do nothing.
      if (this.live.probe && !this.live.probe('keyboardNavOn')) {
        parts.push(
          'To control the editor, keyboard navigation must be on. Press Tab twice ' +
          'to focus the workspace, then hold Control and Shift and press K — use ' +
          'Control even on a Mac. Or just choose Try on any step and the trainer ' +
          'will switch it on for you.'
        );
      }
    }

    parts.push('Use the buttons to hear a shortcut, try it, or skip. Press Escape twice to leave.');
    // Polite (queued): opening the trainer is a deliberate action, not page load,
    // so nothing is competing. The queue guarantees this orientation is spoken in
    // full, and the per-step instruction that _render queues next follows it in
    // order rather than clobbering it.
    announce(parts.join(' '));
    this._render();
  }

  close() {
    if (!this.isOpen) return;
    this._stopListening();
    this._stopLive();
    this._removeCue();
    // Hand the learner's own blocks back if we were in the practice sandbox.
    if (this.live && this.live.restoreSandbox) this.live.restoreSandbox();
    if (this.removeTrap) { this.removeTrap(); this.removeTrap = null; }
    popFocus();
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    this.overlay = null;
    this.isOpen = false;
    announce('Keyboard trainer closed.');
  }

  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  dispose() {
    this.disableLaunchHotkey();
    this.close();
  }

  // ---- launch hotkey -------------------------------------------------------

  /**
   * Register a global key to open the trainer, so users don't have to Tab
   * across the page to reach the launch button. Defaults to "?" (Shift+/),
   * the universal "help" convention, which is unbound in the plugin (its
   * plain-slash shortcuts all require no modifiers or Ctrl/Cmd, so Shift+/
   * never collides).
   *
   * The handler is inert while focus is in a text field, and only ever opens
   * (never toggles closed) so a stray "?" during live practice can't dismiss
   * the trainer — Escape remains the way out.
   *
   * @param {object} [opts]
   * @param {(e: KeyboardEvent) => boolean} [opts.match] - Custom matcher.
   *   Defaults to matching the "?" character.
   */
  enableLaunchHotkey(opts = {}) {
    if (this.onLaunchHotkey) return;
    const match = typeof opts.match === 'function'
      ? opts.match
      : (e) => e.key === '?';
    this.onLaunchHotkey = (e) => {
      if (this.isOpen) return;
      if (this._isEditableTarget(e.target)) return;
      if (!match(e)) return;
      e.preventDefault();
      this.open();
    };
    document.addEventListener('keydown', this.onLaunchHotkey, true);
  }

  disableLaunchHotkey() {
    if (!this.onLaunchHotkey) return;
    document.removeEventListener('keydown', this.onLaunchHotkey, true);
    this.onLaunchHotkey = null;
  }

  _isEditableTarget(el) {
    if (!el || el.nodeType !== 1) return false;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    return !!el.isContentEditable;
  }

  // ---- DOM -----------------------------------------------------------------

  _createOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'kbt-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'kbt-title');

    const dialog = document.createElement('div');
    dialog.className = 'kbt-dialog';
    dialog.id = 'kbt-dialog-body';
    overlay.appendChild(dialog);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay && !this.isListening && !this.coachActive) this.close();
    });
    overlay.addEventListener('keydown', (e) => {
      // Escape closes the trainer, except while rehearsing or coaching live —
      // in those modes Escape may itself be the shortcut under practice. Because
      // Escape is also a real editor key the learner practices (close the
      // toolbox, leave Edit mode), closing takes TWO presses within 600 ms, so a
      // single practice Escape never dismisses the tutorial by accident.
      if (e.key === 'Escape' && !this.isListening && !this.coachActive) {
        e.preventDefault();
        const now = Date.now();
        if (now - this._lastEscape < 600) {
          this._lastEscape = 0;
          this.close();
        } else {
          this._lastEscape = now;
          announce('Press Escape again to close the trainer.');
        }
      }
    });

    return overlay;
  }

  _render() {
    if (!this.overlay) return;
    // If we drifted off the sandbox tracks (back to Track A, or completion),
    // hand the learner's own blocks back. Staying within sandbox tracks keeps
    // the practice stack in place so it does not flicker between drills.
    if (
      this.live && this.live.isSandboxLoaded && this.live.isSandboxLoaded() &&
      !this.currentTrack.requiresSandbox
    ) {
      this.live.restoreSandbox();
    }
    // Rendering the full card is always the modal view; clear any coach styling.
    this.overlay.classList.remove('kbt-overlay--coach');
    this.overlay.setAttribute('aria-modal', 'true');
    const dialog = this.overlay.querySelector('.kbt-dialog');
    dialog.innerHTML = '';

    const track = this.currentTrack;
    const sc = this.currentShortcut;
    const scNum = this.shortcutIndex + 1;
    const scTotal = track.shortcuts.length;
    const done = this.mastered.has(sc.id);

    // Header
    const header = document.createElement('header');
    header.style.cssText =
      'display:flex;justify-content:space-between;align-items:baseline;gap:var(--spacing-md,16px);';
    const title = document.createElement('h2');
    title.id = 'kbt-title';
    title.style.cssText = 'margin:0;font-size:var(--font-size-2xl,1.5rem);';
    title.textContent = track.title;
    const counter = document.createElement('span');
    counter.style.cssText = 'color:var(--color-text-secondary,#6c757d);';
    counter.textContent =
      `Track ${this.trackIndex + 1} of ${this.tracks.length} · Shortcut ${scNum} of ${scTotal}`;
    header.appendChild(title);
    header.appendChild(counter);
    dialog.appendChild(header);

    // Track description (first shortcut only, keeps the audio short thereafter)
    if (this.shortcutIndex === 0) {
      const desc = document.createElement('p');
      desc.style.cssText = 'color:var(--color-text-secondary,#6c757d);margin:var(--spacing-sm,8px) 0 0;';
      desc.textContent = track.description;
      dialog.appendChild(desc);
    }

    // Shortcut card
    const card = document.createElement('section');
    card.setAttribute('aria-label', 'Current shortcut');
    card.style.cssText =
      'margin:var(--spacing-lg,24px) 0;padding:var(--spacing-lg,24px);' +
      'background:var(--color-surface,#f8f9fa);border-radius:var(--radius-md,8px);';

    const scLabel = document.createElement('h3');
    scLabel.style.cssText = 'margin:0 0 var(--spacing-sm,8px);font-size:var(--font-size-xl,1.25rem);';
    scLabel.textContent = done ? `${sc.label}  (practiced)` : sc.label;
    card.appendChild(scLabel);

    const keyLine = document.createElement('p');
    keyLine.style.cssText = 'margin:0 0 var(--spacing-md,16px);';
    keyLine.innerHTML = `Keys: <span class="kbt-kbd">${sc.keyHint}</span>`;
    card.appendChild(keyLine);

    const instruction = document.createElement('p');
    instruction.style.cssText = 'margin:0;line-height:var(--line-height-relaxed,1.75);';
    instruction.textContent = this._instructionText(sc);
    card.appendChild(instruction);

    // Visual status / listening line for SIGHTED users only. Deliberately NOT an
    // aria-live region: every textContent write here is mirrored by an
    // announce(..., { assertive: true }) call, and announce.js owns the
    // screen-reader channel (queued, drop-resistant). If this carried aria-live
    // too, screen readers would speak every message twice.
    const status = document.createElement('div');
    status.id = 'kbt-status';
    status.style.cssText = 'margin-top:var(--spacing-md,16px);min-height:1.5em;';
    card.appendChild(status);

    dialog.appendChild(card);

    // Controls
    dialog.appendChild(this._buildControls(track, sc));

    // Footer hint
    const footer = document.createElement('p');
    footer.style.cssText =
      'margin:var(--spacing-lg,24px) 0 0;font-size:var(--font-size-sm,0.875rem);' +
      'color:var(--color-text-secondary,#6c757d);';
    footer.textContent = 'Press Escape twice to close the trainer. Your progress is saved automatically.';
    dialog.appendChild(footer);

    // Focus + trap
    if (this.removeTrap) { this.removeTrap(); }
    this.removeTrap = trapFocus(dialog);

    // Announce the instruction for this shortcut (skip the verbose intro, which
    // open() already spoke).
    announce(this._instructionText(sc));
  }

  _instructionText(sc) {
    if (this.verbosity === VERBOSITY.TERSE) {
      return `${sc.label}. Keys: ${sc.keyHint}.`;
    }
    if (this.verbosity === VERBOSITY.NOVICE) {
      const detail = canonicalDetail(sc.helpRow);
      return detail ? `${sc.instruction} ${detail}` : sc.instruction;
    }
    return sc.instruction;
  }

  _buildControls(track, sc) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:var(--spacing-sm,8px);align-items:center;';

    if (this._isLiveStep(sc)) {
      // Live coach: the real editor responds to the keypress.
      const liveBtn = this._button('Try', 'kbt-btn kbt-btn-primary');
      liveBtn.addEventListener('click', () => this._startLive());
      wrap.appendChild(liveBtn);

      const rehearseBtn = this._button('Rehearse instead', 'kbt-btn');
      rehearseBtn.addEventListener('click', () => this._startListening());
      wrap.appendChild(rehearseBtn);
    } else {
      // Not a live step (no `live`, or no workspace available). Rehearsal only
      // matches the keystroke signature, so it works with or without a live
      // workspace — the only thing still gated is `infoOnly`, which is done on
      // the real workspace rather than inside the trainer.
      const tryLabel = sc.infoOnly ? 'Practice on the real workspace' : 'Try it';
      const tryBtn = this._button(tryLabel, 'kbt-btn kbt-btn-primary');
      if (sc.infoOnly) {
        tryBtn.disabled = true;
        tryBtn.title = 'This step is done on the real workspace, not inside the trainer.';
      } else {
        tryBtn.addEventListener('click', () => this._startListening());
      }
      wrap.appendChild(tryBtn);
    }

    const hearBtn = this._button('Hear again', 'kbt-btn');
    hearBtn.addEventListener('click', () => announce(this._instructionText(sc), { assertive: true }));
    wrap.appendChild(hearBtn);

    const skipBtn = this._button('Skip', 'kbt-btn');
    skipBtn.addEventListener('click', () => this._advance(false));
    wrap.appendChild(skipBtn);

    // Spacer
    const spacer = document.createElement('span');
    spacer.style.cssText = 'flex:1 1 auto;';
    wrap.appendChild(spacer);

    const prevBtn = this._button('Previous', 'kbt-btn');
    prevBtn.disabled = this.trackIndex === 0 && this.shortcutIndex === 0;
    prevBtn.addEventListener('click', () => this._goPrevious());
    wrap.appendChild(prevBtn);

    const nextBtn = this._button('Next', 'kbt-btn');
    nextBtn.addEventListener('click', () => this._advance(false));
    wrap.appendChild(nextBtn);

    return wrap;
  }

  _button(label, className) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = className;
    b.textContent = label;
    return b;
  }

  // ---- detection -----------------------------------------------------------

  // Detect signature the learner must press right now. For a chained scenario
  // (sc.sequence) this is the current step; otherwise the single detect.
  _expectedDetect(sc) {
    return sc.sequence ? sc.sequence[this.seqStep].detect : sc.detect;
  }

  _currentPrompt(sc) {
    if (sc.sequence) return sc.sequence[this.seqStep].prompt;
    return `Press ${sc.keyHint} now.`;
  }

  _startListening() {
    if (this.isListening) return;
    const sc = this.currentShortcut;
    this.isListening = true;
    this.seqStep = 0;

    const status = this.overlay.querySelector('#kbt-status');
    status.className = 'kbt-listening';
    const prompt = this._currentPrompt(sc);
    status.textContent = `${prompt} Press Enter to stop.`;
    announce(`${prompt} Press Enter to stop.`, { assertive: true });

    this.onListenKeydown = (e) => this._handleListenKey(e);
    document.addEventListener('keydown', this.onListenKeydown, true);
    this._armTimeout();
  }

  _armTimeout() {
    clearTimeout(this.listenTimer);
    this.listenTimer = setTimeout(() => {
      this._stopListening();
      const s = this.overlay && this.overlay.querySelector('#kbt-status');
      if (s) { s.className = ''; s.textContent = 'No key detected. Choose Try it to practice again.'; }
      announce('No key detected. Choose Try it to practice again.', { assertive: true });
    }, LISTEN_TIMEOUT_MS);
  }

  _handleListenKey(e) {
    // Ignore lone modifier presses.
    if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;

    const sc = this.currentShortcut;
    const expected = this._expectedDetect(sc);
    const expectedKey = expected.key;

    // Enter always cancels. Tab and Escape cancel only when they are NOT the key
    // the learner is meant to press right now.
    const isCancel =
      e.key === 'Enter' ||
      (e.key === 'Tab' && expectedKey !== 'Tab') ||
      (e.key === 'Escape' && expectedKey !== 'Escape');

    // Practice micro-mode: swallow the key so it never reaches the real plugin
    // or moves focus.
    e.preventDefault();
    e.stopPropagation();

    if (isCancel) {
      this._stopListening();
      const status = this.overlay.querySelector('#kbt-status');
      status.className = '';
      status.textContent = 'Stopped. Choose Try it to practice again.';
      announce('Stopped practicing.', { assertive: true });
      return;
    }

    if (matchesShortcut(e, expected)) {
      // Chained scenario: advance through the steps, narrating each.
      if (sc.sequence && this.seqStep < sc.sequence.length - 1) {
        const done = sc.sequence[this.seqStep].done;
        this.seqStep += 1;
        const next = sc.sequence[this.seqStep].prompt;
        const status = this.overlay.querySelector('#kbt-status');
        status.textContent = `${done} ${next}`;
        announce(`${done} ${next}`, { assertive: true });
        this._armTimeout();
        return;
      }
      this._succeed(sc);
    } else {
      const prompt = this._currentPrompt(sc);
      announce(`That was not it. ${prompt} Or press Enter to stop.`, { assertive: true });
      this._armTimeout();
    }
  }

  _succeed(sc) {
    this._stopListening();
    this.mastered.add(sc.id);
    this._persistMastered();
    const status = this.overlay.querySelector('#kbt-status');
    status.className = '';
    status.textContent = `Correct. ${sc.success}`;
    announce(`Correct. ${sc.success}`, { assertive: true });
    setTimeout(() => { if (this.isOpen) this._advance(true); }, 1400);
  }

  _stopListening() {
    if (!this.isListening) return;
    this.isListening = false;
    if (this.onListenKeydown) {
      document.removeEventListener('keydown', this.onListenKeydown, true);
      this.onListenKeydown = null;
    }
    if (this.listenTimer) { clearTimeout(this.listenTimer); this.listenTimer = null; }
  }

  // ---- live coach ----------------------------------------------------------
  //
  // Unlike rehearsal (which swallows the key), live coach lets the keypress
  // reach the real plugin, then confirms success by reading real editor state
  // through the live adapter. The trainer collapses to a non-modal bar so the
  // workspace stays focused and interactive.

  // Normalise a step into an ordered list of live actions. Each action is one
  // keypress to make on the real editor, with an optional state probe to
  // confirm it and a short visual/audio cue.
  _liveActions(sc) {
    if (sc.sequence) {
      return sc.sequence.map((s) => ({
        detect: s.detect,
        prompt: s.prompt,
        done: s.done,
        confirm: s.confirm || null,
        cue: s.cue || null,
        start: s.start || null
      }));
    }
    return [{
      detect: sc.detect,
      prompt: `Press ${sc.keyHint} now, on the real editor.`,
      done: sc.success,
      confirm: (sc.live && sc.live.confirm) || null,
      cue: (sc.live && sc.live.cue) || null,
      start: (sc.live && sc.live.start) || null
    }];
  }

  _startLive() {
    if (this.coachActive || this.isListening) return;
    if (!this._isLiveStep(this.currentShortcut)) { this._startListening(); return; }

    const sc = this.currentShortcut;
    this.coachActive = true;
    this.liveBusy = false;
    this.liveActions = this._liveActions(sc);
    this.liveIndex = 0;

    // Steps that act on a real program need blocks under the cursor: every
    // shortcut in a `requiresSandbox` track, plus individual steps elsewhere
    // (run, output, the navigational assistant) flagged `needsBlocks`. Drop in
    // the practice stack — stashing the learner's own blocks — before anything
    // else, so the keypress has something real to act on.
    const needsBlocks =
      this.currentTrack.requiresSandbox || !!(sc.live && sc.live.needsBlocks);
    if (needsBlocks) {
      // Start every live drill from the pristine practice stack. The first time
      // we stash the learner's own blocks and lay the stack down; after that we
      // re-lay it, because an earlier editing drill may have moved, cut, or
      // deleted a block and left the next drill's start anchor dangling.
      if (this.live.isSandboxLoaded && this.live.isSandboxLoaded()) {
        if (this.live.resetSandbox) this.live.resetSandbox();
      } else if (this.live.loadSandbox) {
        this.live.loadSandbox();
      }
    }

    // Most navigation shortcuts (toolbox, movement, run) only fire when keyboard
    // navigation is ON. If a step needs it and it is currently off, lead with the
    // master switch so the learner never presses a key that silently does nothing.
    if (sc.live && sc.live.requiresKeyboardNav && !this.live.probe('keyboardNavOn')) {
      this.liveActions.unshift({
        detect: { code: 'KeyK', shift: true, ctrl: true },
        prompt:
          'First, keyboard navigation is off — so the next keys would do nothing. ' +
          'With the workspace focused, press Control, plus Shift, plus K to turn it ' +
          'on. Use Control even on a Mac, not Command.',
        done: 'Keyboard navigation on. Now for the step.',
        confirm: 'keyboardNavOn',
        cue: 'Keyboard navigation ON — a marker is now blinking on the workspace, and you control the editor.'
      });
    }

    this._enterCoachMode();
    this.live.focusWorkspace();

    this.onLiveKeydown = (e) => this._handleLiveKey(e);
    document.addEventListener('keydown', this.onLiveKeydown, true);

    // For BVI learners who cannot see the canvas, describe what is on the
    // workspace before asking them to act on it.
    let context = '';
    if (needsBlocks && this.live.describeWorkspace) {
      context = this.live.describeWorkspace();
    }
    announce(
      'Live practice. Your keypresses now reach the real editor. ' +
      (context ? context + ' ' : '') +
      'Choose Stop to leave practice.',
      { assertive: true }
    );
    this._promptLive();
  }

  _enterCoachMode() {
    if (this.removeTrap) { this.removeTrap(); this.removeTrap = null; }
    this.overlay.classList.add('kbt-overlay--coach');
    this.overlay.setAttribute('aria-modal', 'false');
    // Swap the primary control to a Stop affordance for this session.
    const primary = this.overlay.querySelector('.kbt-btn-primary');
    if (primary) {
      primary.textContent = 'Stop live practice';
      primary.onclick = null;
      const stop = primary.cloneNode(true);
      primary.parentNode.replaceChild(stop, primary);
      stop.addEventListener('click', () => {
        this._stopLive();
        const status = this.overlay && this.overlay.querySelector('#kbt-status');
        if (status) { status.className = ''; status.textContent = 'Left live practice.'; }
        announce('Left live practice.', { assertive: true });
      });
    }
  }


  // Whether an action's confirmation condition is currently satisfied. Most
  // confirms are boolean state probes; `cursorMoved` is special — it passes
  // when the cursor has left the spot it was on when this action was prompted.
  _confirmSatisfied(action) {
    if (!action.confirm) return false;
    if (action.confirm === 'cursorMoved') {
      const sig = this.live.cursorSignature ? this.live.cursorSignature() : null;
      return sig !== null && sig !== this._cursorBaseline;
    }
    // `workspaceChanged` passes when the serialized program differs from the
    // snapshot taken when this action was prompted — i.e. the edit landed.
    if (action.confirm === 'workspaceChanged') {
      const sig = this.live.workspaceSignature ? this.live.workspaceSignature() : null;
      return sig !== null && sig !== this._wsBaseline;
    }
    return this.live.probe(action.confirm);
  }

  _promptLive() {
    if (!this.coachActive) return;
    const action = this.liveActions[this.liveIndex];
    const status = this.overlay.querySelector('#kbt-status');

    // Park the cursor on the drill's start block (movement steps), then snapshot
    // where it is so `cursorMoved` can tell when the learner's key moved it.
    if (action.start && this.live.placeCursor) this.live.placeCursor(action.start);
    if (action.confirm === 'cursorMoved') {
      this._cursorBaseline = this.live.cursorSignature ? this.live.cursorSignature() : null;
    }
    if (action.confirm === 'workspaceChanged') {
      // Snapshot the program AFTER parking the cursor (parking does not edit the
      // program), so the only thing that can change the snapshot is the edit key.
      this._wsBaseline = this.live.workspaceSignature ? this.live.workspaceSignature() : null;
    }

    // If the editor is already in the target state, acknowledge and move on so
    // the learner is never asked to do something already done.
    if (this._confirmSatisfied(action)) {
      this.liveBusy = true;
      if (status) { status.className = ''; status.textContent = action.cue || 'Already done.'; }
      announce(action.cue || 'Already done.', { assertive: true });
      this.livePollTimer = setTimeout(() => this._liveActionPassed(action), 900);
      return;
    }

    this.liveBusy = false;
    if (status) { status.className = 'kbt-listening'; status.textContent = action.prompt; }
    announce(action.prompt, { assertive: true });
    this._armLiveTimeout();
  }

  _armLiveTimeout() {
    clearTimeout(this.liveTimer);
    this.liveTimer = setTimeout(() => {
      if (!this.coachActive) return;
      const action = this.liveActions[this.liveIndex];
      announce(`Still waiting. ${action.prompt} Or choose Stop to leave practice.`, { assertive: true });
      this._armLiveTimeout();
    }, 15000);
  }

  _handleLiveKey(e) {
    if (!this.coachActive || this.liveBusy) return;
    if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
    const action = this.liveActions[this.liveIndex];
    if (!matchesShortcut(e, action.detect)) return;
    // Deliberately NOT preventing default: the real plugin must act on this key.
    this.liveBusy = true;
    clearTimeout(this.liveTimer);
    this._confirmLive(action);
  }

  _confirmLive(action) {
    // No probe for this action: trust the keypress (the real plugin already
    // acted) and pass after a brief beat.
    if (!action.confirm) {
      this.livePollTimer = setTimeout(() => this._liveActionPassed(action), 250);
      return;
    }
    const deadline = Date.now() + 1800;
    const poll = () => {
      if (!this.coachActive) return;
      if (this._confirmSatisfied(action)) { this._liveActionPassed(action); return; }
      if (Date.now() > deadline) {
        this.liveBusy = false;
        const status = this.overlay && this.overlay.querySelector('#kbt-status');
        if (status) status.textContent = `Did not detect the change. ${action.prompt}`;
        announce(`I did not detect the editor change. ${action.prompt}`, { assertive: true });
        this._armLiveTimeout();
        return;
      }
      this.livePollTimer = setTimeout(poll, 90);
    };
    poll();
  }

  _liveActionPassed(action) {
    if (!this.coachActive) return;
    // Movement drills have no fixed cue — describe where the cursor landed.
    let cue = action.cue;
    if (!cue && action.confirm === 'cursorMoved' && this.live.cursorDescription) {
      cue = `Cursor moved — you are now on ${this.live.cursorDescription()}.`;
    }
    if (cue) this._showCue(cue);

    if (this.liveIndex < this.liveActions.length - 1) {
      if (action.done) announce(action.done, { assertive: true });
      this.liveIndex += 1;
      this._promptLive();
      return;
    }

    // Whole scenario complete. Tear down the live listeners but leave the coach
    // bar showing the success line; _advance re-renders to the next card.
    const sc = this.currentShortcut;
    this.mastered.add(sc.id);
    this._persistMastered();
    this._teardownLive();
    const status = this.overlay && this.overlay.querySelector('#kbt-status');
    if (status) { status.className = ''; status.textContent = `Correct. ${sc.success}`; }
    announce(`Correct. ${sc.success}`, { assertive: true });
    setTimeout(() => { if (this.isOpen) this._advance(true); }, 1600);
  }

  // Tear down live listeners/timers without touching the DOM. The coach bar
  // styling is reset by the next _render() (see top of _render).
  _teardownLive() {
    this.coachActive = false;
    this.liveBusy = false;
    if (this.onLiveKeydown) {
      document.removeEventListener('keydown', this.onLiveKeydown, true);
      this.onLiveKeydown = null;
    }
    clearTimeout(this.liveTimer); this.liveTimer = null;
    clearTimeout(this.livePollTimer); this.livePollTimer = null;
  }

  _stopLive() {
    const wasActive = this.coachActive;
    this._teardownLive();
    // Manual stop (not a completion): rebuild the normal card immediately.
    if (wasActive && this.isOpen) this._render();
  }

  _showCue(text) {
    let cue = document.getElementById('kbt-cue');
    if (!cue) {
      cue = document.createElement('div');
      cue.id = 'kbt-cue';
      cue.className = 'kbt-cue';
      cue.setAttribute('role', 'status');
      document.body.appendChild(cue);
    }
    cue.textContent = text;
    // Force reflow so re-triggering the transition works on repeat cues.
    void cue.offsetWidth;
    cue.classList.add('kbt-cue--show');
    clearTimeout(this.cueTimer);
    this.cueTimer = setTimeout(() => {
      if (cue) cue.classList.remove('kbt-cue--show');
    }, 3500);
  }

  _removeCue() {
    clearTimeout(this.cueTimer);
    const cue = document.getElementById('kbt-cue');
    if (cue && cue.parentNode) cue.parentNode.removeChild(cue);
  }

  // ---- navigation ----------------------------------------------------------

  _advance(wasMastered) {
    this._stopListening();
    this._stopLive();
    const track = this.currentTrack;

    if (this.shortcutIndex < track.shortcuts.length - 1) {
      this.shortcutIndex += 1;
    } else if (this.trackIndex < this.tracks.length - 1) {
      this.trackIndex += 1;
      this.shortcutIndex = 0;
      announce(`Track complete. Next track: ${this.currentTrack.title}.`);
    } else {
      this._renderCompletion();
      return;
    }
    this._render();
  }

  _goPrevious() {
    this._stopListening();
    this._stopLive();
    if (this.shortcutIndex > 0) {
      this.shortcutIndex -= 1;
    } else if (this.trackIndex > 0) {
      this.trackIndex -= 1;
      this.shortcutIndex = this.currentTrack.shortcuts.length - 1;
    } else {
      return;
    }
    this._render();
  }

  _renderCompletion() {
    const dialog = this.overlay.querySelector('.kbt-dialog');
    dialog.innerHTML = '';
    const total = getAllShortcuts().length;

    const h = document.createElement('h2');
    h.id = 'kbt-title';
    h.textContent = 'You reached the end of the trainer';
    dialog.appendChild(h);

    const p = document.createElement('p');
    p.style.cssText = 'line-height:var(--line-height-relaxed,1.75);';
    p.textContent =
      `You have practiced ${this.mastered.size} of ${total} shortcuts. You can ` +
      `start over to review, or close the trainer.`;
    dialog.appendChild(p);

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:var(--spacing-sm,8px);margin-top:var(--spacing-lg,24px);';
    const restart = this._button('Start over', 'kbt-btn kbt-btn-primary');
    restart.addEventListener('click', () => {
      this.trackIndex = 0;
      this.shortcutIndex = 0;
      this._render();
    });
    const closeBtn = this._button('Close', 'kbt-btn');
    closeBtn.addEventListener('click', () => this.close());
    wrap.appendChild(restart);
    wrap.appendChild(closeBtn);
    dialog.appendChild(wrap);

    if (this.removeTrap) { this.removeTrap(); }
    this.removeTrap = trapFocus(dialog);
    announce(
      `Trainer complete. You practiced ${this.mastered.size} of ${total} shortcuts. ` +
      `Start over or close.`
    );
  }

  // ---- public helpers ------------------------------------------------------

  setVerbosity(level) {
    if (Object.values(VERBOSITY).includes(level)) {
      this.verbosity = level;
      if (this.isOpen) this._render();
    }
  }

  resetProgress() {
    this.mastered = new Set();
    this._persistMastered();
  }
}

export { VERBOSITY };
