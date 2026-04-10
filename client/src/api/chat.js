// Chat API calls
// Handles conversations, messages, and booking-based chat

import axiosInstance from './axios';
import { normalizeQueryInput } from './queryContext';

// Chat API endpoints
const CHAT_ENDPOINTS = {
  CONVERSATIONS: '/chat/conversations',
  BY_BOOKING: (bookingId) => `/chat/booking/${bookingId}`,
  MESSAGES: (conversationId) => `/chat/${conversationId}/messages`,
};

/**
 * Get all conversations for current user (paginated)
 * @param {Object} [params] - Optional pagination params { page, limit }
 * @returns {Promise<{ conversations, pagination }>}
 */
export const getUserConversations = async (params) => {
  const normalized = normalizeQueryInput(params);
  const response = await axiosInstance.get(CHAT_ENDPOINTS.CONVERSATIONS, {
    params: normalized.params,
    signal: normalized.signal,
  });
  return response.data;
};

/**
 * Get or create a conversation for a specific booking
 * @param {number} bookingId - Booking ID
 * @returns {Promise<{ conversation }>}
 */
export const getConversationByBooking = async (bookingId) => {
  const response = await axiosInstance.get(CHAT_ENDPOINTS.BY_BOOKING(bookingId));
  return response.data;
};

/**
 * Get messages for a conversation (paginated)
 * @param {number} conversationId - Conversation ID
 * @param {Object} [params] - Optional pagination params { page, limit }
 * @returns {Promise<{ messages, pagination }>}
 */
export const getMessages = async (conversationId, params) => {
  const response = await axiosInstance.get(CHAT_ENDPOINTS.MESSAGES(conversationId), { params });
  return response.data;
};

/**
 * Send a message in a conversation
 * @param {Object} data
 */
export const sendMessage = async ({ conversationId, ...payload }) => {
  const response = await axiosInstance.post(CHAT_ENDPOINTS.MESSAGES(conversationId), payload);
  return response.data;
};
