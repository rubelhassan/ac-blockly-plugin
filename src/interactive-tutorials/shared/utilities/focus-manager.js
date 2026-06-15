/**
 * Focus management utilities for accessible navigation
 * Handles focus trapping, restoration, and visible focus indicators
 */

const focusStack = [];

/**
 * Save current focus and move to target element
 * @param {HTMLElement} targetElement - Element to receive focus
 * @returns {HTMLElement|null} Previously focused element
 */
export function moveFocus(targetElement) {
  if (!targetElement || !(targetElement instanceof HTMLElement)) {
    console.warn('moveFocus called with invalid target:', targetElement);
    return null;
  }

  const previousElement = document.activeElement;
  
  // Make element focusable if not already
  if (targetElement.tabIndex === -1 && !targetElement.hasAttribute('tabindex')) {
    targetElement.tabIndex = -1;
  }

  targetElement.focus();
  return previousElement;
}

/**
 * Push current focus to stack and move to target
 * @param {HTMLElement} targetElement - Element to receive focus
 */
export function pushFocus(targetElement) {
  const previous = document.activeElement;
  if (previous && previous !== document.body) {
    focusStack.push(previous);
  }
  moveFocus(targetElement);
}

/**
 * Restore focus from stack
 * @returns {boolean} True if focus was restored
 */
export function popFocus() {
  const targetElement = focusStack.pop();
  if (targetElement && document.contains(targetElement)) {
    moveFocus(targetElement);
    return true;
  }
  return false;
}

/**
 * Clear focus stack
 */
export function clearFocusStack() {
  focusStack.length = 0;
}

/**
 * Trap focus within a container element
 * @param {HTMLElement} container - Container to trap focus within
 * @returns {Function} Cleanup function to remove trap
 */
export function trapFocus(container) {
  if (!container) return () => {};

  const focusableElements = getFocusableElements(container);
  if (focusableElements.length === 0) {
    console.warn('No focusable elements in container:', container);
    return () => {};
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  const handleKeyDown = (e) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      // Shift+Tab
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  };

  container.addEventListener('keydown', handleKeyDown);

  // Focus first element
  firstElement.focus();

  // Return cleanup function
  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Get all focusable elements within a container
 * @param {HTMLElement} container - Container to search
 * @returns {HTMLElement[]} Array of focusable elements
 */
export function getFocusableElements(container) {
  if (!container) return [];

  const selector = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable]'
  ].join(',');

  return Array.from(container.querySelectorAll(selector))
    .filter(el => {
      // Filter out hidden elements
      return el.offsetWidth > 0 || 
             el.offsetHeight > 0 || 
             el.getClientRects().length > 0;
    });
}

/**
 * Ensure an element is visible and scrolled into view
 * @param {HTMLElement} element - Element to scroll to
 * @param {Object} options - Scroll options
 */
export function ensureVisible(element, options = {}) {
  if (!element) return;

  const defaults = {
    behavior: 'smooth',
    block: 'nearest',
    inline: 'nearest'
  };

  element.scrollIntoView({ ...defaults, ...options });
}

/**
 * Create a skip link
 * @param {string} targetId - ID of target element
 * @param {string} label - Link text
 * @returns {HTMLElement} Skip link element
 */
export function createSkipLink(targetId, label = 'Skip to main content') {
  const skipLink = document.createElement('a');
  skipLink.href = `#${targetId}`;
  skipLink.className = 'skip-link';
  skipLink.textContent = label;
  
  skipLink.addEventListener('click', (e) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      moveFocus(target);
      ensureVisible(target);
    }
  });

  return skipLink;
}
