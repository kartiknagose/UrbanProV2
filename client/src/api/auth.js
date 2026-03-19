// Authentication API calls
// Handles user registration, login, logout, and email verification

import axiosInstance from './axios';

// Auth API endpoints
const AUTH_ENDPOINTS = {
  REGISTER_CUSTOMER: '/auth/register',
  REGISTER_WORKER: '/auth/register-worker',
  LOGIN: '/auth/login',
  LOGOUT: '/auth/logout',
  GET_ME: '/auth/me',
  VERIFY_EMAIL: '/auth/verify-email',
  FORGOT_PASSWORD: '/auth/forgot-password',
  RESET_PASSWORD: '/auth/reset-password',
  CHANGE_PASSWORD: '/auth/change-password',
};

const isRetryableNetworkError = (error) => (
  error?.code === 'ECONNABORTED' || (error?.request && !error?.response)
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const wakeBackend = async () => {
  try {
    await axiosInstance.get('/health', { timeout: 20000 });
  } catch (_error) {
    // Ignore wake-up ping failures and let the next request determine final outcome.
  }
};

const withRetryOnNetworkTimeout = async (requestFn, retries = 1) => {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;
      if (!isRetryableNetworkError(error) || attempt === retries) {
        throw error;
      }

      await wakeBackend();
      await sleep(1200);
    }
  }

  throw lastError;
};

/**
 * Register a new customer
 * @param {Object} data - Registration data
 * @param {string} data.name - User's full name
 * @param {string} data.email - User's email
 * @param {string} data.password - User's password
 * @param {string} data.mobile - User's mobile number
 * @returns {Promise} Response with user data and token
 */
export const registerCustomer = async (data) => {
  const response = await axiosInstance.post(AUTH_ENDPOINTS.REGISTER_CUSTOMER, data);
  return response.data;
};

/**
 * Register a new worker
 * @param {Object} data - Worker registration data
 * @param {string} data.name - Worker's full name
 * @param {string} data.email - Worker's email
 * @param {string} data.password - Worker's password
 * @param {string} data.mobile - Worker's mobile number
 * @param {string} data.bio - Worker's bio/description
 * @param {Array<string>} data.skills - Array of worker's skills
 * @param {number} data.hourlyRate - Worker's hourly rate
 * @returns {Promise} Response with user data and token
 */
export const registerWorker = async (data) => {
  const response = await axiosInstance.post(AUTH_ENDPOINTS.REGISTER_WORKER, data);
  return response.data;
};

/**
 * Login user (customer, worker, or admin)
 * @param {Object} credentials - Login credentials
 * @param {string} credentials.email - User's email
 * @param {string} credentials.password - User's password
 * @returns {Promise} Response with user data and token
 */
export const login = async (credentials) => {
  const response = await withRetryOnNetworkTimeout(
    () => axiosInstance.post(AUTH_ENDPOINTS.LOGIN, credentials),
    1
  );
  return response.data;
};

/**
 * Logout current user
 * @returns {Promise} Response confirming logout
 */
export const logout = async () => {
  const response = await axiosInstance.post(AUTH_ENDPOINTS.LOGOUT);
  return response.data;
};

/**
 * Get current authenticated user data
 * @returns {Promise} Response with current user data
 */
export const getCurrentUser = async () => {
  const response = await withRetryOnNetworkTimeout(
    () => axiosInstance.get(AUTH_ENDPOINTS.GET_ME),
    1
  );
  return response.data;
};

/**
 * Verify user's email with token from email link
 * @param {string} token - Email verification token
 * @returns {Promise} Response confirming email verification
 */
export const verifyEmail = async (token) => {
  const response = await axiosInstance.get(`${AUTH_ENDPOINTS.VERIFY_EMAIL}?token=${encodeURIComponent(token)}`);
  return response.data;
};

/**
 * Request a password reset link
 * @param {string} email - User email
 * @returns {Promise} Response with reset link (dev) and message
 */
export const requestPasswordReset = async (email) => {
  const response = await axiosInstance.post(AUTH_ENDPOINTS.FORGOT_PASSWORD, { email });
  return response.data;
};

/**
 * Reset password with token
 * @param {Object} data - Reset data
 * @param {string} data.token - Reset token
 * @param {string} data.password - New password
 * @returns {Promise} Response with confirmation
 */
export const resetPassword = async (data) => {
  const response = await axiosInstance.post(AUTH_ENDPOINTS.RESET_PASSWORD, data);
  return response.data;
};

/**
 * Change authenticated user's password
 * @param {Object} data - { currentPassword, newPassword }
 * @returns {Promise}
 */
export const changePassword = async (data) => {
  const response = await axiosInstance.post(AUTH_ENDPOINTS.CHANGE_PASSWORD, data);
  return response.data;
};
