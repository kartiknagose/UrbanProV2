/**
 * Toast Notification Helpers
 * Centralized toast management with aggressive deduplication
 * 
 * This eliminates the toast overload problem by:
 * - Deduplicating identical messages
 * - Tracking recently shown toasts
 * - Preventing duplicate messages within time window
 * - Providing semantic helper functions
 * 
 * User requirement: "Eliminate toasts aggressively across all flows"
 */

import { toast } from 'sonner';

// Track recent toasts to prevent duplicates
const recentToasts = new Map();
const DEDUP_WINDOW_MS = 2000; // Don't show same message within 2 seconds

/**
 * Generate a unique key for a toast message
 * @param {string} message
 * @param {string} type
 * @returns {string}
 */
function getToastKey(message, type) {
  return `${type}|${message}`;
}

/**
 * Check if we should show this toast (deduplication)
 * @param {string} key
 * @returns {boolean}
 */
function shouldShowToast(key) {
  const lastShown = recentToasts.get(key);
  if (!lastShown) return true;

  const timeSinceLastShown = Date.now() - lastShown;
  return timeSinceLastShown > DEDUP_WINDOW_MS;
}

/**
 * Record that we showed a toast
 * @param {string} key
 */
function recordToast(key) {
  recentToasts.set(key, Date.now());

  // Clean up old entries periodically
  if (recentToasts.size > 50) {
    const now = Date.now();
    for (const [k, timestamp] of recentToasts.entries()) {
      if (now - timestamp > DEDUP_WINDOW_MS * 2) {
        recentToasts.delete(k);
      }
    }
  }
}

/**
 * Core toast function with deduplication
 * @param {string} message
 * @param {string} type - 'success' | 'error' | 'warning' | 'info'
 * @param {Object} options - additional sonner options
 */
function showToast(message, type, options = {}) {
  const key = getToastKey(message, type);

  if (!shouldShowToast(key)) {
    return; // Duplicate within time window - skip
  }

  recordToast(key);
  return toast[type](message, {
    duration: 3000,
    ...options,
  });
}

/**
 * SUCCESS Toast
 * @param {string} message
 * @param {Object} options
 */
export function toastSuccess(message, options = {}) {
  return showToast(message, 'success', {
    ...options,
    duration: 2500,
  });
}

/**
 * ERROR Toast
 * @param {string} message
 * @param {Object} options
 */
export function toastError(message, options = {}) {
  return showToast(message, 'error', {
    ...options,
    duration: 4000, // Errors shown longer
  });
}

/**
 * WARNING Toast
 * @param {string} message
 * @param {Object} options
 */
export function toastWarning(message, options = {}) {
  return showToast(message, 'warning', {
    ...options,
    duration: 3500,
  });
}

/**
 * INFO Toast
 * @param {string} message
 * @param {Object} options
 */
export function toastInfo(message, options = {}) {
  return showToast(message, 'info', {
    ...options,
    duration: 3000,
  });
}

/**
 * PROMISE Toast - Show loading, then update with result
 * @param {Promise} promise
 * @param {Object} messages - { loading, success, error }
 * @param {Object} options
 */
export function toastPromise(promise, messages, options = {}) {
  return toast.promise(promise, {
    loading: messages.loading || 'Loading...',
    success: messages.success || 'Success!',
    error: messages.error || 'Error occurred',
    ...options,
  });
}

/**
 * BATCH TOAST - Show multiple related messages without duplication
 * Returns only unique messages that haven't been shown recently
 * @param {Array} messages - Array of { text, type }
 */
export function toastBatch(messages) {
  const uniqueMessages = [];
  const seenKeys = new Set();

  for (const msg of messages) {
    const key = getToastKey(msg.text, msg.type || 'info');
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      if (shouldShowToast(key)) {
        uniqueMessages.push(msg);
        recordToast(key);
      }
    }
  }

  uniqueMessages.forEach((msg, idx) => {
    setTimeout(() => {
      toast[msg.type || 'info'](msg.text, {
        duration: 3000,
      });
    }, idx * 400); // Stagger messages 400ms apart
  });

  return uniqueMessages.length;
}

/**
 * DOMAIN-SPECIFIC: Booking Toast
 */
export function toastBookingConfirmed(bookingId) {
  toastSuccess(`Booking #${bookingId} confirmed!`);
}

/**
 * DOMAIN-SPECIFIC: Booking Cancelled
 */
export function toastBookingCancelled() {
  toastWarning('Booking cancelled successfully');
}

/**
 * DOMAIN-SPECIFIC: Payment Success
 */
export function toastPaymentSuccess(amount) {
  toastSuccess(`Payment of ₹${amount} successful!`);
}

/**
 * DOMAIN-SPECIFIC: Verification Success
 */
export function toastVerificationComplete() {
  toastSuccess('Verification completed successfully!');
}

/**
 * DOMAIN-SPECIFIC: Profile Updated
 */
export function toastProfileUpdated() {
  toastSuccess('Profile updated successfully!');
}

/**
 * DOMAIN-SPECIFIC: Copy to Clipboard
 */
export function toastCopied(text = 'Copied to clipboard') {
  toastSuccess(text, { duration: 2000 });
}

/**
 * Clear all tracked toasts (useful for page transitions)
 */
export function clearToastHistory() {
  recentToasts.clear();
}

/**
 * GENERIC: Show error with details
 * Extracts message from various error formats
 */
export function toastErrorFromResponse(error, defaultMessage = 'An error occurred') {
  let message = defaultMessage;

  if (typeof error === 'string') {
    message = error;
  } else if (error?.response?.data?.message) {
    message = error.response.data.message;
  } else if (error?.response?.data?.error) {
    message = error.response.data.error;
  } else if (error?.message) {
    message = error.message;
  }

  toastError(message);
 }
