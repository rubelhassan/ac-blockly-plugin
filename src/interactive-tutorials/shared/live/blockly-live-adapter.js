/**
 * Blockly Live Adapter
 *
 * Bridges the Keyboard Trainer's "live coach" steps to the real Blockly
 * workspace so a practiced keypress drives the actual editor, and success is
 * confirmed from real state rather than trusted from the keystroke alone.
 *
 * The adapter shape is deliberately small and stable. The trainer only ever
 * calls `available`, `focusWorkspace()`, and `probe(name)`, so all Blockly
 * coupling lives here. When no workspace is present, `available` is false and
 * the trainer falls back to rehearsal mode.
 *
 * @param {() => object} [getWorkspace] - Optional resolver returning the live
 *   workspace. Falls back to window.workspace / Blockly.getMainWorkspace().
 */
import {
  NAVIGATION_PRACTICE_XML,
  NAVIGATION_PRACTICE_DESCRIPTION,
  PRACTICE_ANCHORS,
  BLOCK_FRIENDLY_NAMES
} from '../data/practice-programs.js';

export function createBlocklyLiveAdapter(getWorkspace) {
  // Snapshot of whatever the learner had on the workspace before we dropped in
  // the practice stack. Restored verbatim when they leave the sandbox so their
  // own work is never lost.
  let sandboxBackup = null;

  function blockly() {
    if (typeof window !== 'undefined' && window.Blockly) return window.Blockly;
    return null;
  }

  function workspace() {
    try {
      if (typeof getWorkspace === 'function') {
        const ws = getWorkspace();
        if (ws) return ws;
      }
      if (typeof window !== 'undefined') {
        if (window.workspace) return window.workspace;
        if (window.Blockly && window.Blockly.getMainWorkspace) {
          return window.Blockly.getMainWorkspace();
        }
      }
    } catch (e) {
      /* no-op: treated as "no workspace" */
    }
    return null;
  }

  function focusWorkspace() {
    const ws = workspace();
    if (!ws) return false;
    // Tell Blockly which workspace is active; its keyboard shortcuts are routed
    // to the focused workspace.
    if (ws.markFocused) {
      try { ws.markFocused(); } catch (e) { /* no-op */ }
    }
    // Also move DOM focus onto the workspace SVG so real key events land here.
    let el = null;
    if (ws.getParentSvg) el = ws.getParentSvg();
    if (!el && ws.getInjectionDiv) el = ws.getInjectionDiv();
    if (el && el.focus) {
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
      try { el.focus(); } catch (e) { /* no-op */ }
      return true;
    }
    return false;
  }

  function isKeyboardNavOn() {
    const ws = workspace();
    return !!(ws && ws.keyboardAccessibilityMode);
  }

  function isToolboxOpen() {
    const ws = workspace();
    if (!ws || !ws.getToolbox) return false;
    const tb = ws.getToolbox();
    if (!tb || !tb.getFlyout) return false;
    const fly = tb.getFlyout();
    return !!(fly && fly.isVisible && fly.isVisible());
  }

  // ---- practice sandbox ----------------------------------------------------
  //
  // Movement / "where can I go" shortcuts are meaningless on an empty canvas.
  // loadSandbox swaps in a tiny purpose-built stack (see practice-programs.js)
  // after stashing the learner's own blocks; restoreSandbox puts theirs back.

  function isSandboxLoaded() {
    return sandboxBackup !== null;
  }

  function loadSandbox() {
    const ws = workspace();
    const B = blockly();
    if (!ws || !B) return false;
    if (sandboxBackup !== null) return true; // already in the sandbox
    try {
      // Stash current blocks so we can restore them on the way out.
      sandboxBackup = B.serialization.workspaces.save(ws);
      ws.clear();
      const dom = B.utils.xml.textToDom(NAVIGATION_PRACTICE_XML);
      B.Xml.domToWorkspace(dom, ws);
      return true;
    } catch (e) {
      sandboxBackup = null;
      return false;
    }
  }

  function restoreSandbox() {
    const ws = workspace();
    const B = blockly();
    if (!ws || !B || sandboxBackup === null) return false;
    try {
      ws.clear();
      B.serialization.workspaces.load(sandboxBackup, ws);
    } catch (e) {
      /* no-op: best-effort restore */
    }
    sandboxBackup = null;
    return true;
  }

  // Re-lay the pristine practice stack WITHOUT touching the stashed backup.
  // Editing drills mutate the stack (move/cut/delete a block), which would leave
  // the next drill's start anchor pointing at a block that no longer exists. The
  // trainer calls this at the start of each live drill so every drill begins
  // from the same known shape. The learner's own blocks stay safely stashed.
  function resetSandbox() {
    const ws = workspace();
    const B = blockly();
    if (!ws || !B || sandboxBackup === null) return false;
    try {
      ws.clear();
      const dom = B.utils.xml.textToDom(NAVIGATION_PRACTICE_XML);
      B.Xml.domToWorkspace(dom, ws);
      return true;
    } catch (e) {
      return false;
    }
  }

  // A spoken summary of what is on the workspace right now, for BVI learners
  // who cannot see the canvas. When sitting in the curated practice stack we
  // return its hand-written walk-through (which names each block and what it
  // says); otherwise we count the learner's own blocks and stacks.
  function describeWorkspace() {
    const ws = workspace();
    if (!ws || !ws.getAllBlocks) return '';
    const count = ws.getAllBlocks(false).length;
    if (sandboxBackup !== null) {
      return `${NAVIGATION_PRACTICE_DESCRIPTION} That is ${count} blocks in all.`;
    }
    if (count === 0) return 'The workspace is empty — there are no blocks yet.';
    const stacks = ws.getTopBlocks ? ws.getTopBlocks(false).length : 1;
    return (
      `The workspace has ${count} block${count === 1 ? '' : 's'} ` +
      `in ${stacks} stack${stacks === 1 ? '' : 's'}.`
    );
  }

  // A cheap fingerprint of the WHOLE workspace: the serialized program as a
  // string. It changes whenever blocks are moved, disconnected, cut, pasted,
  // deleted, commented, or their fields edited — so the trainer can confirm an
  // edit really happened by comparing this before and after a keypress, without
  // a bespoke probe per operation. The practice stack is tiny (a handful of
  // blocks), so stringifying it on each poll is negligible.
  function workspaceSignature() {
    const ws = workspace();
    const B = blockly();
    if (!ws || !B) return null;
    try {
      return JSON.stringify(B.serialization.workspaces.save(ws));
    } catch (e) {
      return null;
    }
  }

  // ---- cursor inspection ---------------------------------------------------

  function cursor() {
    const ws = workspace();
    return ws && ws.getCursor ? ws.getCursor() : null;
  }

  // A stable string id of the current cursor location. Changes whenever the
  // cursor moves to a different node, so the trainer can confirm a real move
  // happened in response to a practiced key. Returns null when there is no
  // cursor (keyboard nav off) or no current node.
  function cursorSignature() {
    const cur = cursor();
    const node = cur && cur.getCurNode ? cur.getCurNode() : null;
    if (!node) return null;
    const type = node.getType ? node.getType() : '?';
    const blk = node.getSourceBlock ? node.getSourceBlock() : null;
    let extra = '';
    if (type === 'field' && node.getLocation) {
      const loc = node.getLocation();
      if (loc && loc.name) extra = loc.name;
    }
    return [type, blk ? blk.id : '-', extra].join('|');
  }

  // Park the cursor on a named anchor block (see PRACTICE_ANCHORS) so the next
  // drill starts somewhere the taught move is valid. Needs keyboard nav on (the
  // cursor only exists then).
  function placeCursor(anchor) {
    const ws = workspace();
    const B = blockly();
    const cur = cursor();
    if (!ws || !B || !cur || !B.ASTNode) return false;
    const id = PRACTICE_ANCHORS[anchor] || anchor;
    const block = ws.getBlockById ? ws.getBlockById(id) : null;
    if (!block) return false;
    try {
      cur.setCurNode(B.ASTNode.createBlockNode(block));
      return true;
    } catch (e) {
      return false;
    }
  }

  // Park the cursor on the first top-level block of whatever is on the canvas
  // right now (the learner's real program, not the sandbox). Used when the
  // trainer opens, so a BVI learner starts oriented on a known block. Needs
  // keyboard nav on (the cursor only exists then); returns false otherwise, and
  // the caller treats that as "could not place yet".
  function placeCursorFirst() {
    const ws = workspace();
    const B = blockly();
    const cur = cursor();
    if (!ws || !B || !cur || !B.ASTNode || !ws.getTopBlocks) return false;
    const top = ws.getTopBlocks(true)[0];
    if (!top) return false;
    try {
      cur.setCurNode(B.ASTNode.createBlockNode(top));
      return true;
    } catch (e) {
      return false;
    }
  }

  // A short spoken description of where the cursor is now, for landing cues.
  function cursorDescription() {
    const cur = cursor();
    const node = cur && cur.getCurNode ? cur.getCurNode() : null;
    const blk = node && node.getSourceBlock ? node.getSourceBlock() : null;
    if (!blk) return 'the workspace';
    return BLOCK_FRIENDLY_NAMES[blk.type] || 'a block';
  }

  const probes = {
    keyboardNavOn: isKeyboardNavOn,
    keyboardNavOff: () => !isKeyboardNavOn(),
    toolboxOpen: isToolboxOpen,
    toolboxClosed: () => !isToolboxOpen()
  };

  return {
    get available() {
      return !!workspace();
    },
    focusWorkspace,
    isKeyboardNavOn,
    isToolboxOpen,
    probe(name) {
      const fn = probes[name];
      return fn ? fn() : false;
    },
    // Practice sandbox + cursor inspection.
    loadSandbox,
    restoreSandbox,
    resetSandbox,
    isSandboxLoaded,
    describeWorkspace,
    cursorSignature,
    workspaceSignature,
    placeCursor,
    placeCursorFirst,
    cursorDescription
  };
}
