import axiosInstance from './axios';

const VERIFICATION_REQUEST_TIMEOUT_MS = 60_000;

const VERIFICATION_ENDPOINTS = {
  ME: '/verification/me',
  APPLY: '/verification/apply',
  ADMIN_LIST: '/admin/verification',
  ADMIN_REVIEW: (id) => `/admin/verification/${id}`,
};

export const getMyVerification = async () => {
  const response = await axiosInstance.get(VERIFICATION_ENDPOINTS.ME);
  return response.data;
};

export const applyForVerification = async (data) => {
  const response = await axiosInstance.post(VERIFICATION_ENDPOINTS.APPLY, data, {
    timeout: VERIFICATION_REQUEST_TIMEOUT_MS,
  });
  return response.data;
};

export const getVerificationApplications = async () => {
  const response = await axiosInstance.get(VERIFICATION_ENDPOINTS.ADMIN_LIST);
  return response.data;
};

export const reviewVerificationApplication = async (applicationId, data) => {
  const response = await axiosInstance.patch(VERIFICATION_ENDPOINTS.ADMIN_REVIEW(applicationId), data);
  return response.data;
};
