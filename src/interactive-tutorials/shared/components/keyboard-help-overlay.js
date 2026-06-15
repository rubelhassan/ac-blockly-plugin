/**
 * Keyboard help overlay component
 * Shows available keyboard shortcuts
 * Opened with '?' key, closed with Escape
 */

import { trapFocus, popFocus, pushFocus } from '../utilities/focus-manager.js';
import { announce } from '../utilities/announce.js';

export class KeyboardHelpOverlay {
  constructor(shortcuts = []) {
    this.shortcuts = shortcuts;
    this.overlay = null;
    this.removeTrap = null;
    this.isOpen = false;
  }

  /**
   * Create the overlay DOM structure
   * @returns {HTMLElement}
   */
  createOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'keyboard-help-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'keyboard-help-title');
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: var(--z-modal, 500);
      padding: var(--spacing-lg, 24px);
    `;

    const dialog = document.createElement('div');
    dialog.className = 'keyboard-help-dialog';
    dialog.style.cssText = `
      background: var(--color-surface-elevated, #fff);
      color: var(--color-text-primary, #212529);
      border-radius: var(--radius-lg, 12px);
      max-width: 800px;
      max-height: 90vh;
      overflow-y: auto;
      padding: var(--spacing-xl, 32px);
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    `;

    const header = document.createElement('header');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--spacing-lg, 24px);
    `;

    const title = document.createElement('h2');
    title.id = 'keyboard-help-title';
    title.textContent = 'Keyboard Shortcuts';
    title.style.cssText = `
      margin: 0;
      font-size: var(--font-size-2xl, 1.5rem);
      font-weight: 600;
    `;

    const closeButton = document.createElement('button');
    closeButton.className = 'keyboard-help-close';
    closeButton.textContent = '×';
    closeButton.setAttribute('aria-label', 'Close keyboard help');
    closeButton.style.cssText = `
      background: none;
      border: none;
      font-size: 2rem;
      line-height: 1;
      cursor: pointer;
      padding: var(--spacing-sm, 8px);
      color: var(--color-text-secondary, #6c757d);
      border-radius: var(--radius-sm, 4px);
    `;
    closeButton.addEventListener('click', () => this.close());

    header.appendChild(title);
    header.appendChild(closeButton);

    const table = this.createShortcutsTable();
    
    const footer = document.createElement('footer');
    footer.style.cssText = `
      margin-top: var(--spacing-lg, 24px);
      padding-top: var(--spacing-md, 16px);
      border-top: 1px solid var(--color-border, #dee2e6);
      text-align: center;
      color: var(--color-text-secondary, #6c757d);
      font-size: var(--font-size-sm, 0.875rem);
    `;
    footer.textContent = 'Press Escape or click the × button to close';

    dialog.appendChild(header);
    dialog.appendChild(table);
    dialog.appendChild(footer);
    overlay.appendChild(dialog);

    // Handle clicks outside dialog
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.close();
      }
    });

    // Handle Escape key
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      }
    });

    return overlay;
  }

  /**
   * Create shortcuts table
   * @returns {HTMLElement}
   */
  createShortcutsTable() {
    const table = document.createElement('table');
    table.className = 'keyboard-shortcuts-table';
    table.style.cssText = `
      width: 100%;
      border-collapse: collapse;
    `;

    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th style="text-align: left; padding: var(--spacing-sm, 8px); border-bottom: 2px solid var(--color-border, #dee2e6);">Key</th>
        <th style="text-align: left; padding: var(--spacing-sm, 8px); border-bottom: 2px solid var(--color-border, #dee2e6);">Action</th>
      </tr>
    `;

    const tbody = document.createElement('tbody');
    this.shortcuts.forEach((shortcut, index) => {
      const tr = document.createElement('tr');
      tr.style.cssText = `
        ${index % 2 === 0 ? 'background: var(--color-surface, #f8f9fa);' : ''}
      `;

      const keysCell = document.createElement('td');
      keysCell.style.cssText = `
        padding: var(--spacing-sm, 8px);
        font-family: var(--font-family-mono, monospace);
        font-weight: 600;
        white-space: nowrap;
      `;

      const keys = Array.isArray(shortcut.keys) ? shortcut.keys : [shortcut.keys];
      keysCell.innerHTML = keys.map(key => {
        return `<kbd style="
          background: var(--color-surface-elevated, #fff);
          border: 1px solid var(--color-border, #dee2e6);
          border-radius: var(--radius-sm, 4px);
          padding: 2px 6px;
          margin-right: 4px;
          font-size: var(--font-size-sm, 0.875rem);
        ">${key}</kbd>`;
      }).join('');

      const descCell = document.createElement('td');
      descCell.style.cssText = `padding: var(--spacing-sm, 8px);`;
      descCell.textContent = shortcut.description;

      tr.appendChild(keysCell);
      tr.appendChild(descCell);
      tbody.appendChild(tr);
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    return table;
  }

  /**
   * Open the overlay
   */
  open() {
    if (this.isOpen) return;

    this.overlay = this.createOverlay();
    document.body.appendChild(this.overlay);

    // Trap focus within dialog
    pushFocus(this.overlay);
    this.removeTrap = trapFocus(this.overlay);

    this.isOpen = true;
    announce('Keyboard shortcuts dialog opened. Press Escape to close.');
  }

  /**
   * Close the overlay
   */
  close() {
    if (!this.isOpen || !this.overlay) return;

    // Remove focus trap
    if (this.removeTrap) {
      this.removeTrap();
      this.removeTrap = null;
    }

    // Restore focus
    popFocus();

    // Remove from DOM
    if (this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }

    this.overlay = null;
    this.isOpen = false;
    announce('Keyboard shortcuts dialog closed.');
  }

  /**
   * Toggle overlay open/closed
   */
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Update shortcuts list
   * @param {Array} shortcuts - New shortcuts array
   */
  setShortcuts(shortcuts) {
    this.shortcuts = shortcuts;
    if (this.isOpen) {
      // Re-render if currently open
      this.close();
      this.open();
    }
  }

  /**
   * Clean up
   */
  dispose() {
    this.close();
    this.shortcuts = [];
  }
}
