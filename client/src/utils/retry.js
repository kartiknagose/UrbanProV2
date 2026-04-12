/**
 * Exponential backoff retry utility
 * 
 * Retries a function with exponentially increasing delays
 * Perfect for network errors, timeouts, and transient failures
 */

/**
 * Calculate delay with exponential backoff
 * attempt 0: 100ms
 * attempt 1: 200ms
 * attempt 2: 400ms
 * With jitter to prevent thundering herd
 */
const getBackoffDelay = (attempt, baseDelay = 100, maxDelay = 5000) => {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  // Add ±10% jitter to prevent synchronized retries
  const jitter = delay * (0.1 * Math.random() - 0.05);
  return Math.round(delay + jitter);
};

/**
 * Retry function with exponential backoff
 * 
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum retry attempts (default: 2)
 * @param {object} options - { baseDelay, maxDelay, onRetry }
 * @returns {*} - Result from successful attempt or last error if all fail
 */
export const withExponentialBackoff = async (
  fn,
  maxRetries = 2,
  options = {}
) => {
  const { baseDelay = 100, maxDelay = 5000, onRetry } = options;
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if this is the last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Don't retry on client errors (4xx) except 408, 429, 502, 503, 504
      const status = error.response?.status;
      const isRetryable = !status || status >= 400 && [408, 429, 502, 503, 504].includes(status);
      
      if (!isRetryable) {
        throw error;
      }

      // Calculate backoff delay
      const delayMs = getBackoffDelay(attempt, baseDelay, maxDelay);

      // Notify caller
      if (onRetry) {
        onRetry({ attempt, delayMs, error });
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
};

/**
 * Retry decorator for axios-like request() function
 * 
 * Usage:
 * const result = await withRetry(() => axios.get('/api/data'), { maxRetries: 3 });
 */
export const withRetry = (requestFn, options = {}) => {
  const { maxRetries = 2, ...rest } = options;
  return withExponentialBackoff(requestFn, maxRetries, rest);
};

/**
 * Determine if an error is retryable
 */
export const isRetryableError = (error) => {
  // Network errors are retryable
  if (error.code === 'ECONNABORTED') return true; // Timeout
  if (error.code === 'ECONNREFUSED') return true; // Connection refused
  if (error.code === 'ENOTFOUND') return true; // DNS lookup failed
  if (error.message === 'Network Error') return true;

  // No response = network error
  if (error.request && !error.response) return true;

  // Specific retryable status codes
  const status = error.response?.status;
  if ([408, 429, 500, 502, 503, 504].includes(status)) return true;

  return false;
};
