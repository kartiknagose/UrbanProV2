// server/src/config/env.js
// Loads environment variables and centralizes configuration values for the server.
// IMPORTANT: Keep secrets (JWT_SECRET, DB URL, etc.) in environment variables
// and never commit them to source control. For local development we provide
// safe fallbacks, but those fallbacks MUST NOT be used in production.
const dotenv = require('dotenv');
dotenv.config();

const toNumber = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = clamp(Math.trunc(toNumber(process.env.PORT, 3000)), 1, 65535);

// SECURITY: `JWT_SECRET` must be set via an environment variable in production.
// A dev-only fallback is provided for local development convenience. If you
// deploy to a hosted environment (Heroku, Vercel, Azure, etc.) set the
// secret in the platform's secret manager or environment setting.
const JWT_SECRET = process.env.JWT_SECRET || (NODE_ENV === 'development' ? 'dev_only_secret_do_not_use_in_production' : undefined);

if (!JWT_SECRET) {
    console.error('FATAL: JWT_SECRET environment variable is not set. Server cannot start in production without it.');
    process.exit(1);
}

// CORS_ORIGIN: Validate in production
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

if (NODE_ENV === 'production' && CORS_ORIGIN === 'http://localhost:5173') {
    console.warn('WARNING: CORS_ORIGIN is set to localhost in production. This is likely a misconfiguration.');
}

// FRONTEND_URL: Used for constructing email links (verification, password reset).
// Falls back to the first CORS origin if not explicitly set.
const FRONTEND_URL = process.env.FRONTEND_URL
    || (CORS_ORIGIN.includes(',') ? CORS_ORIGIN.split(',')[0].trim() : CORS_ORIGIN)
    || 'http://localhost:5173';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const CACHE_RELAY_SECRET = process.env.CACHE_RELAY_SECRET || '';
const SENTRY_DSN = process.env.SENTRY_DSN || '';
const SENTRY_ENVIRONMENT = process.env.SENTRY_ENVIRONMENT || NODE_ENV;
const SENTRY_TRACES_SAMPLE_RATE = String(clamp(toNumber(process.env.SENTRY_TRACES_SAMPLE_RATE, 0.1), 0, 1));

module.exports = {
    PORT,
    JWT_SECRET,
    CORS_ORIGIN,
    NODE_ENV,
    FRONTEND_URL,
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY,
    CACHE_RELAY_SECRET,
    SENTRY_DSN,
    SENTRY_ENVIRONMENT,
    SENTRY_TRACES_SAMPLE_RATE,
};
