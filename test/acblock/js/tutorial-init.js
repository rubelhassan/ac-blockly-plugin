/**
 * Editor-first boot.
 *
 * The real Blockly workspace is the first thing on the page, so BVI users who
 * already know the editor land on it without tabbing past chrome. Modes,
 * Keyboard tutorial, and settings live in the consolidated app menu
 * (see app-menu.js), not on the page.
 *
 * Boot runs on DOMContentLoaded rather than inline. This classic script executes
 * during parse, BEFORE the deferred keyboard-trainer-init.js module attaches its
 * `acblock:workspace-ready` listener. DOMContentLoaded fires after deferred
 * modules run, so initWorkspace() — which dispatches that event — happens only
 * once the listener is in place, and the startup announcement is never missed.
 */

let workspaceStarted = false;

function startWorkspaceOnce() {
  if (workspaceStarted) return;
  if (typeof initWorkspace !== 'function') {
    console.error('initWorkspace is not available; workspace cannot start.');
    return;
  }
  workspaceStarted = true;
  initWorkspace();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startWorkspaceOnce);
} else {
  startWorkspaceOnce();
}
