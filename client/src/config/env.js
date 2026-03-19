const parseInjectedEnv = (value) => {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_error) {
    return {};
  }
};

const injectedEnv = parseInjectedEnv(import.meta.env.VITE_ENV);

const readEnv = (key, fallback = '') => {
  const value = injectedEnv[key] ?? import.meta.env[key] ?? fallback;
  return typeof value === 'string' ? value : fallback;
};

const readNumberEnv = (key, fallback) => {
  const parsed = Number(readEnv(key, String(fallback)));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const clientEnv = Object.freeze({
  apiUrl: readEnv('VITE_API_URL', 'http://localhost:3000/api'),
  apiTimeoutMs: readNumberEnv(
    'VITE_API_TIMEOUT_MS',
    (import.meta.env.MODE || 'development') === 'production' ? 45000 : 15000
  ),
  socketUrl: readEnv('VITE_SOCKET_URL', ''),
  razorpayKeyId: readEnv('VITE_RAZORPAY_KEY_ID', ''),
  googlePlacesApiKey: readEnv('VITE_GOOGLE_PLACES_API_KEY', ''),
  sentryDsn: readEnv('VITE_SENTRY_DSN', ''),
  sentryTracesSampleRate: readEnv('VITE_SENTRY_TRACES_SAMPLE_RATE', '0.1'),
  supabaseUrl: readEnv('VITE_SUPABASE_URL', ''),
  supabaseAnonKey: readEnv('VITE_SUPABASE_ANON_KEY', ''),
  supabaseFunctionsUrl: readEnv('VITE_SUPABASE_FUNCTIONS_URL', ''),
  appEnv: readEnv('VITE_APP_ENV', import.meta.env.MODE || 'development'),
});
