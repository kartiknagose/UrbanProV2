// Shared runtime URL helpers for API and Socket.IO endpoints.

import { clientEnv } from './env';

export const API_BASE_URL = clientEnv.apiUrl.replace(/\/$/, '');
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

const rawSocketUrl = clientEnv.socketUrl || API_ORIGIN;
export const SOCKET_BASE_URL = rawSocketUrl.replace(/\/$/, '').replace(/\/api\/?$/, '');
