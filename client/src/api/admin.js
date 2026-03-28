import axiosInstance from './axios';

const ADMIN_ENDPOINTS = {
  DASHBOARD: '/admin/dashboard',
  USERS: '/admin/users',
  WORKERS: '/admin/workers',
  AI_AUDITS: '/admin/ai-audits',
  AI_AUDITS_SUMMARY: '/admin/ai-audits/summary',
  USER_STATUS: (id) => `/admin/users/${id}/status`,
  USER_DELETE: (id) => `/admin/users/${id}`,
  ANALYTICS: '/analytics/summary',
  FRAUD_ALERTS: '/admin/fraud-alerts',
};

export const getAiAuditSummary = async () => {
  const response = await axiosInstance.get(ADMIN_ENDPOINTS.AI_AUDITS_SUMMARY);
  return response.data;
};

export const getAiAudits = async (params) => {
  const response = await axiosInstance.get(ADMIN_ENDPOINTS.AI_AUDITS, { params });
  return response.data;
};

export const getFraudAlerts = async () => {
  const response = await axiosInstance.get(ADMIN_ENDPOINTS.FRAUD_ALERTS);
  return response.data;
};

export const getAnalyticsSummary = async () => {
  const response = await axiosInstance.get(ADMIN_ENDPOINTS.ANALYTICS);
  return response.data;
};

export const getAdminDashboard = async () => {
  const response = await axiosInstance.get(ADMIN_ENDPOINTS.DASHBOARD);
  return response.data;
};

export const getAdminUsers = async (role) => {
  const params = role ? { role } : undefined;
  const response = await axiosInstance.get(ADMIN_ENDPOINTS.USERS, { params });
  return response.data;
};

export const getAdminWorkers = async () => {
  const response = await axiosInstance.get(ADMIN_ENDPOINTS.WORKERS);
  return response.data;
};

export const updateUserStatus = async (id, isActive) => {
  const response = await axiosInstance.patch(ADMIN_ENDPOINTS.USER_STATUS(id), { isActive });
  return response.data;
};

export const deleteUser = async (id) => {
  const response = await axiosInstance.delete(ADMIN_ENDPOINTS.USER_DELETE(id));
  return response.data;
};

export const exportGSTR1 = async (month, year) => {
  const response = await axiosInstance.get('/invoices/gstr1', {
    params: { month, year },
    responseType: 'blob'
  });

  const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `GSTR1_Export_${month}_${year}.csv`);
  document.body.appendChild(link);
  link.click();
  link.parentNode.removeChild(link);
  window.URL.revokeObjectURL(url);
};
