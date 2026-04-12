/**
 * localStorage safety wrapper
 * 
 * Handles:
 * - Private browsing mode (quota exceeded)
 * - Security restrictions
 * - Quota exhaustion
 * - Graceful fallback to in-memory storage
 */

// Fallback in-memory storage when localStorage unavailable
const inMemoryStore = new Map();

/**
 * Safe localStorage.getItem with fallback
 * 
 * @param {string} key
 * @param {*} defaultValue - Returned if key not found
 * @returns {*} - Parsed value or defaultValue
 */
export const safeGetItem = (key, defaultValue = null) => {
  try {
    const value = localStorage.getItem(key);
    if (value === null) return defaultValue;

    // Try to parse as JSON first
    try {
      return JSON.parse(value);
    } catch {
      // If not JSON, return raw string
      return value;
    }
  } catch (error) {
    // localStorage unavailable (private browsing, QuotaExceededError, etc.)
    console.warn(`localStorage.getItem failed for key "${key}":`, error.message);

    // Return from in-memory store as fallback
    if (inMemoryStore.has(key)) {
      return inMemoryStore.get(key);
    }

    return defaultValue;
  }
};

/**
 * Safe localStorage.setItem with fallback
 * 
 * @param {string} key
 * @param {*} value - Will be JSON stringified
 * @returns {boolean} - true if successful, false if failed
 */
export const safeSetItem = (key, value) => {
  try {
    const stringified = typeof value === 'string' ? value : JSON.stringify(value);
    localStorage.setItem(key, stringified);
    return true;
  } catch (error) {
    // localStorage unavailable or quota exceeded
    console.warn(`localStorage.setItem failed for key "${key}":`, error.message);

    // Fallback to in-memory store
    try {
      inMemoryStore.set(key, value);
      return false; // Indicate it's using fallback
    } catch {
      // Even in-memory storage failed
      console.error(`Failed to store "${key}" in both localStorage and memory`);
      return false;
    }
  }
};

/**
 * Safe localStorage.removeItem
 * 
 * @param {string} key
 * @returns {boolean} - true if successful
 */
export const safeRemoveItem = (key) => {
  try {
    localStorage.removeItem(key);
    inMemoryStore.delete(key);
    return true;
  } catch (error) {
    console.warn(`localStorage.removeItem failed for key "${key}":`, error.message);
    inMemoryStore.delete(key);
    return false;
  }
};

/**
 * Safe localStorage.clear
 */
export const safeClear = () => {
  try {
    localStorage.clear();
  } catch (error) {
    console.warn('localStorage.clear failed:', error.message);
  }
  inMemoryStore.clear();
};

/**
 * Check if localStorage is available
 * @returns {boolean}
 */
export const isLocalStorageAvailable = () => {
  try {
    const testKey = '__localStorage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
};

/**
 * Get all keys currently stored (including in-memory fallback)
 * @returns {string[]}
 */
export const getAllStorageKeys = () => {
  const keys = new Set();

  // Get localStorage keys if available
  try {
    for (let i = 0; i < localStorage.length; i++) {
      keys.add(localStorage.key(i));
    }
  } catch {
    // Ignored
  }

  // Add in-memory keys
  for (const key of inMemoryStore.keys()) {
    keys.add(key);
  }

  return Array.from(keys);
};
