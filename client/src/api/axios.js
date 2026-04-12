// Axios instance configuration with interceptors for API calls
// Handles authentication tokens, request/response logging, error handling
// Includes exponential backoff retry logic, network detection, per-endpoint timeouts

import axios from 'axios';
import { API_BASE_URL } from '../config/runtime';
import { clientEnv } from '../config/env';
import { isNetworkOnline, isSlowConnection } from '../utils/network';
import { withExponentialBackoff } from '../utils/retry';
import { safeGetItem, safeRemoveItem } from '../utils/storage';

// Base API URL - points to backend server
const API_URL = API_BASE_URL;

const PUBLIC_EXACT_PATHS = new Set([
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
]);

const PUBLIC_PREFIX_PATHS = [
  '/services',
  '/system-status',
  '/about',
  '/contact',
  '/how-it-works',
  '/pricing',
  '/security',
  '/faq',
  '/privacy',
  '/terms',
  '/cookies',
  '/blog',
  '/careers',
];

const isPublicPathname = (pathname) => {
  if (!pathname) return false;
  if (PUBLIC_EXACT_PATHS.has(pathname)) return true;
  return PUBLIC_PREFIX_PATHS.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
};

// Create axios instance with default config
const axiosInstance = axios.create({
  baseURL: API_URL,
  timeout: clientEnv.apiTimeoutMs,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important: Send cookies with requests for auth
});

const getStoredAuthToken = () => {
  const token = safeGetItem('authToken');
  return typeof token === 'string' ? token.trim() : '';
};

// Request interceptor - Runs before every request
axiosInstance.interceptors.request.use(
  (config) => {
    // Check network state before making request
    if (!isNetworkOnline()) {
      const error = new Error('No network connection. Please check your internet.');
      error.code = 'OFFLINE';
      return Promise.reject(error);
    }

    // Adjust timeout based on connection speed (slow connections get more time)
    if (isSlowConnection()) {
      config.timeout = Math.max(config.timeout || clientEnv.apiTimeoutMs, 15000);
    }

    const authToken = getStoredAuthToken();
    if (authToken) {
      config.headers = {
        ...(config.headers || {}),
        Authorization: `Bearer ${authToken}`,
      };
    }

    return config;
  },
  (error) => {
    // Handle request error
    return Promise.reject(error);
  }
);

// Response interceptor - Runs after every response
axiosInstance.interceptors.response.use(
  (response) => {
    // Return response data directly for cleaner API calls
    return response;
  },
  (error) => {
    // Handle response errors globally
    // Network detection happens here
    if (!isNetworkOnline()) {
      error.code = 'OFFLINE';
      error.message = 'Network connection lost. Your request was not sent. Please reconnect and try again.';
    }

    if (error.code === 'ECONNABORTED') {
      console.error('Request timed out - backend took too long to respond');
      error.message = 'Request took too long. The server may be overloaded. Please try again.';
    }

    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;

      // Handle 401 Unauthorized - token expired or invalid
      if (status === 401) {
        // Only redirect if there was a prior user session
        const hadUser = localStorage.getItem('user');

        // Clear auth data safely
        try {
          localStorage.removeItem('user');
        } catch {
          // Ignored - storage might be unavailable
        }

        safeRemoveItem('authToken');

        // Only redirect to login if not on public routes.
        const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
        const isPublicPath = isPublicPathname(pathname);

        if (hadUser && !isPublicPath) {
          // Dispatch a custom event so AuthContext can handle navigation
          // via React Router instead of a full page reload.
          window.dispatchEvent(new CustomEvent('auth:session-expired'));
        }
      }

      // Handle 403 Forbidden - insufficient permissions
      if (status === 403) {
        console.error('Access denied:', data?.error || data?.message);
      }

      // Handle 404 Not Found
      if (status === 404) {
        console.error('Resource not found:', data?.error || data?.message);
      }

      // Handle 500+ Server Errors - these might be transient
      if (status >= 500) {
        console.error('Server error:', data?.error || data?.message);
      }
    } else if (error.request) {
      // Request made but no response received (network error)
      if (!error.message?.includes('Network')) {
        console.error('Network error - server not responding:', error.message);
      }
    } else {
      // Something else happened
      console.error('Request error:', error.message);
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;

/**
 * Create a request wrapper with exponential backoff retry logic
 * 
 * Usage:
 * const result = await withAutoRetry(() => axiosInstance.get('/api/data'));
 * 
 * @param {Function} requestFn - Function that returns axios promise
 * @param {object} options - { maxRetries, baseDelay, endpointName }
 * @returns {Promise} - Result with auto-retry on transient failures
 */
export const withAutoRetry = async (requestFn, options = {}) => {
  const { maxRetries = 2, baseDelay = 100, endpointName = 'API' } = options;

  return withExponentialBackoff(requestFn, maxRetries, {
    baseDelay,
    maxDelay: 5000,
    onRetry: ({ attempt, delayMs, error }) => {
      console.warn(
        `[${endpointName}] Retry ${attempt + 1}/${maxRetries} after ${delayMs}ms`,
        error?.code || error?.response?.status
      );
    },
  });
};
