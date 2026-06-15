/**
 * Intermediate Mode Controller
 * Full toolbox and keyboard, concept-focused lessons
 */

import { announce, announceProgress } from '../shared/utilities/announce.js';
import { loadProgress, saveProgress } from '../shared/utilities/progress-store.js';
import { validateLessons } from '../shared/utilities/lesson-validator.js';
import lessonsData from './lessons.json';

export class IntermediateController {
  constructor() {
    this.lessons = [];
    this.currentLessonIndex = 0;
    this.currentStepIndex = 0;
    this.completedLessons = new Set();
    this.completedConcepts = new Set();
    this.isInitialized = false;
    this.hintsShown = 0;
  }

  /**
   * Initialize Intermediate mode
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

      this.lessons = lessonsData;

      // Load saved progress
      const savedProgress = loadProgress('intermediate');
      
      if (savedProgress) {
        this.loadFromProgress(savedProgress);
        announce('Welcome back to Intermediate Mode! Continuing from where you left off.');
      } else {
        announce('Welcome to Intermediate Mode! All blocks and keyboard commands are available.');
      }

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize Intermediate mode:', error);
      announce('Error initializing tutorial mode.');
      return false;
    }
  }

  /**
   * Get current lesson
   * @returns {Object|null}
   */
  getCurrentLesson() {
    return this.lessons[this.currentLessonIndex] || null;
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
   * Check if concept is completed
   * @param {string} conceptId - Concept identifier
   * @returns {boolean}
   */
  isConceptCompleted(conceptId) {
    return this.completedConcepts.has(conceptId);
  }

  /**
   * Mark concept as completed
   * @param {string} conceptId - Concept identifier
   */
  completeConcept(conceptId) {
    if (!this.completedConcepts.has(conceptId)) {
      this.completedConcepts.add(conceptId);
      announce(`Concept mastered: ${conceptId}`);
      this.saveCurrentProgress();
    }
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

    return null;
  }

  /**
   * Complete current lesson and move to next
   * @returns {Object|null} Next lesson or null if all complete
   */
  completeLesson() {
    const currentLesson = this.getCurrentLesson();
    if (!currentLesson) return null;

    this.completedLessons.add(currentLesson.id);

    if (this.currentLessonIndex < this.lessons.length - 1) {
      this.currentLessonIndex++;
      this.currentStepIndex = 0;
      this.hintsShown = 0;

      const nextLesson = this.getCurrentLesson();
      announce(`Lesson complete! Starting: ${nextLesson.title}`);
      announceProgress(
        this.completedLessons.size,
        this.lessons.length,
        'lessons'
      );

      this.saveCurrentProgress();
      return nextLesson;
    }

    announce('Congratulations! You have completed all Intermediate mode lessons!');
    this.saveCurrentProgress();
    return null;
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
   * Get progress summary
   * @returns {Object}
   */
  getProgress() {
    if (!this.isInitialized) {
      return { ready: false };
    }

    const lesson = this.getCurrentLesson();
    const percentComplete = Math.round((this.completedLessons.size / this.lessons.length) * 100);

    return {
      ready: true,
      currentLessonIndex: this.currentLessonIndex,
      totalLessons: this.lessons.length,
      completedCount: this.completedLessons.size,
      percentComplete,
      currentLessonTitle: lesson?.title || 'Unknown',
      currentStepIndex: this.currentStepIndex,
      totalSteps: lesson?.steps?.length || 0,
      conceptsCompleted: this.completedConcepts.size
    };
  }

  /**
   * Load state from progress data
   * @param {Object} progressData - Saved progress data
   */
  loadFromProgress(progressData) {
    if (!progressData) return;

    this.currentLessonIndex = progressData.currentLessonIndex || 0;
    this.currentStepIndex = progressData.currentStepIndex || 0;
    this.completedLessons = new Set(progressData.completedLessons || []);
    this.completedConcepts = new Set(progressData.completedConcepts || []);
    this.hintsShown = progressData.hintsShown || 0;
  }

  /**
   * Export state for saving
   * @returns {Object}
   */
  exportForSave() {
    return {
      currentLessonIndex: this.currentLessonIndex,
      currentStepIndex: this.currentStepIndex,
      completedLessons: Array.from(this.completedLessons),
      completedConcepts: Array.from(this.completedConcepts),
      hintsShown: this.hintsShown
    };
  }

  /**
   * Save current progress to localStorage
   */
  saveCurrentProgress() {
    const progressData = this.exportForSave();
    saveProgress('intermediate', progressData);
  }

  /**
   * Reset progress to beginning
   */
  reset() {
    this.currentLessonIndex = 0;
    this.currentStepIndex = 0;
    this.completedLessons.clear();
    this.completedConcepts.clear();
    this.hintsShown = 0;
    this.saveCurrentProgress();
    announce('Progress reset. Starting from the beginning.');
  }

  /**
   * Jump to specific lesson
   * @param {number} lessonIndex - Index of lesson
   * @returns {boolean} Success status
   */
  goToLesson(lessonIndex) {
    if (lessonIndex < 0 || lessonIndex >= this.lessons.length) {
      return false;
    }

    this.currentLessonIndex = lessonIndex;
    this.currentStepIndex = 0;
    this.hintsShown = 0;

    const lesson = this.getCurrentLesson();
    announce(`Switched to lesson: ${lesson.title}`);
    this.saveCurrentProgress();
    return true;
  }

  /**
   * Dispose controller
   */
  dispose() {
    this.saveCurrentProgress();
    this.isInitialized = false;
  }
}
