// server/src/index.js
// Entrypoint for the Express API server.
// Responsibilities:
// - Configure global middleware (security, parsing, logging, i18n)
// - Mount API route modules under `/api/*`
// - Serve uploaded files from the `uploads` folder
// - Export the `app` for use by tests or a separate HTTP server bootstrap

// ── External dependencies ──
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const compression = require('compression');

// ── Config ──
const { PORT, CORS_ORIGIN } = require('./config/env');
const { corsOptions } = require('./config/cors');
const i18n = require('./config/i18n');
const logger = require('./config/logger');
const prisma = require('./config/prisma');
const redis = require('./config/redis');
const { register, metricsMiddleware } = require('./config/monitoring');
const { globalLimiter } = require('./config/rateLimit');

// ── Middleware ──
const requestIdMiddleware = require('./middleware/requestId');
const timeoutMiddleware = require('./middleware/timeout');
const apiResponseMiddleware = require('./middleware/apiResponse');
const notFoundHandler = require('./middleware/notFoundHandler');
const errorHandler = require('./middleware/errorHandler');

// ── Route modules ──
const authRoutes = require('./modules/auth/auth.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const availabilityRoutes = require('./modules/availability/availability.routes');
const bookingRoutes = require('./modules/bookings/booking.routes');
const chatRoutes = require('./modules/chat/chat.routes');
const customerRoutes = require('./modules/customers/customer.routes');
const locationRoutes = require('./modules/location/location.routes');
const notificationRoutes = require('./modules/notifications/notification.routes');
const paymentRoutes = require('./modules/payments/payment.routes');
const paymentAdminRoutes = require('./modules/payments/payment.admin.routes');
const reviewRoutes = require('./modules/reviews/review.routes');
const safetyRoutes = require('./modules/safety/safety.routes');
const serviceRoutes = require('./modules/services/service.routes');
const uploadRoutes = require('./modules/uploads/upload.routes');
const verificationRoutes = require('./modules/verification/verification.routes');
const verificationAdminRoutes = require('./modules/verification/verification.admin.routes');
const workerRoutes = require('./modules/workers/worker.routes');
const growthRoutes = require('./modules/business_growth/growth.routes'); // Referrals, Wallet, Coupons
const payoutRoutes = require('./modules/payouts/payout.routes');
const invoiceRoutes = require('./modules/invoices/invoice.routes');
const analyticsRoutes = require('./modules/analytics/analytics.routes');
const aiRoutes = require('./modules/ai/ai.routes');
const { verifySmtpConnection, isResendConfigured, isSendGridConfigured, sendVerificationEmail } = require('./common/utils/mailer');

// Create Express application instance
const app = express();
app.set('etag', 'strong');

// Required behind Render/Nginx/CDN so req.ip, secure cookies and rate-limit behave correctly.
const parseTrustProxy = (value) => {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return null;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  const numeric = Number(raw);
  if (Number.isInteger(numeric) && numeric >= 0) return numeric;
  return value;
};

if (process.env.NODE_ENV === 'production') {
  const configuredTrustProxy = parseTrustProxy(process.env.TRUST_PROXY);
  app.set('trust proxy', configuredTrustProxy ?? 1);
}

// Security & parsing
// Apply middleware in a clear order:
// 1) Security headers (helmet)
// 2) CORS policy (configured in `config/cors.js`)
// 3) Request logging (morgan)
// 4) JSON body parsing with a modest size limit
// 5) Cookie parsing
// 6) Internationalization middleware that sets `req.locale`
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(cors(corsOptions));
app.use(compression());
app.use(globalLimiter);
app.use(morgan('dev', { stream: { write: (msg) => logger.info(msg.trim()) } }));
app.use(
  express.json({
    limit: '1mb',
    verify: (req, _res, buf) => {
      if (/^\/api(?:\/v1)?\/payments\/webhook(?:$|\?)/.test(String(req.originalUrl || ''))) {
        req.rawBody = buf.toString('utf8');
      }
    },
  })
);
app.use(cookieParser());
app.use(requestIdMiddleware);
app.use(apiResponseMiddleware);
app.use(timeoutMiddleware(30000));
app.use(metricsMiddleware); // PROMETHEUS METRICS (Sprint 15)
app.use(i18n);

// Performance / Monitoring Middleware (Standard for Sprint 15)
app.use((req, res, next) => {
  const start = process.hrtime();
  res.on('finish', () => {
    const [sec, nanosec] = process.hrtime(start);
    const durationMs = (sec * 1000 + nanosec / 1e6).toFixed(2);
    const logData = {
      id: req.id,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${durationMs}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent')
    };

    if (res.statusCode >= 500) {
      logger.error(`HTTP request failed: ${req.method} ${req.originalUrl}`, logData);
    } else if (res.statusCode >= 400) {
      logger.warn(`HTTP request failed: ${req.method} ${req.originalUrl}`, logData);
    } else {
      logger.info(`HTTP request completed: ${req.method} ${req.originalUrl}`, logData);
    }
  });
  next();
});

const authenticate = require('./middleware/auth');

// Serve user-uploaded files at the `/uploads` path.
// Files are stored under `server/src/uploads/*` by the upload handlers.
// Split per subdirectory so sensitive files require authentication.

// Profile photos — public (displayed on service pages, profiles, messages)
app.use('/uploads/profile-photos', express.static(path.resolve(__dirname, 'uploads/profile-photos')));

// Verification docs — authenticated (government IDs, personal documents)
app.use('/uploads/verification-docs', authenticate, express.static(path.resolve(__dirname, 'uploads/verification-docs')));

// Booking photos — authenticated (private booking evidence)
app.use('/uploads/booking-photos', authenticate, express.static(path.resolve(__dirname, 'uploads/booking-photos')));

// Chat attachments — authenticated (private chat media)
app.use('/uploads/chat-attachments', authenticate, express.static(path.resolve(__dirname, 'uploads/chat-attachments')));

// Health check
// Simple healthcheck used by monitoring or manual smoke tests.
app.get('/health', async (req, res) => {
  const checks = {};

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: 'ok' };
  } catch (err) {
    checks.database = { status: 'error', message: err.message };
  }

  try {
    if (typeof redis?.ping === 'function') {
      await redis.ping();
      checks.redis = { status: 'ok' };
    } else {
      checks.redis = { status: 'disabled' };
    }
  } catch (err) {
    checks.redis = { status: 'error', message: err.message };
  }

  const hasError = Object.values(checks).some((item) => item.status === 'error');
  const payload = {
    status: hasError ? 'degraded' : 'healthy',
    timestamp: new Date().toISOString(),
    id: req.id,
    checks,
  };

  if (process.env.NODE_ENV !== 'production') {
    payload.uptime = process.uptime();
    payload.memory = process.memoryUsage();
    payload.node = process.version;
  }

  res.status(hasError ? 503 : 200).json(payload);
});

// SMTP health probe (safe diagnostics for production)
// Requires x-email-health-token header in production when EMAIL_HEALTH_TOKEN is set.
app.get('/health/email', async (req, res) => {
  const normalizeToken = (value) => String(value || '').trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
  const configuredToken = normalizeToken(process.env.EMAIL_HEALTH_TOKEN);
  const providedToken = normalizeToken(req.get('x-email-health-token') || req.query.token || '');
  const publicProbeEnabled = String(process.env.EMAIL_HEALTH_PROBE_PUBLIC || '').toLowerCase() === 'true';
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction && !publicProbeEnabled && configuredToken && providedToken !== configuredToken) {
    return res.status(403).json({ ok: false, message: 'Forbidden' });
  }

  const result = await verifySmtpConnection();
  const fallbackConfigured = isResendConfigured();
  const sendGridConfigured = isSendGridConfigured();
  const deliveryReady = result.ok || fallbackConfigured || sendGridConfigured;
  const status = deliveryReady ? 200 : 503;
  return res.status(status).json({
    ok: deliveryReady,
    smtp: {
      ok: result.ok,
    },
    resend: {
      configured: fallbackConfigured,
    },
    sendgrid: {
      configured: sendGridConfigured,
    },
    details: result.ok ? undefined : {
      code: result.code,
      message: result.message,
      response: result.response,
      reason: result.reason,
    },
  });
});

// Sends a real test verification email (for production diagnostics).
// Requires x-email-health-token when EMAIL_HEALTH_TOKEN is configured in production,
// unless EMAIL_HEALTH_PROBE_PUBLIC=true.
app.post('/health/email/send-test', async (req, res) => {
  const normalizeToken = (value) => String(value || '').trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
  const configuredToken = normalizeToken(process.env.EMAIL_HEALTH_TOKEN);
  const providedToken = normalizeToken(req.get('x-email-health-token') || req.query.token || '');
  const isProduction = process.env.NODE_ENV === 'production';

  // Never allow unauthenticated send-test access in production.
  if (isProduction && (!configuredToken || providedToken !== configuredToken)) {
    return res.status(403).json({ ok: false, message: 'Forbidden' });
  }

  const to = String(req.body?.to || req.query?.to || '').trim();
  if (!to || !to.includes('@')) {
    return res.status(400).json({ ok: false, message: 'Provide a valid recipient email in body.to or query ?to=' });
  }

  try {
    const frontendBaseUrl = String(process.env.FRONTEND_URL || req.get('origin') || '').trim().replace(/\/+$/, '');
    if (process.env.NODE_ENV === 'production' && !frontendBaseUrl) {
      return res.status(500).json({ ok: false, message: 'FRONTEND_URL is required in production for email test links.' });
    }

    await sendVerificationEmail({
      to,
      link: `${frontendBaseUrl || 'http://localhost:5173'}/verify-email?token=test-health-token`,
    });
    return res.status(200).json({ ok: true, message: 'Test verification email sent' });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      message: error.message,
      code: error.code,
      status: error?.response?.status,
      details: error?.response?.data,
    });
  }
});

// METRICS ENDPOINT (Sprint 15 - For Grafana / Prometheus)
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err);
  }
});

// API routes
// Mount modularized route handlers under `/api/*`.
// Each route module keeps its own validation and controller logic.
const registerCacheRoutes = require('./modules/cache');

function mountApiRoutes(basePath) {
  registerCacheRoutes(app, basePath);
  app.use(`${basePath}/auth`, authRoutes);
  app.use(`${basePath}/workers`, workerRoutes);
  app.use(`${basePath}/services`, serviceRoutes);
  app.use(`${basePath}/bookings`, bookingRoutes);
  app.use(`${basePath}/customers`, customerRoutes);
  app.use(`${basePath}/uploads`, uploadRoutes);
  app.use(`${basePath}/availability`, availabilityRoutes);
  app.use(`${basePath}/reviews`, reviewRoutes);
  app.use(`${basePath}/verification`, verificationRoutes);
  app.use(`${basePath}/admin/verification`, verificationAdminRoutes);
  app.use(`${basePath}/admin/payments`, paymentAdminRoutes);
  app.use(`${basePath}/admin`, adminRoutes);
  app.use(`${basePath}/payments`, paymentRoutes);
  app.use(`${basePath}/safety`, safetyRoutes);
  app.use(`${basePath}/location`, locationRoutes);
  app.use(`${basePath}/notifications`, notificationRoutes);
  app.use(`${basePath}/chat`, chatRoutes);
  app.use(`${basePath}/growth`, growthRoutes);
  app.use(`${basePath}/payouts`, payoutRoutes);
  app.use(`${basePath}/invoices`, invoiceRoutes);
  app.use(`${basePath}/analytics`, analyticsRoutes);
  app.use(`${basePath}/ai`, aiRoutes);
}

mountApiRoutes('/api');
mountApiRoutes('/api/v1');

// 404 and error handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Start server only if run directly
// When this file is run directly (node src/index.js), start the HTTP server.
// When required (e.g., in tests), we only export the `app` instance so tests can
// mount it on an in-memory server or a test runner.
if (require.main === module) {
  // Create a raw HTTP server so we can attach Socket.IO to the same server.
  const http = require('http');
  const server = http.createServer(app);

  // Initialize Socket.IO (optional - only when running the server directly)
  try {
    const { init } = require('./socket');
    init(server);
    logger.info('Socket.IO initialized');
  } catch (_err) {
    logger.warn('Socket.IO not initialized: %s', _err.message);
  }

  // Initialize Background Jobs
  try {
    const { initCronJobs } = require('./cron');
    initCronJobs();
  } catch (err) {
    logger.warn('Cron jobs not initialized: %s', err.message);
  }

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.error('Port %d is already in use. Kill the other process or use a different port.', PORT);
      process.exit(1);
    }
    throw err;
  });

  server.listen(PORT, () => {
    logger.info(`Server listening on http://localhost:${PORT}`);
    logger.info(`CORS origin: ${CORS_ORIGIN}`);

    // Proactive SMTP diagnostics on boot (so Render logs always show SMTP state)
    console.log('[SMTP] Preflight starting...');
    verifySmtpConnection()
      .then(async (smtp) => {
        // guard against any pending internal verify callback behavior
        return smtp;
      })
      .then((smtp) => {
        if (smtp.ok) {
          console.log('[SMTP] Preflight connected');
          logger.info('SMTP preflight: connected');
        } else if (smtp.reason === 'SMTP transport not configured' && (isResendConfigured() || isSendGridConfigured())) {
          console.log('[SMTP] Preflight: SMTP disabled, fallback provider configured');
          logger.info('SMTP preflight: SMTP disabled, fallback provider configured');
        } else {
          console.error('[SMTP] Preflight failed:', smtp);
          logger.error('SMTP preflight: failed', {
            code: smtp.code,
            message: smtp.message,
            response: smtp.response,
            reason: smtp.reason,
          });
        }
      })
      .catch((err) => {
        console.error('[SMTP] Preflight unexpected error:', err?.message || err);
        logger.error('SMTP preflight: unexpected error', { message: err.message });
      });

    // Hard timeout log to catch any silent hangs.
    setTimeout(() => {
      console.log('[SMTP] Preflight timeout guard reached (if no result above, SMTP verify may be blocked).');
    }, 12000);
  });

  // Graceful shutdown — close HTTP server, disconnect Prisma, close Socket.IO
  const shutdown = async (signal) => {
    logger.info('%s received. Shutting down gracefully...', signal);
    server.close(async () => {
      try {
        await prisma.$disconnect();
        logger.info('Prisma disconnected');
      } catch (err) {
        logger.error('Error disconnecting Prisma: %s', err.message);
      }
      process.exit(0);
    });
    // Force exit after 10s if graceful shutdown hangs
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

module.exports = app;