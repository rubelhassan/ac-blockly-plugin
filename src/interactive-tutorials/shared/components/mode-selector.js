/**
 * Mode Selector Dashboard
 * Shows three mode tiles: Beginner, Intermediate, Expert
 * Keyboard navigation with A/D (left/right) and Enter to select
 */

import { announce } from '../utilities/announce.js';
import { trapFocus, pushFocus, popFocus } from '../utilities/focus-manager.js';

export class ModeSelector {
  constructor(onModeSelected) {
    this.onModeSelected = onModeSelected;
    this.container = null;
    this.selectedIndex = 0;
    this.modes = [
      {
        id: 'beginner',
        title: 'Beginner Mode',
        description: 'Learn block programming step by step. Blocks and keyboard commands unlock progressively as you complete lessons.',
        features: ['Progressive unlocking', '8 guided lessons', 'Hints on request', 'Code preview in Lesson 8'],
        icon: '🎓'
      },
      {
        id: 'intermediate',
        title: 'Intermediate Mode',
        description: 'Full toolbox and keyboard available. Focus on programming concepts like nesting, loops, and debugging.',
        features: ['All blocks available', 'Concept-focused lessons', 'Programming tasks', 'No artificial limits'],
        icon: '🔧'
      },
      {
        id: 'expert',
        title: 'Expert Mode',
        description: 'Standard Blockly sandbox with full accessibility features. No tutorials, no scaffolding.',
        features: ['Full Blockly workspace', 'All keyboard shortcuts', 'No tutorials', 'Free experimentation'],
        icon: '🚀'
      }
    ];
    this.removeTrap = null;
  }

  /**
   * Create and show the mode selector
   */
  show() {
    this.container = this.createContainer();
    document.body.appendChild(this.container);

    // Trap focus and announce
    pushFocus(this.container);
    this.removeTrap = trapFocus(this.container);
    
    this.updateSelection();
    announce('Mode selector opened. Use A and D to navigate between modes, Enter to select.');

    // Focus first tile
    const firstTile = this.container.querySelector('.mode-tile');
    if (firstTile) {
      firstTile.focus();
    }
  }

  /**
   * Create the dashboard container
   */
  createContainer() {
    const container = document.createElement('div');
    container.className = 'mode-selector-overlay';
    container.setAttribute('role', 'dialog');
    container.setAttribute('aria-modal', 'true');
    container.setAttribute('aria-labelledby', 'mode-selector-title');
    container.style.cssText = `
      position: fixed;
      inset: 0;
      background: var(--color-background, #fff);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: var(--z-modal, 500);
      padding: var(--spacing-lg, 24px);
    `;

    const header = document.createElement('header');
    header.style.cssText = `
      text-align: center;
      margin-bottom: var(--spacing-xl, 32px);
    `;

    const title = document.createElement('h1');
    title.id = 'mode-selector-title';
    title.textContent = 'Choose Your Learning Mode';
    title.style.cssText = `
      font-size: var(--font-size-3xl, 2rem);
      margin: 0 0 var(--spacing-sm, 8px) 0;
      color: var(--color-text-primary, #212529);
    `;

    const subtitle = document.createElement('p');
    subtitle.textContent = 'Use A/D to navigate, Enter to select';
    subtitle.style.cssText = `
      font-size: var(--font-size-lg, 1.125rem);
      color: var(--color-text-secondary, #6c757d);
      margin: 0;
    `;

    header.appendChild(title);
    header.appendChild(subtitle);

    const tilesContainer = document.createElement('div');
    tilesContainer.className = 'mode-tiles-container';
    tilesContainer.setAttribute('role', 'group');
    tilesContainer.setAttribute('aria-label', 'Available modes');
    tilesContainer.style.cssText = `
      display: flex;
      gap: var(--spacing-lg, 24px);
      flex-wrap: wrap;
      justify-content: center;
      max-width: 1200px;
    `;

    this.modes.forEach((mode, index) => {
      const tile = this.createModeTile(mode, index);
      tilesContainer.appendChild(tile);
    });

    container.appendChild(header);
    container.appendChild(tilesContainer);

    // Keyboard handler
    container.addEventListener('keydown', (e) => this.handleKeyDown(e));

    return container;
  }

  /**
   * Create a mode tile
   */
  createModeTile(mode, index) {
    const tile = document.createElement('button');
    tile.className = 'mode-tile';
    tile.setAttribute('data-mode-id', mode.id);
    tile.setAttribute('data-index', index);
    tile.setAttribute('role', 'button');
    tile.setAttribute('aria-label', `${mode.title}. ${mode.description}`);
    tile.style.cssText = `
      background: var(--color-surface, #f8f9fa);
      border: 3px solid var(--color-border, #dee2e6);
      border-radius: var(--radius-lg, 12px);
      padding: var(--spacing-xl, 32px);
      width: 320px;
      cursor: pointer;
      transition: all var(--transition-base, 250ms);
      text-align: left;
    `;

    const iconDiv = document.createElement('div');
    iconDiv.className = 'mode-icon';
    iconDiv.textContent = mode.icon;
    iconDiv.style.cssText = `
      font-size: 3rem;
      margin-bottom: var(--spacing-md, 16px);
    `;

    const titleDiv = document.createElement('h2');
    titleDiv.textContent = mode.title;
    titleDiv.style.cssText = `
      margin: 0 0 var(--spacing-sm, 8px) 0;
      font-size: var(--font-size-xl, 1.25rem);
      color: var(--color-text-primary, #212529);
    `;

    const descDiv = document.createElement('p');
    descDiv.textContent = mode.description;
    descDiv.style.cssText = `
      margin: 0 0 var(--spacing-md, 16px) 0;
      color: var(--color-text-secondary, #6c757d);
      font-size: var(--font-size-base, 1rem);
      line-height: var(--line-height-relaxed, 1.75);
    `;

    const featuresList = document.createElement('ul');
    featuresList.style.cssText = `
      margin: 0;
      padding-left: var(--spacing-lg, 24px);
      color: var(--color-text-secondary, #6c757d);
      font-size: var(--font-size-sm, 0.875rem);
    `;

    mode.features.forEach(feature => {
      const li = document.createElement('li');
      li.textContent = feature;
      li.style.marginBottom = 'var(--spacing-xs, 4px)';
      featuresList.appendChild(li);
    });

    tile.appendChild(iconDiv);
    tile.appendChild(titleDiv);
    tile.appendChild(descDiv);
    tile.appendChild(featuresList);

    // Click handler
    tile.addEventListener('click', () => this.selectMode(index));

    return tile;
  }

  /**
   * Handle keyboard navigation
   */
  handleKeyDown(e) {
    const tiles = Array.from(this.container.querySelectorAll('.mode-tile'));

    switch(e.key.toLowerCase()) {
      case 'a':
      case 'arrowleft':
        e.preventDefault();
        this.selectedIndex = Math.max(0, this.selectedIndex - 1);
        this.updateSelection();
        tiles[this.selectedIndex]?.focus();
        break;

      case 'd':
      case 'arrowright':
        e.preventDefault();
        this.selectedIndex = Math.min(this.modes.length - 1, this.selectedIndex + 1);
        this.updateSelection();
        tiles[this.selectedIndex]?.focus();
        break;

      case 'enter':
      case ' ':
        e.preventDefault();
        this.selectMode(this.selectedIndex);
        break;

      case 'escape':
        e.preventDefault();
        announce('Mode selection cancelled.');
        break;
    }
  }

  /**
   * Update visual selection
   */
  updateSelection() {
    const tiles = this.container.querySelectorAll('.mode-tile');
    tiles.forEach((tile, index) => {
      if (index === this.selectedIndex) {
        tile.style.borderColor = 'var(--color-focus, #0066cc)';
        tile.style.backgroundColor = 'var(--color-focus-background, #e6f2ff)';
        tile.style.transform = 'scale(1.02)';
        announce(`Selected: ${this.modes[index].title}`);
      } else {
        tile.style.borderColor = 'var(--color-border, #dee2e6)';
        tile.style.backgroundColor = 'var(--color-surface, #f8f9fa)';
        tile.style.transform = 'scale(1)';
      }
    });
  }

  /**
   * Select a mode
   */
  selectMode(index) {
    const mode = this.modes[index];
    announce(`${mode.title} selected. Loading...`);

    // Clean up
    this.close();

    // Callback
    if (this.onModeSelected) {
      this.onModeSelected(mode.id);
    }
  }

  /**
   * Close the selector
   */
  close() {
    if (this.removeTrap) {
      this.removeTrap();
      this.removeTrap = null;
    }

    popFocus();

    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }

    this.container = null;
  }

  /**
   * Dispose
   */
  dispose() {
    this.close();
  }
}
