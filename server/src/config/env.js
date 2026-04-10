const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const loadEnvironment = () => {
    const nodeEnv = process.env.NODE_ENV || 'development';
    const serverRoot = path.resolve(__dirname, '../..');

    // Keep shell/platform-provided variables (Render, CI, etc.) as highest priority.
    const externallyDefinedKeys = new Set(Object.keys(process.env));
    const envFileOrder = [
        '.env',
        `.env.${nodeEnv}`,
        '.env.local',
        `.env.${nodeEnv}.local`,
    ];

    for (const fileName of envFileOrder) {
        const filePath = path.join(serverRoot, fileName);
        if (!fs.existsSync(filePath)) continue;

        const parsed = dotenv.parse(fs.readFileSync(filePath));
        for (const [key, value] of Object.entries(parsed)) {
            if (externallyDefinedKeys.has(key)) continue;
            process.env[key] = value;
        }
    }
};

loadEnvironment();

const toNumber = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = clamp(Math.trunc(toNumber(process.env.PORT, 3000)), 1, 65535);
const isProduction = NODE_ENV === 'production';

const JWT_SECRET = process.env.JWT_SECRET || (NODE_ENV === 'development' ? 'dev_only_secret_do_not_use_in_production' : undefined);

if (!JWT_SECRET) {
    console.error('FATAL: JWT_SECRET environment variable is not set.');
    process.exit(1);
}

const CORS_ORIGIN = process.env.CORS_ORIGIN || (isProduction ? '' : 'http://localhost:5173');

const FRONTEND_URL = process.env.FRONTEND_URL
    || (CORS_ORIGIN.includes(',') ? CORS_ORIGIN.split(',')[0].trim() : CORS_ORIGIN)
    || (isProduction ? '' : 'http://localhost:5173');

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
