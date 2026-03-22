const promClient = require('prom-client');
const logger = require('./logger');
const { initServerMonitoring, Sentry } = require('./sentry');

initServerMonitoring();

/**
 * Platform Monitoring (Sprint 15)
 * - Metrics registry
 * - Request duration histogram
 * - Error rate counter
 * - DB query timing (mock for this script)
 */
const register = new promClient.Registry();

function normalizeRouteLabel(req) {
    if (req.route?.path) {
        return req.baseUrl ? `${req.baseUrl}${req.route.path}` : req.route.path;
    }

    const source = String(req.path || req.originalUrl || '/').split('?')[0];
    return source
        .replace(/\b\d+\b/g, ':id')
        .replace(/[0-9a-f]{8}-[0-9a-f-]{27,36}/gi, ':id')
        .slice(0, 120);
}

// Standard default metrics (CPU, RAM, GC etc)
promClient.collectDefaultMetrics({ register });

// Custom Histogram for Request Duration
const httpRequestDurationMicroseconds = new promClient.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10], // seconds
});

register.registerMetric(httpRequestDurationMicroseconds);

// Custom Counter for HTTP Errors
const httpErrorsCounter = new promClient.Counter({
    name: 'http_errors_total',
    help: 'Total number of HTTP 4xx/5xx errors',
    labelNames: ['method', 'route', 'status_code'],
});

register.registerMetric(httpErrorsCounter);

/**
 * Middleware to record metrics
 */
const metricsMiddleware = (req, res, next) => {
    const start = process.hrtime();

    res.on('finish', () => {
        const [seconds, nanoseconds] = process.hrtime(start);
        const duration = seconds + nanoseconds / 1e9;

        // Use normalized route label to avoid high-cardinality metrics.
        const path = normalizeRouteLabel(req);

        httpRequestDurationMicroseconds
            .labels(req.method, path, res.statusCode)
            .observe(duration);

        if (res.statusCode >= 400) {
            httpErrorsCounter
                .labels(req.method, path, res.statusCode)
                .inc();
        }
    });
    next();
};

/**
 * Capture exceptions for monitoring and Sentry forwarding.
 */
const captureException = (error, context = {}) => {
    logger.error(`[CRASH_REPORT] ${error.message}`, {
        stack: error.stack,
        ...context,
        timestamp: new Date().toISOString()
    });

    if (Sentry?.captureException) {
        Sentry.captureException(error, {
            extra: context,
        });
    }
};

module.exports = {
    register,
    metricsMiddleware,
    captureException
};
