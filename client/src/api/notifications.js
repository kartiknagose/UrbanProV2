// Notifications API calls
// Handles fetching, reading, and bulk-read of user notifications

import axiosInstance from './axios';
import { normalizeQueryInput } from './queryContext';

// Notification API endpoints
const NOTIFICATION_ENDPOINTS = {
  BASE: '/notifications',
  READ: (id) => `/notifications/${id}/read`,
  READ_ALL: '/notifications/read-all',
  VAPID_KEY: '/notifications/push/vapid-key',
  PUSH_SUBSCRIBE: '/notifications/push/subscribe',
  PUSH_UNSUBSCRIBE: '/notifications/push/unsubscribe',
  PUSH_SUBSCRIPTIONS: '/notifications/push/subscriptions',
  PREFERENCES: '/notifications/preferences',
};

/**
 * Get notifications for current user (paginated)
 * @param {Object} [params] - Optional pagination params { page, limit }
 * @returns {Promise<{ notifications, unreadCount, pagination }>}
 */
export const getNotifications = async (params) => {
  const normalized = normalizeQueryInput(params);
  const response = await axiosInstance.get(NOTIFICATION_ENDPOINTS.BASE, {
    params: normalized.params,
    signal: normalized.signal,
  });
  return response.data;
};

/**
 * Mark a single notification as read
 * @param {number} id - Notification ID
 * @returns {Promise<{ success: boolean }>}
 */
export const markNotificationAsRead = async (id) => {
  const response = await axiosInstance.patch(NOTIFICATION_ENDPOINTS.READ(id));
  return response.data;
};

/**
 * Mark all notifications as read for current user
 * @returns {Promise<{ success: boolean }>}
 */
export const markAllNotificationsAsRead = async () => {
  const response = await axiosInstance.post(NOTIFICATION_ENDPOINTS.READ_ALL);
  return response.data;
};

// ── Push notification APIs ──

export const getVapidPublicKey = async () => {
  const response = await axiosInstance.get(NOTIFICATION_ENDPOINTS.VAPID_KEY);
  return response.data.publicKey;
};

export const subscribePush = async (subscription) => {
  const response = await axiosInstance.post(NOTIFICATION_ENDPOINTS.PUSH_SUBSCRIBE, { subscription });
  return response.data;
};

export const unsubscribePush = async (endpoint) => {
  const response = await axiosInstance.post(NOTIFICATION_ENDPOINTS.PUSH_UNSUBSCRIBE, { endpoint });
  return response.data;
};

export const getPushSubscriptions = async () => {
  const response = await axiosInstance.get(NOTIFICATION_ENDPOINTS.PUSH_SUBSCRIPTIONS);
  return response.data.subscriptions;
};

// ── Notification preferences APIs ──

export const getNotificationPreferences = async () => {
  const response = await axiosInstance.get(NOTIFICATION_ENDPOINTS.PREFERENCES);
  return response.data.preferences;
};

export const updateNotificationPreferences = async (preferences) => {
  const response = await axiosInstance.patch(NOTIFICATION_ENDPOINTS.PREFERENCES, preferences);
  return response.data.preferences;
};
