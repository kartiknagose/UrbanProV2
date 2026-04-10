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

const configuredOrigins = (process.env.CORS_ORIGIN || CORS_ORIGIN)
  ? (process.env.CORS_ORIGIN || CORS_ORIGIN).split(',').map((s) => s.trim()).filter(Boolean)
  : [];

const allowedOriginsSet = new Set(configuredOrigins);

const explicitFrontendUrl = String(process.env.FRONTEND_URL || '').trim();
if (explicitFrontendUrl) {
  allowedOriginsSet.add(explicitFrontendUrl);
} else if (FRONTEND_URL && NODE_ENV !== 'production') {
  // Keep localhost/dev fallback only outside production.
  allowedOriginsSet.add(FRONTEND_URL);
}

if (NODE_ENV !== 'production') {
  allowedOriginsSet.add('http://localhost:5173');
  allowedOriginsSet.add('http://localhost:5174');
}

const allowedOrigins = Array.from(allowedOriginsSet);
const hasConfiguredOrigins = allowedOrigins.length > 0;

if (NODE_ENV === 'production' && !hasConfiguredOrigins) {
  console.warn('[CORS] No origins configured in production. Allowing all origins until CORS_ORIGIN/FRONTEND_URL is set.');
}

const corsOptions = {
  origin: function (origin, callback) {
    if (!hasConfiguredOrigins) {
      callback(null, true);
      return;
    }

    if (matchesAllowedOrigin(origin, allowedOrigins)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked origin: ${origin}. Allowed: ${allowedOrigins.join(', ')}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

module.exports = {
  corsOptions,
  allowedOrigins,
  matchesAllowedOrigin,
};