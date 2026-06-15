/**
 * Consolidated app menu (hamburger) for the demo harness.
 *
 * Items: Modes (submenu: Beginner / Intermediate), Keyboard tutorial,
 * Screen settings, Sound settings.
 *
 * Keyboard model (per design decision): W/S move up/down within the current
 * level, D opens a submenu, A returns from a submenu to its parent. Enter/Space
 * activate, Escape closes. Tab is left working as a native fallback so a
 * screen-reader user who reflexively tabs is never trapped. On open and on
 * entering a submenu we SPEAK the available keys, because with a non-standard
 * (non-arrow) scheme the spoken instruction is the only cue an AT user gets.
 *
 * Each item is a real <button>, so assistive tech announces its label and role
 * correctly regardless of the custom key handling. Focus is roving (we call
 * .focus() on the active item) and the menu/submenu visibility is mirrored in
 * aria-expanded on the trigger and the Modes parent.
 */

import { announce } from '../../../src/interactive-tutorials/shared/utilities/announce.js';

const trigger = document.getElementById('appMenuTrigger');
const panel = document.getElementById('appMenuPanel');

let isOpen = false;
let activeSubmenu = null; // the open submenu element, or null

const topItems = () =>
  [...panel.querySelectorAll(':scope > .menu-row > .menu-item')];
const submenuItems = (sub) => [...sub.querySelectorAll('.menu-item')];
const currentList = () => (activeSubmenu ? submenuItems(activeSubmenu) : topItems());

function focusItem(el) {
  if (el) el.focus();
}

function openMenu() {
  if (isOpen) return;
  isOpen = true;
  panel.hidden = false;
  trigger.setAttribute('aria-expanded', 'true');
  focusItem(topItems()[0]);
  announce(
    'Menu opened. Press S to move down, W to move up, D to open a submenu, ' +
    'A to go back, Enter to select, Escape to close.'
  );
  document.addEventListener('keydown', onKeydown, true);
  document.addEventListener('click', onDocClick, true);
}

function closeMenu(restoreFocus = true) {
  if (!isOpen) return;
  closeSubmenu(false);
  isOpen = false;
  panel.hidden = true;
  trigger.setAttribute('aria-expanded', 'false');
  document.removeEventListener('keydown', onKeydown, true);
  document.removeEventListener('click', onDocClick, true);
  if (restoreFocus) trigger.focus();
}

function openSubmenu(parentBtn, subEl) {
  if (!subEl) return;
  activeSubmenu = subEl;
  subEl.hidden = false;
  parentBtn.setAttribute('aria-expanded', 'true');
  const label = parentBtn.querySelector('.menu-item__label').textContent;
  announce(`${label} submenu open. W and S to choose, Enter to select, A to go back.`);
  focusItem(submenuItems(subEl)[0]);
}

function closeSubmenu(focusParent = true) {
  if (!activeSubmenu) return;
  const parentBtn = panel.querySelector(`[aria-controls="${activeSubmenu.id}"]`);
  activeSubmenu.hidden = true;
  if (parentBtn) parentBtn.setAttribute('aria-expanded', 'false');
  activeSubmenu = null;
  if (focusParent && parentBtn) focusItem(parentBtn);
}

function move(delta) {
  const list = currentList();
  if (!list.length) return;
  const idx = list.indexOf(document.activeElement);
  const next = idx < 0 ? 0 : (idx + delta + list.length) % list.length;
  focusItem(list[next]);
}

function selectMode(modeId) {
  const labels = { beginner: 'Beginner mode', intermediate: 'Intermediate mode' };
  announce(`${labels[modeId] || modeId} selected. This mode is coming soon.`);
}

function activate(el) {
  if (!el) return;
  if (el.dataset.submenu) {
    openSubmenu(el, document.getElementById(el.dataset.submenu));
    return;
  }
  if (el.dataset.mode) {
    selectMode(el.dataset.mode);
    closeMenu();
    return;
  }
  if (el.id === 'menuKeyboardTutorial') {
    closeMenu();
    if (window.keyboardTrainer && typeof window.keyboardTrainer.toggle === 'function') {
      window.keyboardTrainer.toggle();
    } else {
      announce('Keyboard tutorial is not ready yet.');
    }
    return;
  }
  if (el.dataset.setting) {
    const names = { screen: 'Screen settings', sound: 'Sound settings' };
    announce(`${names[el.dataset.setting] || 'These settings'} are coming soon.`);
  }
}

function onKeydown(e) {
  if (!isOpen) return;
  switch (e.key.toLowerCase()) {
    case 's':
      e.preventDefault();
      move(1);
      break;
    case 'w':
      e.preventDefault();
      move(-1);
      break;
    case 'd': {
      e.preventDefault();
      const el = document.activeElement;
      if (!activeSubmenu && el && el.dataset.submenu) {
        openSubmenu(el, document.getElementById(el.dataset.submenu));
      }
      break;
    }
    case 'a':
      e.preventDefault();
      if (activeSubmenu) closeSubmenu();
      break;
    case 'enter':
    case ' ':
      // preventDefault stops the browser's native button click so activate()
      // runs exactly once.
      e.preventDefault();
      activate(document.activeElement);
      break;
    case 'escape':
      e.preventDefault();
      closeMenu();
      break;
    default:
      break;
  }
}

function onDocClick(e) {
  if (!isOpen) return;
  if (!panel.contains(e.target) && !trigger.contains(e.target)) {
    closeMenu(false);
  }
}

// --- Wiring -----------------------------------------------------------------

if (trigger && panel) {
  trigger.addEventListener('click', () => {
    if (isOpen) closeMenu();
    else openMenu();
  });

  // Mouse parity: clicking an item activates it (submenu parents open/toggle).
  panel.querySelectorAll('.menu-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      if (item.dataset.submenu) {
        const sub = document.getElementById(item.dataset.submenu);
        if (activeSubmenu === sub) closeSubmenu();
        else {
          if (activeSubmenu) closeSubmenu(false);
          openSubmenu(item, sub);
        }
        return;
      }
      activate(item);
    });
  });

  // Hover parity for mouse users: open the Modes submenu on pointer enter.
  const modesParent = panel.querySelector('[data-submenu="modesSubmenu"]');
  const modesRow = modesParent ? modesParent.closest('.menu-row') : null;
  if (modesParent && modesRow) {
    modesRow.addEventListener('mouseenter', () => {
      if (!activeSubmenu) openSubmenu(modesParent, document.getElementById('modesSubmenu'));
    });
    modesRow.addEventListener('mouseleave', () => {
      if (activeSubmenu && document.activeElement &&
          !modesRow.contains(document.activeElement)) {
        closeSubmenu(false);
      }
    });
  }
}
