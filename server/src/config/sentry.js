const Sentry = require('@sentry/node');
const { SENTRY_DSN, SENTRY_ENVIRONMENT, SENTRY_TRACES_SAMPLE_RATE } = require('./env');

let initialized = false;

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function initServerMonitoring() {
  if (initialized || !SENTRY_DSN) {
    return Sentry;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    tracesSampleRate: clamp(toNumber(SENTRY_TRACES_SAMPLE_RATE, 0.1), 0, 1),
  });

  initialized = true;
  return Sentry;
}

module.exports = { initServerMonitoring, Sentry };
