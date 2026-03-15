// Shared runtime URL helpers for API and Socket.IO endpoints.

const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const API_BASE_URL = rawApiUrl.replace(/\/$/, '');
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

const rawSocketUrl = import.meta.env.VITE_SOCKET_URL || API_ORIGIN;
export const SOCKET_BASE_URL = rawSocketUrl.replace(/\/$/, '').replace(/\/api\/?$/, '');
