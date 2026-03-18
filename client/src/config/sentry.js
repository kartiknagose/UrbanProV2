import { clientEnv } from './env';

let initialized = false;
let sentryModulePromise;

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export async function initClientMonitoring() {
  if (initialized || !clientEnv.sentryDsn) {
    return null;
  }

  if (!sentryModulePromise) {
    sentryModulePromise = import('@sentry/react').then((Sentry) => {
      Sentry.init({
        dsn: clientEnv.sentryDsn,
        environment: clientEnv.appEnv,
        integrations: [Sentry.browserTracingIntegration()],
        tracesSampleRate: toNumber(clientEnv.sentryTracesSampleRate, 0.1),
        tracePropagationTargets: [clientEnv.apiUrl.replace(/\/$/, '')],
      });

      initialized = true;
      return Sentry;
    });
  }

  return sentryModulePromise;
}
