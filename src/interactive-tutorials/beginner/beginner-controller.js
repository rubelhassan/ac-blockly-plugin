/**
 * Beginner Mode Controller
 * Manages progressive tutorial with block and key unlocking
 */

import { UnlockState } from './unlock-state.js';
import { announce, announceProgress } from '../shared/utilities/announce.js';
import { loadProgress, saveProgress } from '../shared/utilities/progress-store.js';
import { validateLessons } from '../shared/utilities/lesson-validator.js';
import lessonsData from './lessons.json';

export class BeginnerController {
  constructor() {
    this.unlockState = null;
    this.currentStepIndex = 0;
    this.isInitialized = false;
    this.hints = [];
    this.hintsShown = 0;
  }

  /**
   * Initialize Beginner mode
   * @returns {Promise<boolean>} Success status
   */
  async init() {
    try {
      // Validate lessons
      const validation = validateLessons(lessonsData);
      if (!validation.valid) {
        console.error('Lesson validation failed:', validation.errors);
        announce('Error loading tutorial lessons. Please check console for details.');
        return false;
      }

      // Load saved progress
      const savedProgress = loadProgress('beginner');
      
      // Initialize unlock state
      this.unlockState = new UnlockState(lessonsData);
      
      if (savedProgress) {
        this.unlockState.loadFromProgress(savedProgress);
        this.currentStepIndex = savedProgress.currentStepIndex || 0;
        announce('Welcome back! Continuing from where you left off.');
      } else {
        announce('Welcome to Beginner Mode! Starting first lesson.');
      }

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize Beginner mode:', error);
      announce('Error initializing tutorial mode.');
      return false;
    }
  }

  /**
   * Get current lesson
   * @returns {Object|null}
   */
  getCurrentLesson() {
    return this.unlockState ? this.unlockState.getCurrentLesson() : null;
  }

  /**
   * Get current step within lesson
   * @returns {Object|null}
   */
  getCurrentStep() {
    const lesson = this.getCurrentLesson();
    if (!lesson || !lesson.steps) return null;
    return lesson.steps[this.currentStepIndex] || null;
  }

  /**
   * Check if step success criterion is met
   * @param {Object} criterion - Success criterion object
   * @returns {boolean}
   */
  checkStepCriterion(criterion) {
    // This will be implemented with actual Blockly integration
    // For now, return placeholder
    console.log('Checking criterion:', criterion);
    return false;
  }

  /**
   * Advance to next step
   * @returns {Object|null} Next step or null if lesson complete
   */
  nextStep() {
    const lesson = this.getCurrentLesson();
    if (!lesson) return null;

    if (this.currentStepIndex < lesson.steps.length - 1) {
      this.currentStepIndex++;
      const step = this.getCurrentStep();
      announce(step.screenReaderHint);
      this.saveCurrentProgress();
      return step;
    }

    // Lesson complete
    return null;
  }

  /**
   * Complete current lesson and move to next
   * @returns {Object|null} Next lesson or null if all complete
   */
  completeLesson() {
    if (!this.unlockState) return null;

    const nextLesson = this.unlockState.completeCurrentLesson();
    this.currentStepIndex = 0;
    this.hintsShown = 0;

    if (nextLesson) {
      announce(`Lesson complete! Starting: ${nextLesson.title}`);
      announceProgress(
        this.unlockState.completedLessons.size,
        lessonsData.length,
        'lessons'
      );
    } else {
      announce('Congratulations! You have completed all Beginner mode lessons!');
    }

    this.saveCurrentProgress();
    return nextLesson;
  }

  /**
   * Get next hint for current lesson
   * @returns {string|null} Hint text or null if no more hints
   */
  getNextHint() {
    const lesson = this.getCurrentLesson();
    if (!lesson || !lesson.hints) return null;

    if (this.hintsShown >= lesson.hints.length) {
      announce('No more hints available for this lesson.');
      return null;
    }

    const hint = lesson.hints[this.hintsShown];
    this.hintsShown++;
    announce(`Hint ${this.hintsShown}: ${hint}`);
    return hint;
  }

  /**
   * Check if block type is available
   * @param {string} blockType - Block type to check
   * @returns {Object} {available: boolean, reason: string|null}
   */
  isBlockAvailable(blockType) {
    if (!this.unlockState) {
      return { available: false, reason: 'Tutorial not initialized' };
    }

    if (this.unlockState.isBlockUnlocked(blockType)) {
      return { available: true, reason: null };
    }

    const unlockLesson = this.unlockState.getUnlockLesson(blockType);
    if (unlockLesson) {
      return {
        available: false,
        reason: `Unlocks in lesson: ${unlockLesson.title}`
      };
    }

    return { available: false, reason: 'Not available in Beginner mode' };
  }

  /**
   * Check if keyboard command is available
   * @param {string} key - Key name to check
   * @returns {Object} {available: boolean, reason: string|null}
   */
  isKeyAvailable(key) {
    if (!this.unlockState) {
      return { available: false, reason: 'Tutorial not initialized' };
    }

    if (this.unlockState.isKeyUnlocked(key)) {
      return { available: true, reason: null };
    }

    const unlockLesson = this.unlockState.getKeyUnlockLesson(key);
    if (unlockLesson) {
      return {
        available: false,
        reason: `Unlocks in lesson: ${unlockLesson.title}`
      };
    }

    return { available: false, reason: 'Not available in Beginner mode' };
  }

  /**
   * Get progress summary
   * @returns {Object}
   */
  getProgress() {
    if (!this.unlockState) {
      return { ready: false };
    }

    const progress = this.unlockState.getProgress();
    const lesson = this.getCurrentLesson();

    return {
      ready: true,
      ...progress,
      currentLessonTitle: lesson?.title || 'Unknown',
      currentStepIndex: this.currentStepIndex,
      totalSteps: lesson?.steps?.length || 0
    };
  }

  /**
   * Save current progress to localStorage
   */
  saveCurrentProgress() {
    if (!this.unlockState) return;

    const progressData = {
      ...this.unlockState.exportForSave(),
      currentStepIndex: this.currentStepIndex,
      hintsShown: this.hintsShown
    };

    saveProgress('beginner', progressData);
  }

  /**
   * Reset progress to beginning
   */
  reset() {
    if (!this.unlockState) return;

    this.unlockState.reset();
    this.currentStepIndex = 0;
    this.hintsShown = 0;
    this.saveCurrentProgress();
    announce('Progress reset. Starting from the beginning.');
  }

  /**
   * Replay a specific lesson
   * @param {number} lessonIndex - Index of lesson to replay
   * @returns {boolean} Success status
   */
  replayLesson(lessonIndex) {
    if (!this.unlockState) return false;

    const success = this.unlockState.replayLesson(lessonIndex);
    if (success) {
      this.currentStepIndex = 0;
      this.hintsShown = 0;
      const lesson = this.getCurrentLesson();
      announce(`Replaying lesson: ${lesson.title}`);
    }

    return success;
  }

  /**
   * Dispose controller
   */
  dispose() {
    this.saveCurrentProgress();
    this.isInitialized = false;
  }
}
