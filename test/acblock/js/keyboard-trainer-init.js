/**
 * Wires the navbar "Keyboard Trainer" button to the KeyboardTrainer component.
 *
 * Loaded as a native ES module (type="module"). The trainer and its whole
 * dependency tree use explicit .js import paths. The Blockly coupling needed
 * for live-coach steps is isolated in the live adapter, which reads the demo's
 * injected workspace (window.workspace / Blockly.getMainWorkspace).
 */

import { KeyboardTrainer } from '../../../src/interactive-tutorials/shared/components/keyboard-trainer.js';
import { createBlocklyLiveAdapter } from '../../../src/interactive-tutorials/shared/live/blockly-live-adapter.js';
import { announce } from '../../../src/interactive-tutorials/shared/utilities/announce.js';

const trainer = new KeyboardTrainer({
  live: createBlocklyLiveAdapter(() => window.workspace)
});

const launchBtn = document.getElementById('openKeyboardTrainer');
if (launchBtn) {
  launchBtn.addEventListener('click', () => trainer.toggle());
}

// Press "?" anywhere on the page (outside text fields) to open the trainer,
// so users don't have to Tab across the page to the launch button.
trainer.enableLaunchHotkey();

// When the workspace is ready, speak the one-time startup instruction. The
// instruction is the "Tab twice, then Ctrl+Shift+K" enabling ritual: those are a
// startup ritual, not editor shortcuts, so they are announced when they become
// actionable rather than rehearsed inside the trainer. Fires once.
let startupAnnounced = false;
function announceStartup() {
  if (startupAnnounced) return;
  startupAnnounced = true;
  // Delay, then announce ASSERTIVELY. On load the screen reader is busy reading
  // the page, so a polite message here is dropped — which is exactly what we saw
  // in VoiceOver. Waiting ~1.2s lets that initial page chatter settle, and the
  // assertive region then cuts through instead of queueing behind it.
  setTimeout(() => {
    announce(
      'Workspace ready. Press the Tab key twice to move focus onto the workspace, ' +
      'then hold Control and Shift and press K to turn on keyboard navigation. ' +
      'Use Control even on a Mac, not Command. For a guided walkthrough of the ' +
      'shortcuts, press the question mark key to open the keyboard trainer.',
      { assertive: true }
    );
  }, 1200);
}

document.addEventListener('acblock:workspace-ready', announceStartup);

// Fallback: if the workspace was already injected before this module attached
// its listener (e.g. a future change reorders boot), announce immediately so the
// instruction is never silently dropped.
if (window.workspace) {
  announceStartup();
}

// Expose for debugging / future mode integration.
window.keyboardTrainer = trainer;
