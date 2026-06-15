/**
 * Beginner Mode Unlock State Machine
 * Manages progressive unlocking of blocks and keyboard commands
 */

import { announce } from '../shared/utilities/announce.js';

export class UnlockState {
  constructor(lessons) {
    this.lessons = lessons;
    this.currentLessonIndex = 0;
    this.completedLessons = new Set();
    this.unlockedBlocks = new Set();
    this.unlockedKeys = new Set();
    
    // Initialize with first lesson's unlocks
    if (lessons.length > 0) {
      this.unlockLesson(lessons[0]);
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
   * Check if a block type is unlocked
   * @param {string} blockType - Block type to check
   * @returns {boolean}
   */
  isBlockUnlocked(blockType) {
    return this.unlockedBlocks.has(blockType);
  }

  /**
   * Check if a keyboard command is unlocked
   * @param {string} key - Key name to check
   * @returns {boolean}
   */
  isKeyUnlocked(key) {
    return this.unlockedKeys.has(key);
  }

  /**
   * Get which lesson unlocks a specific block
   * @param {string} blockType - Block type
   * @returns {Object|null} Lesson that unlocks this block
   */
  getUnlockLesson(blockType) {
    return this.lessons.find(lesson => 
      lesson.unlocks.blocks.includes(blockType)
    ) || null;
  }

  /**
   * Get which lesson unlocks a specific key
   * @param {string} key - Key name
   * @returns {Object|null} Lesson that unlocks this key
   */
  getKeyUnlockLesson(key) {
    return this.lessons.find(lesson => 
      lesson.unlocks.keys.includes(key)
    ) || null;
  }

  /**
   * Unlock items from a lesson
   * @param {Object} lesson - Lesson to unlock
   */
  unlockLesson(lesson) {
    lesson.unlocks.blocks.forEach(block => {
      if (!this.unlockedBlocks.has(block)) {
        this.unlockedBlocks.add(block);
        announce(`Unlocked block: ${block}`);
      }
    });

    lesson.unlocks.keys.forEach(key => {
      if (!this.unlockedKeys.has(key)) {
        this.unlockedKeys.add(key);
        announce(`Unlocked keyboard command: ${key}`);
      }
    });
  }

  /**
   * Mark current lesson as complete and advance
   * @returns {Object|null} Next lesson or null if complete
   */
  completeCurrentLesson() {
    const current = this.getCurrentLesson();
    if (!current) return null;

    this.completedLessons.add(current.id);

    // Move to next lesson
    if (this.currentLessonIndex < this.lessons.length - 1) {
      this.currentLessonIndex++;
      const nextLesson = this.getCurrentLesson();
      this.unlockLesson(nextLesson);
      return nextLesson;
    }

    return null;
  }

  /**
   * Get all unlocked blocks as array
   * @returns {string[]}
   */
  getUnlockedBlocks() {
    return Array.from(this.unlockedBlocks);
  }

  /**
   * Get all unlocked keys as array
   * @returns {string[]}
   */
  getUnlockedKeys() {
    return Array.from(this.unlockedKeys);
  }

  /**
   * Get progress summary
   * @returns {Object}
   */
  getProgress() {
    return {
      currentLessonIndex: this.currentLessonIndex,
      totalLessons: this.lessons.length,
      completedCount: this.completedLessons.size,
      percentComplete: Math.round((this.completedLessons.size / this.lessons.length) * 100),
      unlockedBlocksCount: this.unlockedBlocks.size,
      unlockedKeysCount: this.unlockedKeys.size
    };
  }

  /**
   * Load state from progress data
   * @param {Object} progressData - Saved progress data
   */
  loadFromProgress(progressData) {
    if (!progressData) return;

    this.currentLessonIndex = progressData.currentLessonIndex || 0;
    this.completedLessons = new Set(progressData.completedLessons || []);
    this.unlockedBlocks = new Set(progressData.unlockedBlocks || []);
    this.unlockedKeys = new Set(progressData.unlockedKeys || []);
  }

  /**
   * Export state for saving
   * @returns {Object}
   */
  exportForSave() {
    return {
      currentLessonIndex: this.currentLessonIndex,
      completedLessons: Array.from(this.completedLessons),
      unlockedBlocks: Array.from(this.unlockedBlocks),
      unlockedKeys: Array.from(this.unlockedKeys)
    };
  }

  /**
   * Reset to initial state
   */
  reset() {
    this.currentLessonIndex = 0;
    this.completedLessons.clear();
    this.unlockedBlocks.clear();
    this.unlockedKeys.clear();

    // Re-initialize with first lesson
    if (this.lessons.length > 0) {
      this.unlockLesson(this.lessons[0]);
    }
  }

  /**
   * Check if all lessons are complete
   * @returns {boolean}
   */
  isComplete() {
    return this.completedLessons.size === this.lessons.length;
  }

  /**
   * Replay a specific lesson (set as current without resetting unlocks)
   * @param {number} lessonIndex - Index of lesson to replay
   * @returns {boolean} Success status
   */
  replayLesson(lessonIndex) {
    if (lessonIndex < 0 || lessonIndex >= this.lessons.length) {
      return false;
    }

    // Can only replay completed lessons
    const lesson = this.lessons[lessonIndex];
    if (!this.completedLessons.has(lesson.id)) {
      return false;
    }

    this.currentLessonIndex = lessonIndex;
    return true;
  }
}
