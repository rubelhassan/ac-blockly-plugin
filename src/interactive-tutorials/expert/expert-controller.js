/**
 * Expert Mode Controller
 * Standard Blockly sandbox with no scaffolding
 * Thin wrapper around parent plugin's Blockly initialization
 */

import { announce } from '../shared/utilities/announce.js';

export class ExpertController {
  constructor() {
    this.isInitialized = false;
  }

  /**
   * Initialize Expert mode
   * Delegates to parent plugin's workspace initialization
   * @param {Object} workspaceConfig - Blockly workspace configuration
   * @returns {Promise<boolean>} Success status
   */
  async init(workspaceConfig = {}) {
    try {
      announce('Expert Mode initialized. Full toolbox and keyboard commands available. No tutorial scaffolding.');
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize Expert mode:', error);
      announce('Error initializing Expert mode.');
      return false;
    }
  }

  /**
   * Get mode info
   * @returns {Object}
   */
  getInfo() {
    return {
      mode: 'expert',
      title: 'Expert Mode',
      description: 'Full Blockly workspace with no tutorials or scaffolding',
      features: {
        fullToolbox: true,
        allKeyboardCommands: true,
        noTutorials: true,
        noUnlocking: true
      }
    };
  }

  /**
   * Expert mode has no progress to track
   * @returns {Object}
   */
  getProgress() {
    return {
      mode: 'expert',
      message: 'Expert mode does not track progress'
    };
  }

  /**
   * Dispose controller
   */
  dispose() {
    this.isInitialized = false;
  }
}
