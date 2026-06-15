/**
 * Lesson JSON schema validator
 * Ensures consistent schema across all lessons
 */

/**
 * Validate a single lesson object
 * @param {Object} lesson - Lesson to validate
 * @returns {Object} {valid: boolean, errors: string[]}
 */
export function validateLesson(lesson) {
  const errors = [];

  // Required fields
  if (!lesson.id || typeof lesson.id !== 'string') {
    errors.push('Missing or invalid lesson ID');
  }

  if (!lesson.title || typeof lesson.title !== 'string') {
    errors.push('Missing or invalid title');
  }

  if (!lesson.summary || typeof lesson.summary !== 'string') {
    errors.push('Missing or invalid summary');
  }

  if (typeof lesson.estimatedMinutes !== 'number' || lesson.estimatedMinutes < 0) {
    errors.push('Missing or invalid estimatedMinutes (must be non-negative number)');
  }

  // Unlocks object
  if (!lesson.unlocks || typeof lesson.unlocks !== 'object') {
    errors.push('Missing or invalid unlocks object');
  } else {
    if (!Array.isArray(lesson.unlocks.blocks)) {
      errors.push('unlocks.blocks must be an array');
    }
    if (!Array.isArray(lesson.unlocks.keys)) {
      errors.push('unlocks.keys must be an array');
    }
  }

  // Preconditions object
  if (!lesson.preconditions || typeof lesson.preconditions !== 'object') {
    errors.push('Missing or invalid preconditions object');
  } else {
    if (!Array.isArray(lesson.preconditions.blocks)) {
      errors.push('preconditions.blocks must be an array');
    }
    if (!Array.isArray(lesson.preconditions.keys)) {
      errors.push('preconditions.keys must be an array');
    }
  }

  // Steps array
  if (!Array.isArray(lesson.steps)) {
    errors.push('steps must be an array');
  } else {
    lesson.steps.forEach((step, index) => {
      if (!step.stepId || typeof step.stepId !== 'string') {
        errors.push(`Step ${index}: missing or invalid stepId`);
      }
      if (!step.instruction || typeof step.instruction !== 'string') {
        errors.push(`Step ${index}: missing or invalid instruction`);
      }
      if (!step.screenReaderHint || typeof step.screenReaderHint !== 'string') {
        errors.push(`Step ${index}: missing or invalid screenReaderHint`);
      }
      if (!step.successCriterion || typeof step.successCriterion !== 'object') {
        errors.push(`Step ${index}: missing or invalid successCriterion`);
      }
    });
  }

  // Hints array
  if (!Array.isArray(lesson.hints)) {
    errors.push('hints must be an array');
  } else {
    lesson.hints.forEach((hint, index) => {
      if (typeof hint !== 'string') {
        errors.push(`Hint ${index}: must be a string`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate an array of lessons
 * @param {Array} lessons - Array of lessons to validate
 * @returns {Object} {valid: boolean, errors: Object[]}
 */
export function validateLessons(lessons) {
  if (!Array.isArray(lessons)) {
    return {
      valid: false,
      errors: [{ lessonId: 'N/A', errors: ['Lessons must be an array'] }]
    };
  }

  const results = lessons.map(lesson => {
    const validation = validateLesson(lesson);
    return {
      lessonId: lesson.id || 'unknown',
      ...validation
    };
  });

  const allValid = results.every(r => r.valid);
  const errorResults = results.filter(r => !r.valid);

  return {
    valid: allValid,
    errors: errorResults
  };
}

/**
 * Get lesson schema template for reference
 * @returns {Object} Schema template
 */
export function getLessonSchema() {
  return {
    id: 'string (required, unique)',
    title: 'string (required)',
    summary: 'string (required)',
    estimatedMinutes: 'number (required, >= 0)',
    unlocks: {
      blocks: 'string[] (required)',
      keys: 'string[] (required)'
    },
    preconditions: {
      blocks: 'string[] (required)',
      keys: 'string[] (required)'
    },
    steps: [
      {
        stepId: 'string (required)',
        instruction: 'string (required)',
        screenReaderHint: 'string (required)',
        successCriterion: {
          type: 'string (e.g., "blockExists", "blockConnected", "codeRuns")',
          params: 'object (criterion-specific parameters)'
        }
      }
    ],
    hints: 'string[] (required, progressively revealing, never the answer)'
  };
}

/**
 * Check if unlocks and preconditions are consistent across lesson sequence
 * @param {Array} lessons - Ordered array of lessons
 * @returns {Object} {valid: boolean, warnings: string[]}
 */
export function validateLessonSequence(lessons) {
  const warnings = [];
  const unlockedBlocks = new Set();
  const unlockedKeys = new Set();

  lessons.forEach((lesson, index) => {
    // Check if preconditions are met by previous unlocks
    lesson.preconditions.blocks.forEach(block => {
      if (!unlockedBlocks.has(block)) {
        warnings.push(
          `Lesson ${lesson.id} (index ${index}): requires block "${block}" which hasn't been unlocked yet`
        );
      }
    });

    lesson.preconditions.keys.forEach(key => {
      if (!unlockedKeys.has(key)) {
        warnings.push(
          `Lesson ${lesson.id} (index ${index}): requires key "${key}" which hasn't been unlocked yet`
        );
      }
    });

    // Add this lesson's unlocks to the cumulative set
    lesson.unlocks.blocks.forEach(block => unlockedBlocks.add(block));
    lesson.unlocks.keys.forEach(key => unlockedKeys.add(key));
  });

  return {
    valid: warnings.length === 0,
    warnings
  };
}
