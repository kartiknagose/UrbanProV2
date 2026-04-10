// Upload API calls
// Handles file uploads (profile photo)

import axiosInstance from './axios';

const VERIFICATION_UPLOAD_TIMEOUT_MS = 60_000;

const UPLOAD_ENDPOINTS = {
  PROFILE_PHOTO: '/uploads/profile-photo',
  VERIFICATION_DOC: '/uploads/verification-doc',
};

/**
 * Upload profile photo
 * @param {File} file - Image file
 * @returns {Promise} Response with uploaded URL
 */
export const uploadProfilePhoto = async (file) => {
  const formData = new FormData();
  formData.append('photo', file);

  const response = await axiosInstance.post(UPLOAD_ENDPOINTS.PROFILE_PHOTO, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return response.data;
};

/**
 * Upload verification document
 * @param {File} file - Document file (image/pdf)
 * @returns {Promise} Response with uploaded URL
 */
export const uploadVerificationDocument = async (file) => {
  const formData = new FormData();
  formData.append('document', file);

  const response = await axiosInstance.post(UPLOAD_ENDPOINTS.VERIFICATION_DOC, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: VERIFICATION_UPLOAD_TIMEOUT_MS,
  });

  return response.data;
};

/**
 * Upload booking photo
 * @param {File} file - Image file
 * @param {number} bookingId - The booking ID
 * @param {string} type - 'BEFORE' or 'AFTER'
 */
export const uploadBookingPhoto = async (file, bookingId, type) => {
  const formData = new FormData();
  formData.append('photo', file);
  if (bookingId) formData.append('bookingId', bookingId);
  if (type) formData.append('type', type);

  const response = await axiosInstance.post('/uploads/booking-photo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return response.data;
};

/**
 * Upload chat attachment
 * @param {File} file - Image or Document file
 */
export const uploadChatAttachment = async (file) => {
  const formData = new FormData();
  formData.append('attachment', file);

  const response = await axiosInstance.post('/uploads/chat-attachment', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return response.data;
};
