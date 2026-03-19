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

const corsOptions = {
  origin: function (origin, callback) {
    // Split comma-separated CORS_ORIGIN into individual origins.
    // e.g. "https://app.vercel.app,http://localhost:5173" → ["https://app.vercel.app", "http://localhost:5173"]
    const allowedOrigins = CORS_ORIGIN
      ? CORS_ORIGIN.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    // Also allow the explicit FRONTEND_URL if configured
    if (FRONTEND_URL && !allowedOrigins.includes(FRONTEND_URL)) {
      allowedOrigins.push(FRONTEND_URL);
    }

    // Allow Vercel subdomains to support production + preview deployments.
    if (!allowedOrigins.includes('https://*.vercel.app')) {
      allowedOrigins.push('https://*.vercel.app');
    }

    // Only allow localhost origins in development
    if (NODE_ENV !== 'production') {
      if (!allowedOrigins.includes('http://localhost:5173')) allowedOrigins.push('http://localhost:5173');
      if (!allowedOrigins.includes('http://localhost:5174')) allowedOrigins.push('http://localhost:5174');
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

module.exports = { corsOptions };