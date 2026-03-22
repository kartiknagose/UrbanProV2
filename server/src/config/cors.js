const { CORS_ORIGIN, NODE_ENV, FRONTEND_URL } = require('./env');

const normalizeOrigin = (value) => {
  if (!value || typeof value !== 'string') return '';
  return value.trim().replace(/\/+$/, '');
};

const wildcardToRegex = (pattern) => {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');

  return new RegExp(`^${escaped}$`);
};

const matchesAllowedOrigin = (origin, allowedOrigins) => {
  if (!origin) return true;

  const normalizedOrigin = normalizeOrigin(origin);

  return allowedOrigins.some((allowedOrigin) => {
    if (!allowedOrigin) return false;

    if (allowedOrigin.includes('*')) {
      return wildcardToRegex(allowedOrigin).test(normalizedOrigin);
    }

    return normalizeOrigin(allowedOrigin) === normalizedOrigin;
  });
};

const configuredOrigins = CORS_ORIGIN
  ? CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean)
  : [];

const allowedOriginsSet = new Set(configuredOrigins);

if (FRONTEND_URL) {
  allowedOriginsSet.add(FRONTEND_URL);
}

if (NODE_ENV !== 'production') {
  // Preview wildcard is limited to non-production to avoid over-broad credentialed CORS in prod.
  allowedOriginsSet.add('https://*.vercel.app');
  allowedOriginsSet.add('http://localhost:5173');
  allowedOriginsSet.add('http://localhost:5174');
}

const allowedOrigins = Array.from(allowedOriginsSet);

const corsOptions = {
  origin: function (origin, callback) {
    if (matchesAllowedOrigin(origin, allowedOrigins)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked origin: ${origin}. Allowed: ${allowedOrigins.join(', ')}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

module.exports = { corsOptions };