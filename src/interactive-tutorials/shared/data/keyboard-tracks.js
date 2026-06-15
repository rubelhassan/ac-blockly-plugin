/**
 * Keyboard Trainer track definitions.
 *
 * These tracks are a CURATED teaching layer over the canonical shortcut list in
 * `src/constants.js` (SHORTCUT_HELP_ROWS). We do not feed the raw rows into the
 * trainer because:
 *   1. The raw list contains ambiguous duplicates (e.g. Shift+W maps to both
 *      "move statement block up" and "move the workspace marker up"). A learner
 *      practising "Shift+W" could not tell which one fired. We resolve this by
 *      TEACHING THE TWO MEANINGS IN DIFFERENT CONTEXTS: the workspace marker in
 *      the Navigation track, the block move in the Editing track, and we verify
 *      the block move by watching the real workspace actually change.
 *   2. Most shortcuts are only meaningful with a live workspace + a cursor on a
 *      block. Those run as "live coach" steps (a `live` descriptor) and are
 *      confirmed from real editor state; the rest fall back to rehearsal.
 *
 * TWO TRACKS, by intent (from the BVI co-design sessions):
 *   - Navigation — read and explore WITHOUT changing the program. Move the
 *     marker over the canvas, move the cursor between blocks, nest in and out,
 *     open the toolbox, ask "where am I", run, and hear output.
 *   - Editing — CHANGE the program. Edit mode, move a block, disconnect, cut and
 *     paste, delete, label a stack, comment.
 *
 * VERIFICATION, honestly:
 *   - Cursor moves are confirmed with `cursorMoved` (the cursor's node id
 *     changes).
 *   - Edits are confirmed with `workspaceChanged` (the serialized workspace
 *     changes) — one cheap probe that covers move/disconnect/cut/paste/delete/
 *     comment regardless of which key did it.
 *   - Steps whose effect is transient UI we cannot read (toggling Edit mode with
 *     E, opening the label editor with Shift+I, moving the marker over empty
 *     canvas) are taught as REHEARSAL: we confirm the keystroke, not a fake
 *     editor change. Better an honest "you pressed the right key" than a probe
 *     that guesses.
 *
 * The terse `instruction` is tuned for spoken delivery (audio-first). The
 * detailed verbosity tier reuses the canonical `sr` string from
 * SHORTCUT_HELP_ROWS via `helpRow` (a deliberate index, chosen to avoid the
 * duplicate signatures) so reference wording never drifts from the real plugin.
 *
 * SEARCH / RANDOM ACCESS:
 *   Every move carries a `keywords` array — concept synonyms in the learner's
 *   own words (seeded from the BVI co-design vocabulary: "stack labels", "cursor
 *   location", "3d navigation", "where am I"). This is what powers the trainer's
 *   "jump to what you want to learn" search: a learner who does not know that
 *   nesting-in is F can type "nest" and reach it. Both nesting moves share the
 *   "nest" keyword on purpose, so one query surfaces F (in) AND Q (out). See
 *   `searchShortcuts()` below. The synonyms are content, not code — extend them
 *   freely as we learn how people actually ask.
 */

import { SHORTCUT_HELP_ROWS } from '../../../constants.js';

/**
 * Pull the canonical screen-reader description for the detailed verbosity tier.
 * @param {number} index - Deliberate index into SHORTCUT_HELP_ROWS.
 * @returns {string}
 */
export function canonicalDetail(index) {
  const row = SHORTCUT_HELP_ROWS[index];
  return row ? row.sr : '';
}

/**
 * A detection signature describes the keydown we listen for.
 *   code  - KeyboardEvent.code (layout-robust, unaffected by Shift)
 *   shift - Shift must be held
 *   mod   - Ctrl (Win/Linux) OR Cmd (Mac) must be held
 *   alt   - Alt/Option must be held
 *   key   - exact KeyboardEvent.key (used for non-letter keys like Escape)
 * Unspecified modifiers must be ABSENT for a match (strict matching).
 */

export const KEYBOARD_TRACKS = [
  // ===========================================================================
  // TRACK 1 — NAVIGATION: read and explore without changing the program.
  // ===========================================================================
  {
    id: 'track-navigation',
    title: 'Navigation',
    description:
      'Read and explore your program without changing it. First move the marker ' +
      'around the canvas, then move the cursor between blocks, step in and out of ' +
      'nested blocks, open the toolbox, ask where you are, run the program, and ' +
      'hear its output. The trainer drops you into a small practice program so ' +
      'every key has something real to act on.',
    requiresSandbox: true,
    shortcuts: [
      {
        id: 'move-workspace-marker',
        label: 'Move the workspace marker',
        keywords: ['marker', 'move marker', 'glide', 'point', 'aim', 'empty space',
          'blank canvas', 'where to build', 'position', 'spot', 'cursor on canvas'],
        keyHint: 'Shift plus W, A, S, D',
        instruction:
          'Hold Shift and press W, A, S, or D to glide the workspace marker around ' +
          'the canvas — up, left, down, right — even over empty space where there ' +
          'are no blocks. It is how you point at a spot before you build there. We ' +
          'will try all four directions in turn, and each one is called out as you ' +
          'go.',
        // Rehearsed as a four-direction drill so each key gets its own spoken
        // confirmation (up / left / down / right). It stays rehearsal rather than
        // live because the same Shift keys move a SELECTED BLOCK when the cursor
        // is on one — the marker only glides over empty canvas — so there is no
        // single live state we can honestly verify here. The Editing track teaches
        // the block-moving meaning of Shift+W and Shift+S.
        sequence: [
          {
            detect: { code: 'KeyW', shift: true },
            prompt: 'Hold Shift and press W to move the marker up.',
            done: 'Marker up.'
          },
          {
            detect: { code: 'KeyA', shift: true },
            prompt: 'Now hold Shift and press A to move the marker left.',
            done: 'Marker left.'
          },
          {
            detect: { code: 'KeyS', shift: true },
            prompt: 'Now hold Shift and press S to move the marker down.',
            done: 'Marker down.'
          },
          {
            detect: { code: 'KeyD', shift: true },
            prompt: 'Now hold Shift and press D to move the marker right.',
            done: 'Marker right.'
          }
        ],
        helpRow: 22,
        mode: 'navigation',
        success:
          'Marker right. That is the workspace marker — Shift with W, A, S, or D ' +
          'glides it up, left, down, and right around the canvas. With a block ' +
          'selected, the same Shift keys move the block instead; you will meet that ' +
          'in the Editing track.'
      },
      {
        id: 'move-up',
        label: 'Move to the previous block',
        keywords: ['previous', 'up', 'before', 'back', 'prior', 'preceding',
          'move up', 'go up', 'navigate up', 'earlier block'],
        keyHint: 'W',
        instruction:
          'Press W to move the cursor up to the previous block. Your cursor is on ' +
          'the second print inside the loop — press W to step up to the first one.',
        detect: { code: 'KeyW' },
        helpRow: 0,
        mode: 'navigation',
        live: { focus: 'workspace', requiresKeyboardNav: true, start: 'secondChild', confirm: 'cursorMoved' },
        success: 'Moved up to the previous block.'
      },
      {
        id: 'move-out-parent',
        label: 'Move out to the parent',
        keywords: ['out', 'parent', 'container', 'outer', 'move out', 'level up',
          'exit', 'leave block', 'enclosing', 'go out'],
        keyHint: 'A',
        instruction:
          'Press A to move out to the block that contains the current one. Your ' +
          'cursor is on the number in the loop counter — press A to move out to the ' +
          'loop that holds it.',
        detect: { code: 'KeyA' },
        helpRow: 2,
        mode: 'navigation',
        live: { focus: 'workspace', requiresKeyboardNav: true, start: 'value', confirm: 'cursorMoved' },
        success: 'Moved out to the parent.'
      },
      {
        id: 'move-down',
        label: 'Move to the next block',
        keywords: ['next', 'down', 'after', 'forward', 'following', 'subsequent',
          'move down', 'go down', 'navigate down', 'later block'],
        keyHint: 'S',
        instruction:
          'Press S to move the cursor down to the next block. Your cursor is on ' +
          'the first print inside the loop — press S to step down to the second one.',
        detect: { code: 'KeyS' },
        helpRow: 1,
        mode: 'navigation',
        live: { focus: 'workspace', requiresKeyboardNav: true, start: 'firstChild', confirm: 'cursorMoved' },
        success: 'Moved down to the next block.'
      },
      {
        id: 'move-in-child',
        label: 'Move in to a child',
        keywords: ['in', 'child', 'inside', 'into', 'first inside', 'move in',
          'go in', 'enter', 'inner', 'down a level'],
        keyHint: 'D',
        instruction:
          'Press D to move in to the first block inside the current one. Your ' +
          'cursor is on the first print — press D to step in to the text it prints.',
        detect: { code: 'KeyD' },
        helpRow: 3,
        mode: 'navigation',
        live: { focus: 'workspace', requiresKeyboardNav: true, start: 'firstChild', confirm: 'cursorMoved' },
        success: 'Moved in to the child.'
      },
      {
        id: 'move-into-nested',
        label: 'Step into a nested block',
        keywords: ['nest', 'nesting', 'nesting in', 'nested', 'go inside', 'inside',
          'into', 'child', 'deeper', 'step in', 'drill in', 'inside loop', '3d navigation'],
        keyHint: 'F',
        instruction:
          'Press F to step into the first block nested inside a container. Your ' +
          'cursor is on the repeat loop — press F to drop inside it, onto the first ' +
          'print block.',
        detect: { code: 'KeyF' },
        helpRow: 4,
        mode: 'navigation',
        live: { focus: 'workspace', requiresKeyboardNav: true, start: 'container', confirm: 'cursorMoved' },
        success: 'Stepped into the nested block.'
      },
      {
        id: 'move-out-nested',
        label: 'Step back out to the parent',
        keywords: ['nest', 'nesting', 'nesting out', 'go out', 'back out', 'parent',
          'shallower', 'step out', 'climb out', 'exit nest', 'out of loop', '3d navigation'],
        keyHint: 'Q',
        instruction:
          'Press Q to step back out to the parent block or the outer layer. Your ' +
          'cursor is on the first print inside the loop — press Q to move back out ' +
          'to the loop that holds it.',
        detect: { code: 'KeyQ' },
        helpRow: 5,
        mode: 'navigation',
        live: { focus: 'workspace', requiresKeyboardNav: true, start: 'firstChild', confirm: 'cursorMoved' },
        success: 'Stepped out to the parent.'
      },
      {
        id: 'announce-cursor',
        label: 'Ask where the cursor is',
        keywords: ['where am i', 'where', 'cursor', 'cursor location', 'location',
          'position', 'lost', 'orient', 'current', 'read cursor', 'my place', 'locate'],
        keyHint: 'C',
        instruction:
          'Press C at any time to hear where your cursor is right now. It is your ' +
          '"where am I" key — use it whenever you lose your place. Your cursor is on ' +
          'the first print inside the loop; press C to hear it described.',
        detect: { code: 'KeyC' },
        helpRow: 9,
        mode: 'any',
        live: {
          focus: 'workspace',
          requiresKeyboardNav: true,
          start: 'firstChild',
          cue: 'Cursor location announced by the editor.'
        },
        success: 'The editor announced where your cursor is.'
      },
      {
        id: 'toolbox-open-close',
        label: 'Open and close the toolbox',
        keywords: ['toolbox', 'blocks menu', 'palette', 'open toolbox', 'add blocks',
          'categories', 'flyout', 'library', 'block list', 'menu of blocks'],
        keyHint: 'T, then Escape',
        instruction:
          'The toolbox is the menu of blocks you can add. Two keys work as a pair: ' +
          'T opens it, and Escape closes it again and returns you to the workspace. ' +
          'Press T, then press Escape.',
        sequence: [
          {
            detect: { code: 'KeyT' },
            prompt: 'Press T to open the toolbox.',
            done: 'Good. T opens the toolbox.',
            confirm: 'toolboxOpen',
            cue: 'Toolbox open.'
          },
          {
            detect: { key: 'Escape' },
            prompt: 'Now press Escape to close it and return to the workspace.',
            done: 'Good. Escape closes it.',
            confirm: 'toolboxClosed',
            cue: 'Toolbox closed — back on the workspace.'
          }
        ],
        helpRow: 7,
        mode: 'any',
        live: { focus: 'workspace', requiresKeyboardNav: true },
        success: 'That is the pair: T opens the toolbox, Escape closes it and brings you back to the workspace.'
      },
      {
        id: 'navigational-assistant',
        label: 'Open the navigational assistant',
        keywords: ['navigation assistant', 'assistant', 'help', 'where can i go',
          'options', 'available moves', 'directions', 'guide', 'what can i do', 'choices'],
        keyHint: 'Shift plus H',
        instruction:
          'Press Shift plus H to open the navigational assistant. It reads out ' +
          'where you are and where you can move from the block at your cursor, so ' +
          'it only makes sense with a block under the cursor. Your cursor is on the ' +
          'first print inside the loop; press Shift plus H.',
        detect: { code: 'KeyH', shift: true },
        helpRow: 29,
        mode: 'any',
        live: {
          focus: 'workspace',
          requiresKeyboardNav: true,
          needsBlocks: true,
          start: 'firstChild',
          cue: 'Navigational assistant opened — it describes where you can move from here.'
        },
        success: 'Navigational assistant opened.'
      },
      {
        id: 'run-program',
        label: 'Run your program',
        keywords: ['run', 'execute', 'play', 'start', 'go', 'run program',
          'run code', 'test it', 'launch'],
        keyHint: 'Shift plus R',
        instruction:
          'Press Shift plus R to run your program. There is a small program on the ' +
          'workspace now — a loop that prints a few lines — so the run has something ' +
          'to do.',
        detect: { code: 'KeyR', shift: true },
        helpRow: 30,
        mode: 'any',
        live: { focus: 'workspace', requiresKeyboardNav: true, needsBlocks: true, cue: 'Program run.' },
        success: 'Program run.'
      },
      {
        id: 'open-output',
        label: 'Open the output panel',
        keywords: ['output', 'result', 'what printed', 'console', 'read output',
          'hear output', 'results panel', 'what it said', 'see output'],
        keyHint: 'Shift plus O',
        instruction:
          'Press Shift plus O to open the output panel and hear what your program ' +
          'produced. Run the program first with Shift plus R so there is output to ' +
          'read.',
        detect: { code: 'KeyO', shift: true },
        helpRow: 31,
        mode: 'any',
        live: { focus: 'workspace', requiresKeyboardNav: true, needsBlocks: true, cue: 'Output panel opened.' },
        success: 'Output panel opened.'
      }
    ]
  },

  // ===========================================================================
  // TRACK 2 — EDITING: change the program. Live steps are confirmed by watching
  // the real workspace change; E and the label editor are rehearsed honestly.
  // ===========================================================================
  {
    id: 'track-editing',
    title: 'Editing',
    description:
      'Now change the program. First the master idea — switching between ' +
      'Navigation mode and Edit mode with E. Then move a block up or down, ' +
      'disconnect it, cut and paste it, delete it, label a whole stack, and add a ' +
      'comment. Each live step is confirmed by watching the real workspace change, ' +
      'so you know the edit actually happened.',
    requiresSandbox: true,
    shortcuts: [
      {
        id: 'toggle-edit-mode',
        label: 'Switch between Navigation and Edit mode',
        keywords: ['edit mode', 'mode', 'switch mode', 'toggle mode', 'change mode',
          'navigation mode', 'edit', 'enter edit', 'mode switch', 'read or edit'],
        keyHint: 'E',
        instruction:
          'There are two modes. In Navigation mode you read and move the cursor. In ' +
          'Edit mode you connect and disconnect blocks. Press E to switch between ' +
          'them, and Escape to leave Edit mode. Knowing which mode you are in is the ' +
          'key to everything else here. Press E now to toggle the mode.',
        detect: { code: 'KeyE' },
        helpRow: 6,
        mode: 'any',
        success:
          'Edit mode toggled. Press E again or Escape to return to Navigation mode. ' +
          'When an editing key seems to do nothing, check your mode first.'
      },
      {
        id: 'move-block-up',
        label: 'Move a block up',
        keywords: ['move block up', 'reorder', 'rearrange', 'lift', 'swap up',
          'block up', 'shift up', 'reorder up', 'promote', 'move statement up'],
        keyHint: 'Shift plus W',
        instruction:
          'With the cursor on a block, hold Shift and press W to move that whole ' +
          'block up in its stack. This is the same Shift+W that moved the marker ' +
          'over empty space — but with a block selected it moves the block. Your ' +
          'cursor is on the second print; press Shift plus W to lift it above the ' +
          'first.',
        detect: { code: 'KeyW', shift: true },
        helpRow: 14,
        mode: 'navigation',
        live: { focus: 'workspace', requiresKeyboardNav: true, needsBlocks: true, start: 'secondChild', confirm: 'workspaceChanged' },
        success: 'Block moved up — the two prints swapped order.'
      },
      {
        id: 'move-block-down',
        label: 'Move a block down',
        keywords: ['move block down', 'reorder', 'rearrange', 'drop', 'swap down',
          'block down', 'shift down', 'reorder down', 'demote', 'move statement down'],
        keyHint: 'Shift plus S',
        instruction:
          'Hold Shift and press S to move the block at your cursor down in its ' +
          'stack. Your cursor is on the first print; press Shift plus S to drop it ' +
          'below the second.',
        detect: { code: 'KeyS', shift: true },
        helpRow: 15,
        mode: 'navigation',
        live: { focus: 'workspace', requiresKeyboardNav: true, needsBlocks: true, start: 'firstChild', confirm: 'workspaceChanged' },
        success: 'Block moved down — the two prints swapped order.'
      },
      {
        id: 'disconnect-block',
        label: 'Disconnect a block',
        keywords: ['disconnect', 'detach', 'unplug', 'separate', 'pull apart',
          'loose', 'unhook', 'break apart', 'split', 'take off'],
        keyHint: 'Shift plus X',
        instruction:
          'In Edit mode, press Shift plus X to disconnect the block at your cursor ' +
          'from the one above it, leaving it loose on the canvas. If nothing ' +
          'happens, press E first to enter Edit mode. Your cursor is on the second ' +
          'print; press Shift plus X to detach it.',
        detect: { code: 'KeyX', shift: true },
        helpRow: 13,
        mode: 'edit',
        live: { focus: 'workspace', requiresKeyboardNav: true, needsBlocks: true, start: 'secondChild', confirm: 'workspaceChanged' },
        success: 'Block disconnected — it is now loose on the workspace.'
      },
      {
        id: 'cut-paste-block',
        label: 'Cut a block and paste it back',
        keywords: ['cut', 'paste', 'cut paste', 'clipboard', 'relocate', 'move block',
          'cut and paste', 'copy move', 'lift and drop'],
        keyHint: 'Control or Command plus X, then plus V',
        instruction:
          'Cut and paste move a block from one place to another. Hold Control or ' +
          'Command and press X to cut the block at your cursor, then hold Control or ' +
          'Command and press V to paste it back in. Your cursor is on the second ' +
          'print — cut it, then paste it.',
        sequence: [
          {
            detect: { code: 'KeyX', mod: true },
            prompt: 'Hold Control or Command and press X to cut the block.',
            done: 'Cut. The block is on the clipboard.',
            confirm: 'workspaceChanged',
            cue: 'Block cut — it left the workspace.',
            start: 'secondChild'
          },
          {
            detect: { code: 'KeyV', mod: true },
            prompt: 'Now hold Control or Command and press V to paste it back.',
            done: 'Pasted.',
            confirm: 'workspaceChanged',
            cue: 'Block pasted back onto the workspace.'
          }
        ],
        helpRow: 16,
        mode: 'any',
        live: { focus: 'workspace', requiresKeyboardNav: true, needsBlocks: true },
        success: 'That is cut and paste: Control or Command plus X to lift a block, plus V to drop it back in.'
      },
      {
        id: 'delete-block',
        label: 'Delete a block',
        keywords: ['delete', 'remove', 'erase', 'trash', 'get rid', 'clear',
          'destroy', 'take away', 'discard', 'bin'],
        keyHint: 'Delete',
        instruction:
          'Press the Delete key to remove the block at your cursor for good. Your ' +
          'cursor is on the second print; press Delete to remove it.',
        detect: { key: 'Delete' },
        helpRow: 18,
        mode: 'any',
        live: { focus: 'workspace', requiresKeyboardNav: true, needsBlocks: true, start: 'secondChild', confirm: 'workspaceChanged' },
        success: 'Block deleted — it is gone from the workspace.'
      },
      {
        id: 'label-stack',
        label: 'Label a whole stack',
        keywords: ['label', 'stack labels', 'name', 'name stack', 'label stack',
          'title', 'tag', 'mark', 'stack name', 'jump label', 'bookmark'],
        keyHint: 'Q until the stack is selected, then Shift plus I',
        instruction:
          'You can name a whole stack so you can jump to it later. First select the ' +
          'whole stack: press Q again and again to climb out until the entire stack ' +
          'is highlighted with a red border. Then press Shift plus I to open the ' +
          'label editor and type a name. Practise the keys now: press Q, then press ' +
          'Shift plus I.',
        sequence: [
          {
            detect: { code: 'KeyQ' },
            prompt: 'Press Q to climb out toward the whole stack. In practice, repeat Q until the red border wraps the entire stack.',
            done: 'Good. Keep pressing Q in the real editor until the whole stack is selected.'
          },
          {
            detect: { code: 'KeyI', shift: true },
            prompt: 'Now press Shift plus I to open the label editor.',
            done: 'Good. Shift plus I opens the label editor for the selected stack.'
          }
        ],
        helpRow: 28,
        mode: 'any',
        success: 'That is the move: Q out to the whole stack, then Shift plus I to name it.'
      },
      {
        id: 'comment-block',
        label: 'Add or hide a comment',
        keywords: ['comment', 'note', 'annotate', 'add comment', 'hide comment',
          'remark', 'memo', 'description', 'explain block'],
        keyHint: 'Control or Command plus Slash',
        instruction:
          'Hold Control or Command and press the slash key to add a comment to the ' +
          'block at your cursor, or hide it again. Your cursor is on the first ' +
          'print; press Control or Command plus slash to toggle a comment on it.',
        detect: { code: 'Slash', mod: true },
        helpRow: 19,
        mode: 'any',
        live: { focus: 'workspace', requiresKeyboardNav: true, needsBlocks: true, start: 'firstChild', confirm: 'workspaceChanged' },
        success: 'Comment toggled on the block.'
      }
    ]
  }
];

/**
 * Flattened list of every shortcut with its track id attached. Convenient for
 * progress tracking and lookups.
 * @returns {Array<object>}
 */
export function getAllShortcuts() {
  return KEYBOARD_TRACKS.flatMap((track) =>
    track.shortcuts.map((s) => ({ ...s, trackId: track.id }))
  );
}

/**
 * Search the moves by concept, name, or key.
 *
 * This is the engine behind the trainer's "jump to what you want to learn" front
 * door. A BVI learner who does not know that nesting-in is F can type "nest" and
 * get BOTH F (in) and Q (out) — because both moves carry "nest" in `keywords`.
 *
 * Matching, deliberately forgiving (a learner should not have to guess our exact
 * wording — DTorial: "Finding is universal") but not sloppy:
 *   - Each move is reduced to a WORD SET (every word in its label, key hint, and
 *     keyword synonyms) plus its KEY TOKENS (the letters/named keys in the hint,
 *     e.g. "Shift plus W, A, S, D" gives w, a, s, d).
 *   - A query of 1-2 characters must match a whole word OR a key token. That is
 *     what makes "F" mean the move bound to F and "W" the three W moves, instead
 *     of substring-matching the "f" inside "forward" or "flyout".
 *   - A query of 3+ characters matches on WORD PREFIX, so "nes" finds "nesting"
 *     but "cut" no longer hides inside "exe-cut-e".
 *   - Multi-word AND: every whitespace token must match, so "move down" narrows.
 *   - One query reaches a move by concept ("delete"), by name ("step into"), or
 *     by key ("f") — all three live in the same word set.
 *
 * Ranking puts the most literal hit first: exact key, then exact keyword/label,
 * then prefix hits, then the rest. Ties keep track order (Navigation before
 * Editing), matching the linear curriculum.
 *
 * @param {string} query - Raw text typed by the learner.
 * @returns {Array<object>} Matching shortcuts (with trackId), best first.
 */
export function searchShortcuts(query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];
  const tokens = q.split(/\s+/).filter(Boolean);
  const splitWords = (s) => s.split(/[^a-z0-9]+/).filter(Boolean);

  return getAllShortcuts()
    .map((sc, order) => {
      const label = (sc.label || '').toLowerCase();
      const keyHint = (sc.keyHint || '').toLowerCase();
      const keywords = (sc.keywords || []).map((k) => k.toLowerCase());
      const words = splitWords([label, ...keywords, keyHint].join(' '));
      const wordSet = new Set(words);
      const keyTokens = splitWords(keyHint); // includes modifier words; harmless

      // Short queries (a key letter, "in", "up") must hit a whole word or a key
      // token, so "F" means the F move, not the "f" inside "forward"/"flyout".
      // Longer queries match on word prefix (autocomplete), so "cut" no longer
      // hides inside "exe-cut-e".
      const matchTok = (t) =>
        t.length <= 2
          ? wordSet.has(t) || keyTokens.includes(t)
          : words.some((w) => w.startsWith(t)) || keyTokens.includes(t);

      if (!tokens.every(matchTok)) return null;

      let score = 0;
      if (keyTokens.includes(q)) score += 100; // typed the key, e.g. "f"
      if (keywords.includes(q)) score += 60; // typed a synonym exactly, e.g. "nest"
      if (label === q) score += 60;
      if (label.startsWith(q)) score += 30;
      if (keywords.some((k) => k.startsWith(q))) score += 20;
      score += tokens.reduce((s, t) => s + (matchTok(t) ? 1 : 0), 0);

      return { sc, score, order };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map((r) => r.sc);
}

/**
 * Match a KeyboardEvent against a detection signature. Strict: any modifier not
 * named in the signature must be absent, so "S" never matches "Shift+S".
 * @param {KeyboardEvent} event
 * @param {object} detect - Detection signature.
 * @returns {boolean}
 */
export function matchesShortcut(event, detect) {
  if (detect.code && event.code !== detect.code) return false;
  if (detect.key && event.key !== detect.key) return false;

  const wantShift = !!detect.shift;
  const wantAlt = !!detect.alt;

  if (event.shiftKey !== wantShift) return false;
  if (event.altKey !== wantAlt) return false;

  // `ctrl` pins to the Control key specifically — some plugin shortcuts (e.g. the
  // keyboard-nav toggle) bind Ctrl only, even on Mac, so Cmd must NOT match.
  // `mod` is the looser "Ctrl OR Cmd" used by shortcuts that register both.
  if (detect.ctrl) {
    if (!event.ctrlKey || event.metaKey) return false;
  } else {
    const wantMod = !!detect.mod;
    const hasMod = event.ctrlKey || event.metaKey;
    if (hasMod !== wantMod) return false;
  }

  return true;
}
