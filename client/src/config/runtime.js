import { clientEnv } from './env';

const configuredApiUrl = clientEnv.apiUrl.replace(/\/$/, '');
export const API_BASE_URL = configuredApiUrl || '/api';
export const API_ORIGIN = API_BASE_URL.startsWith('http')
  ? API_BASE_URL.replace(/\/api\/?$/, '')
  : (typeof window !== 'undefined' ? window.location.origin : '');

const isLocalViteDevServer = typeof window !== 'undefined' && ['5173', '4173'].includes(window.location.port);
const fallbackSocketUrl = isLocalViteDevServer ? 'http://localhost:3000' : API_ORIGIN;
const rawSocketUrl = clientEnv.socketUrl || fallbackSocketUrl;
export const SOCKET_BASE_URL = rawSocketUrl.replace(/\/$/, '').replace(/\/api\/?$/, '');
