/**
 * Progress persistence using localStorage
 * Scoped by mode and user profile
 */

const STORAGE_KEY_PREFIX = 'blockly-tutorial';
const DEFAULT_PROFILE = 'default';

/**
 * Get storage key for mode and profile
 * @param {string} mode - Tutorial mode (beginner, intermediate, expert)
 * @param {string} profile - User profile ID
 * @returns {string}
 */
function getStorageKey(mode, profile = DEFAULT_PROFILE) {
  return `${STORAGE_KEY_PREFIX}-${mode}-${profile}`;
}

/**
 * Load progress for a mode
 * @param {string} mode - Tutorial mode
 * @param {string} profile - User profile ID
 * @returns {Object|null}
 */
export function loadProgress(mode, profile = DEFAULT_PROFILE) {
  try {
    const key = getStorageKey(mode, profile);
    const data = localStorage.getItem(key);
    
    if (!data) return null;
    
    const progress = JSON.parse(data);
    
    // Validate basic structure
    if (typeof progress !== 'object' || progress === null) {
      console.warn('Invalid progress data:', progress);
      return null;
    }
    
    return progress;
  } catch (error) {
    console.error('Failed to load progress:', error);
    return null;
  }
}

/**
 * Save progress for a mode
 * @param {string} mode - Tutorial mode
 * @param {Object} progress - Progress data
 * @param {string} profile - User profile ID
 * @returns {boolean} Success status
 */
export function saveProgress(mode, progress, profile = DEFAULT_PROFILE) {
  try {
    const key = getStorageKey(mode, profile);
    const data = JSON.stringify({
      ...progress,
      lastUpdated: new Date().toISOString()
    });
    
    localStorage.setItem(key, data);
    return true;
  } catch (error) {
    console.error('Failed to save progress:', error);
    return false;
  }
}

/**
 * Clear progress for a mode
 * @param {string} mode - Tutorial mode
 * @param {string} profile - User profile ID
 * @returns {boolean} Success status
 */
export function clearProgress(mode, profile = DEFAULT_PROFILE) {
  try {
    const key = getStorageKey(mode, profile);
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error('Failed to clear progress:', error);
    return false;
  }
}

/**
 * Get all profiles with saved progress for a mode
 * @param {string} mode - Tutorial mode
 * @returns {string[]} Array of profile IDs
 */
export function getProfiles(mode) {
  const profiles = [];
  const prefix = `${STORAGE_KEY_PREFIX}-${mode}-`;
  
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        const profile = key.substring(prefix.length);
        profiles.push(profile);
      }
    }
  } catch (error) {
    console.error('Failed to get profiles:', error);
  }
  
  return profiles;
}

/**
 * Export progress for backup
 * @param {string} mode - Tutorial mode
 * @param {string} profile - User profile ID
 * @returns {string|null} JSON string or null
 */
export function exportProgress(mode, profile = DEFAULT_PROFILE) {
  const progress = loadProgress(mode, profile);
  if (!progress) return null;
  
  try {
    return JSON.stringify({
      version: 1,
      mode,
      profile,
      exportedAt: new Date().toISOString(),
      data: progress
    }, null, 2);
  } catch (error) {
    console.error('Failed to export progress:', error);
    return null;
  }
}

/**
 * Import progress from backup
 * @param {string} jsonString - Exported JSON string
 * @returns {boolean} Success status
 */
export function importProgress(jsonString) {
  try {
    const backup = JSON.parse(jsonString);
    
    // Validate backup structure
    if (!backup.version || !backup.mode || !backup.data) {
      console.error('Invalid backup format');
      return false;
    }
    
    const profile = backup.profile || DEFAULT_PROFILE;
    return saveProgress(backup.mode, backup.data, profile);
  } catch (error) {
    console.error('Failed to import progress:', error);
    return false;
  }
}

/**
 * Check if progress exists for a mode
 * @param {string} mode - Tutorial mode
 * @param {string} profile - User profile ID
 * @returns {boolean}
 */
export function hasProgress(mode, profile = DEFAULT_PROFILE) {
  const key = getStorageKey(mode, profile);
  return localStorage.getItem(key) !== null;
}
