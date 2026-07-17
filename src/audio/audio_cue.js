/**
 * @fileoverview Non-verbal audio feedback for keyboard navigation.
 *
 * Refined based on established earcon design research:
 *
 * - Brewster, Wright & Edwards (1995). "Experimentally derived guidelines
 *   for the creation of earcons." Proc. HCI'95.
 *   → Wider pitch gaps (perfect fifths/octaves) for absolute recognition.
 *   → Richer timbres than pure sine waves.
 *   → Combined pitch + rhythm + timbre for differentiation.
 *
 * - Blattner, Sumikawa & Greenberg (1989). "Earcons and icons: Their
 *   structure and common design principles." HCI 4(1).
 *   → Earcon FAMILIES share common timbre/register; rhythm differentiates
 *     sub-groups; pitch differentiates leaves.
 *   → Falling pitch = exit/down (metaphorical mapping).
 *
 * - Stefik, Hundhausen & Patterson (2011). "An empirical investigation into
 *   the design of auditory cues to enhance computer program comprehension."
 *   → Pitch encoding nesting depth aids program comprehension.
 *
 * - Walker, Nance & Lindsay (2006); Palladino & Walker (2007).
 *   "Spearcons (speech-based earcons)."
 *   → Sped-up speech conveys IDENTITY faster than full speech and with
 *     near-speech accuracy. Earcons convey STATE (depth/category) but are
 *     weak at identity. This implementation combines them (HYBRID mode):
 *     earcon = state (depth via pitch, category via timbre),
 *     spearcon = identity (the block's name, sped up).
 *
 * AUDIO MODES:
 *   'earcon'   — tones only (default; existing behavior)
 *   'spearcon' — sped-up speech only (block identity)
 *   'hybrid'   — earcon first, then spearcon after a small delay
 *
 * EARCON FAMILIES:
 *   Family 1 — NAVIGATION (sine wave, with overtone)
 *   Family 2 — ACTION (triangle wave)
 *   Family 3 — STATE (square wave)
 *   Family 4 — STATUS (sawtooth wave)
 *
 * Off by default. Toggle with Shift+M. Cycle modes with Shift+J.
 */

import * as Blockly from 'blockly/core';

export class AudioCue {

    constructor() {
        /** @type {?AudioContext} Lazily created on first enable */
        this._ctx = null;

        /** @type {boolean} Master on/off */
        this._enabled = false;

        /** @type {number} Master volume 0.0–1.0 (tones only) */
        this._volume = 0.08;

        /**
         * Audio mode: 'earcon' | 'spearcon' | 'hybrid'
         * Default 'earcon' preserves existing behavior.
         * @type {string}
         */
        this._audioMode = 'earcon';

        /**
         * Spearcon playback rate (speed multiplier for sped-up speech).
         * 1.0 = normal speech; ~2.2 = compressed but still recognizable.
         * Above ~3.5 it tends to become unrecognizable.
         * @type {number}
         */
        this._spearconRate = 2.2;

        /**
         * Delay (ms) before the spearcon plays in HYBRID mode, so the earcon
         * (state) is heard first, then the spearcon (identity).
         * @type {number}
         */
        this._hybridDelayMs = 130;

        /**
         * Delay (ms) before the full aria-live announcement (read by VoiceOver)
         * fires in spearcon/hybrid mode, so the spearcon is heard first and
         * VoiceOver's fuller detail comes after.
         * @type {number}
         */
        this._spearconAnnounceDelay = 700;

        /**
         * Pitch per nesting depth (Brewster 1995: wide musical-interval gaps
         * for absolute recognition). A3 → E4 → A4 → E5 → A5 → C6 → E6.
         * @type {number[]}
         */
        this._depthFrequencies = [
            220,   // depth 0 — workspace / stack (A3)
            330,   // depth 1 — top-level block   (E4) — perfect fifth up
            440,   // depth 2 — inside 1 container (A4) — octave from depth 0
            659,   // depth 3 — inside 2 containers (E5) — perfect fifth from depth 2
            880,   // depth 4 (A5) — octave from depth 2
            1047,  // depth 5 (C6)
            1319,  // depth 6+ cap (E6)
        ];

        /**
         * Earcon family timbres (Blattner 1989).
         */
        this._family = {
            NAVIGATION: 'sine',
            ACTION: 'triangle',
            STATE: 'square',
            STATUS: 'sawtooth',
        };
    }

    // ─── Public API ───────────────────────────────────────

    setEnabled(on) {
        this._enabled = !!on;
        if (this._enabled && !this._ctx) {
            try {
                this._ctx = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.warn('AudioCue: Web Audio API not available', e);
                this._enabled = false;
            }
        }
    }

    isEnabled() {
        return this._enabled;
    }

    setVolume(vol) {
        this._volume = Math.max(0, Math.min(1, vol));
    }

    resumeIfSuspended() {
        if (this._ctx && this._ctx.state === 'suspended') {
            this._ctx.resume().catch(() => { });
        }
    }

    // ─── Mode control (earcon / spearcon / hybrid) ────────

    /**
     * Set the audio mode.
     * @param {'earcon'|'spearcon'|'hybrid'} mode
     */
    setAudioMode(mode) {
        if (mode === 'earcon' || mode === 'spearcon' || mode === 'hybrid') {
            this._audioMode = mode;
            // Stop any pending spearcons when switching modes
            this._cancelSpearcons();
        }
    }

    getAudioMode() {
        return this._audioMode;
    }

    /**
     * Cycle to the next mode (earcon → spearcon → hybrid → earcon).
     * @returns {string} the new mode
     */
    cycleAudioMode() {
        const order = ['earcon', 'spearcon', 'hybrid'];
        const i = order.indexOf(this._audioMode);
        this._audioMode = order[(i + 1) % order.length];
        this._cancelSpearcons();
        return this._audioMode;
    }

    /**
     * Set spearcon playback rate (1.0–4.0). ~2.2 is a good default.
     */
    setSpearconRate(rate) {
        this._spearconRate = Math.max(1, Math.min(4, rate));
    }

    /**
     * Delay (ms) before the full aria-live/VoiceOver announcement fires in
     * spearcon/hybrid mode, so the spearcon is heard first.
     */
    getSpearconAnnounceDelay() {
        return this._spearconAnnounceDelay;
    }

    setSpearconAnnounceDelay(ms) {
        this._spearconAnnounceDelay = Math.max(0, Math.min(2000, ms));
    }

    /** Whether the current mode plays tones. */
    _wantsEarcon() {
        return this._audioMode === 'earcon' || this._audioMode === 'hybrid';
    }

    /** Whether the current mode plays spearcons. */
    _wantsSpearcon() {
        return this._audioMode === 'spearcon' || this._audioMode === 'hybrid';
    }

    // ─── FAMILY 1: NAVIGATION (sine + overtone) ───────────
    // These now accept an optional `block` so that, in spearcon/hybrid mode,
    // the block's identity can be spoken alongside (or instead of) the tone.

    /**
     * W/S keys — vertical block movement.
     * Earcon: pitch encodes nesting depth (Stefik 2011).
     * Spearcon: speaks the block identity.
     * @param {number} depth
     * @param {?Blockly.BlockSvg} block Optional source block for identity
     */
    playVerticalMove(depth, block = null) {
        if (!this._enabled) return;
        if (this._wantsEarcon() && this._canPlay()) {
            const freq = this._freqForDepth(depth);
            this._beep(freq, 0.06, this._family.NAVIGATION);
            this._beep(freq * 2, 0.06, this._family.NAVIGATION, 0, this._volume * 0.3);
        }
        if (this._wantsSpearcon()) {
            this._playBlockSpearcon(block, this._audioMode === 'hybrid' ? this._hybridDelayMs : 0);
        }
    }

    /**
     * A/D keys — horizontal navigation.
     * @param {number} depth
     * @param {'left'|'right'} direction
     * @param {?Blockly.BlockSvg} block
     */
    playHorizontalMove(depth, direction = 'right', block = null) {
        if (!this._enabled) return;
        if (this._wantsEarcon() && this._canPlay()) {
            const freq = this._freqForDepth(depth);
            if (direction === 'right') {
                this._beep(freq, 0.04, this._family.NAVIGATION);
                this._beep(freq * 1.5, 0.04, this._family.NAVIGATION, 0.05);
            } else {
                this._beep(freq * 1.5, 0.04, this._family.NAVIGATION);
                this._beep(freq, 0.04, this._family.NAVIGATION, 0.05);
            }
        }
        if (this._wantsSpearcon()) {
            this._playBlockSpearcon(block, this._audioMode === 'hybrid' ? this._hybridDelayMs : 0);
        }
    }

    /**
     * F key — nesting deeper. Rising chirp.
     * @param {number} fromDepth
     * @param {number} toDepth
     * @param {?Blockly.BlockSvg} block
     */
    playLayerIn(fromDepth, toDepth, block = null) {
        if (!this._enabled) return;
        if (this._wantsEarcon() && this._canPlay()) {
            this._chirp(
                this._freqForDepth(fromDepth),
                this._freqForDepth(toDepth),
                0.12,
                this._family.NAVIGATION
            );
        }
        if (this._wantsSpearcon()) {
            this._playBlockSpearcon(block, this._audioMode === 'hybrid' ? this._hybridDelayMs : 0);
        }
    }

    /**
     * Q key — nesting shallower. Falling chirp.
     * @param {number} fromDepth
     * @param {number} toDepth
     * @param {?Blockly.BlockSvg} block
     */
    playLayerOut(fromDepth, toDepth, block = null) {
        if (!this._enabled) return;
        if (this._wantsEarcon() && this._canPlay()) {
            this._chirp(
                this._freqForDepth(fromDepth),
                this._freqForDepth(toDepth),
                0.12,
                this._family.NAVIGATION
            );
        }
        if (this._wantsSpearcon()) {
            this._playBlockSpearcon(block, this._audioMode === 'hybrid' ? this._hybridDelayMs : 0);
        }
    }

    // ─── FAMILY 2: ACTION (triangle wave) ─────────────────
    // Action cues stay earcon-only. The speech system already announces the
    // action ("Deleted print block"), so adding a spearcon here would be
    // redundant. They play a tone whenever earcon OR hybrid mode is active;
    // in pure spearcon mode they are silent (speech still fires separately).

    playInsert() {
        if (!this._wantsEarcon() || !this._canPlay()) return;
        this._beep(523, 0.05, this._family.ACTION);          // C5
        this._beep(659, 0.05, this._family.ACTION, 0.06);    // E5
        this._beep(784, 0.06, this._family.ACTION, 0.12);    // G5 (3 notes climbing)
    }

    playDelete() {
        if (!this._wantsEarcon() || !this._canPlay()) return;
        this._beep(440, 0.08, this._family.ACTION);          // A4
        this._beep(220, 0.12, this._family.ACTION, 0.10);    // A3 (2 notes, drops an octave)
    }

    playDisconnect() {
        if (!this._wantsEarcon() || !this._canPlay()) return;
        this._beep(523, 0.04, this._family.ACTION);          // C5 brief
        this._beep(247, 0.10, this._family.ACTION, 0.10);    // B3 after a gap (pull apart)
    }

    playAttach() {
        if (!this._wantsEarcon() || !this._canPlay()) return;
        this._beep(330, 0.05, this._family.ACTION);          // E4
        this._beep(523, 0.10, this._family.ACTION, 0.05);    // C5 (lands high = connected)
    }

    playCut() {
        if (!this._wantsEarcon() || !this._canPlay()) return;
        this._beep(440, 0.15, this._family.ACTION);          // A4 sustained
    }

    playUndo() {
        if (!this._wantsEarcon() || !this._canPlay()) return;
        this._chirp(660, 440, 0.08, this._family.ACTION);
        this._chirp(440, 220, 0.08, this._family.ACTION, 0.08);  // two-stage fall
    }

    // ─── FAMILY 3: STATE (square wave) ────────────────────

    playBoundary() {
        if (!this._wantsEarcon() || !this._canPlay()) return;
        this._beep(150, 0.1, this._family.STATE, 0, this._volume * 0.6);
    }

    playEditModeEnter() {
        if (!this._wantsEarcon() || !this._canPlay()) return;
        this._beep(392, 0.07, this._family.STATE);          // G4
        this._beep(523, 0.07, this._family.STATE, 0.09);    // C5
        this._beep(784, 0.10, this._family.STATE, 0.18);    // G5 (climb)
    }

    playEditModeExit() {
        if (!this._wantsEarcon() || !this._canPlay()) return;
        this._beep(392, 0.12, this._family.STATE);          // G4 sustained
        this._beep(262, 0.14, this._family.STATE, 0.14);    // C4 (drops below)
    }

    // ─── FAMILY 4: STATUS (sawtooth wave) ─────────────────

    playRunStart() {
        if (!this._wantsEarcon() || !this._canPlay()) return;
        this._chirp(220, 440, 0.18, this._family.STATUS);
    }

    playRunSuccess() {
        if (!this._wantsEarcon() || !this._canPlay()) return;
        this._beep(523, 0.1, this._family.STATUS);          // C5
        this._beep(659, 0.1, this._family.STATUS, 0.10);    // E5
        this._beep(784, 0.15, this._family.STATUS, 0.20);   // G5
    }

    playRunError() {
        if (!this._wantsEarcon() || !this._canPlay()) return;
        this._beep(311, 0.18, this._family.STATUS, 0, this._volume * 0.7);  // Eb4
        this._beep(330, 0.18, this._family.STATUS, 0, this._volume * 0.7);  // E4 (dissonant)
    }

    // ─── State Transitions (NAVIGATION family) ────────────

    playOpenToolbox() {
        if (!this._wantsEarcon() || !this._canPlay()) return;
        this._beep(392, 0.05, this._family.NAVIGATION);          // G4
        this._beep(523, 0.05, this._family.NAVIGATION, 0.06);    // C5
    }

    playCloseToolbox() {
        if (!this._wantsEarcon() || !this._canPlay()) return;
        this._beep(523, 0.05, this._family.NAVIGATION);          // C5
        this._beep(330, 0.07, this._family.NAVIGATION, 0.06);    // E4 (drops further)
    }

    // ─── Reorder Confirmation (NAVIGATION family) ─────────

    playReorderUp() {
        if (!this._wantsEarcon() || !this._canPlay()) return;
        this._chirp(330, 494, 0.08, this._family.NAVIGATION);
    }

    playReorderDown() {
        if (!this._wantsEarcon() || !this._canPlay()) return;
        this._chirp(494, 330, 0.08, this._family.NAVIGATION);
    }

    // ─── Stack Jump (STATE family) ────────────────────────

    playStackJump(destinationDepth) {
        if (!this._wantsEarcon() || !this._canPlay()) return;
        this._chirp(880, this._freqForDepth(destinationDepth || 0), 0.15, this._family.STATE);
    }

    // ─── SPEARCON SUPPORT ─────────────────────────────────
    // Spearcons = sped-up speech that conveys block IDENTITY.
    // Uses the browser Web Speech API (separate from the Web Audio tones).

    /**
     * Speak a block's identity as a spearcon (optionally after a delay).
     * @param {?Blockly.BlockSvg} block
     * @param {number} delayMs Delay before speaking (used in hybrid mode)
     */
    _playBlockSpearcon(block, delayMs = 0) {
        const label = this._blockTypeToLabel(block);
        if (!label) return;
        if (delayMs > 0) {
            setTimeout(() => this._playSpearcon(label), delayMs);
        } else {
            this._playSpearcon(label);
        }
    }

    /**
     * Speak the given text sped up (spearcon).
     * @param {string} text
     */

    /** 
    _playSpearcon(text) {
        if (!('speechSynthesis' in window)) return;
        try {
            // Cancel any queued spearcon so fast navigation doesn't back up.
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(String(text));
            u.rate = this._spearconRate;  // sped up
            u.pitch = 1.0;
            u.volume = 1.0;               // speech volume independent of tone volume
            console.log(`🗣️ SPEARCON: "${text}" rate=${this._spearconRate}`);
            window.speechSynthesis.speak(u);
        } catch (e) {
            console.warn('AudioCue: spearcon failed', e);
        }
    } */

    _playSpearcon(text) {
        if (!('speechSynthesis' in window)) return;
        try {
            // Only cancel if a spearcon is actually mid-speech — blindly
            // calling cancel() every time can kill the utterance before it
            // starts, especially when VoiceOver is also active.
            if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
                window.speechSynthesis.cancel();
            }

            // Chrome sometimes leaves speechSynthesis in a paused state
            // (especially after VoiceOver activity). Nudge it awake.
            window.speechSynthesis.resume();

            const u = new SpeechSynthesisUtterance(String(text));
            u.rate = this._spearconRate;  // sped up
            u.pitch = 1.0;
            u.volume = 1.0;               // speech volume independent of tone volume

            // Explicitly pick an English voice. With VoiceOver on, the default
            // voice is sometimes not selected, which can cause silence.
            const voices = window.speechSynthesis.getVoices();
            if (voices && voices.length) {
                const en = voices.find(v => v.lang && v.lang.startsWith('en'));
                if (en) u.voice = en;
            }

            console.log(`🗣️ SPEARCON: "${text}" rate=${this._spearconRate}`);
            window.speechSynthesis.speak(u);
        } catch (e) {
            console.warn('AudioCue: spearcon failed', e);
        }
    }

    _cancelSpearcons() {
        if ('speechSynthesis' in window) {
            try { window.speechSynthesis.cancel(); } catch (e) { }
        }
    }

    /**
     * Map a Blockly block to a short spoken label for its spearcon.
     * Short labels keep the spearcon fast.
     * @param {?Blockly.BlockSvg} block
     * @returns {?string}
     */
    _blockTypeToLabel(block) {
        if (!block || !block.type) return null;
        const type = block.type;

        const map = {
            // Loops
            controls_repeat_ext: 'repeat',
            controls_repeat: 'repeat',
            controls_whileUntil: 'while',
            controls_for: 'for',
            controls_forEach: 'for each',
            // Logic
            controls_if: 'if',
            controls_ifelse: 'if else',
            logic_compare: 'compare',
            logic_operation: 'and or',
            logic_negate: 'not',
            logic_boolean: 'boolean',
            logic_null: 'null',
            logic_ternary: 'ternary',
            // Variables
            variables_set: 'set',
            variables_get: 'get',
            math_change: 'change',
            // Math
            math_number: 'number',
            math_arithmetic: 'math',
            math_single: 'math function',
            math_round: 'round',
            math_modulo: 'modulo',
            math_random_int: 'random',
            // Text
            text: 'text',
            text_print: 'print',
            text_join: 'join',
            text_length: 'length',
            text_append: 'append',
            // Procedures
            procedures_defnoreturn: 'function',
            procedures_defreturn: 'function',
            procedures_callnoreturn: 'call',
            procedures_callreturn: 'call',
        };

        if (map[type]) return map[type];

        // Fallback: turn the raw type into something pronounceable.
        return type.replace(/_/g, ' ');
    }

    // ─── Depth Calculation ────────────────────────────────

    static getBlockDepth(block) {
        if (!block) return 0;
        // Count only TRUE container nesting (blocks inside a "do"/statement slot),
        // not sibling blocks stacked below each other.
        // getSurroundParent() walks up only through containers, skipping siblings.
        let depth = 1;
        let surround = block.getSurroundParent?.();
        while (surround) {
            depth++;
            surround = surround.getSurroundParent?.();
        }
        return depth;
    }

    static getNodeDepth(node) {
        if (!node) return 0;
        const type = node.getType?.();
        if (type === Blockly.ASTNode.types.WORKSPACE ||
            type === Blockly.ASTNode.types.STACK) {
            return 0;
        }
        let block = null;
        if (typeof node.getSourceBlock === 'function') {
            block = node.getSourceBlock();
        } else if (typeof node.getLocation === 'function') {
            const loc = node.getLocation();
            block = loc?.getSourceBlock?.() || null;
        }
        return AudioCue.getBlockDepth(block);
    }

    /**
 * DEBUG: Logs full info about the node the cursor is on.
 * Call from navigation_controller's patchCursor, or from console.
 */
    static debugNode(node) {
        if (!node) {
            console.log('🔍 DEBUG: node is null');
            return;
        }

        const nodeType = node.getType?.() || 'unknown';
        const block = AudioCue.getNodeBlock(node);
        const depth = AudioCue.getNodeDepth(node);

        // Frequency table (must match _depthFrequencies)
        const freqTable = [220, 330, 440, 659, 880, 1047, 1319];
        const freq = freqTable[Math.min(depth, freqTable.length - 1)];

        let blockType = 'none';
        let blockText = 'none';
        let parentChain = [];

        if (block) {
            blockType = block.type || 'unknown';
            blockText = (block.toString?.() || '').slice(0, 50);
            // Walk up the parent chain to show nesting
            let p = block.getParent?.();
            while (p) {
                parentChain.push(p.type);
                p = p.getParent?.();
            }
        }

        console.log(
            `🔍 DEBUG NODE:\n` +
            `   node type   : ${nodeType}\n` +
            `   block type  : ${blockType}\n` +
            `   block text  : "${blockText}"\n` +
            `   DEPTH       : ${depth}  →  FREQUENCY: ${freq} Hz\n` +
            `   parent chain: ${parentChain.length ? parentChain.join(' → ') : '(top level, no parents)'}`
        );
    }

    /**
     * Helper: extract the source block from an AST node (for identity).
     * @param {?Blockly.ASTNode} node
     * @returns {?Blockly.BlockSvg}
     */
    static getNodeBlock(node) {
        if (!node) return null;
        if (typeof node.getSourceBlock === 'function') {
            return node.getSourceBlock();
        }
        if (typeof node.getLocation === 'function') {
            const loc = node.getLocation();
            return loc?.getSourceBlock?.() || null;
        }
        return null;
    }

    // ─── Internal Helpers ─────────────────────────────────

    _canPlay() {
        return !!(this._enabled && this._ctx && this._ctx.state === 'running');
    }

    _freqForDepth(depth) {
        const idx = Math.min(
            Math.max(0, depth),
            this._depthFrequencies.length - 1
        );
        return this._depthFrequencies[idx];
    }

    _beep(freq, duration, waveform = 'sine', delay = 0, vol = null) {
        console.log(`🔊 BEEP: ${freq.toFixed(0)}Hz ${waveform} for ${(duration * 1000).toFixed(0)}ms`);
        const ctx = this._ctx;
        const now = ctx.currentTime + delay;
        const v = vol !== null ? vol : this._volume;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = waveform;
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(v, now + 0.005);
        gain.gain.setValueAtTime(v, now + duration - 0.015);
        gain.gain.linearRampToValueAtTime(0, now + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + duration);
    }

    _chirp(startFreq, endFreq, duration, waveform = 'sine', delay = 0) {
        console.log(`🎵 CHIRP: ${startFreq.toFixed(0)}Hz → ${endFreq.toFixed(0)}Hz ${waveform} for ${(duration * 1000).toFixed(0)}ms`);
        const ctx = this._ctx;
        const now = ctx.currentTime + delay;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = waveform;
        osc.frequency.setValueAtTime(startFreq, now);
        osc.frequency.exponentialRampToValueAtTime(
            Math.max(endFreq, 1),
            now + duration
        );

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(this._volume, now + 0.005);
        gain.gain.setValueAtTime(this._volume, now + duration - 0.02);
        gain.gain.linearRampToValueAtTime(0, now + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + duration + 0.01);
    }
}