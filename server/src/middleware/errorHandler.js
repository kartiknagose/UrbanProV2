/**
 * GLOBAL ERROR HANDLER MIDDLEWARE
 * Catches all errors thrown in routes/controllers.
 * Logs via Winston and returns appropriate HTTP response.
 */

const logger = require('../config/logger');
const { captureException } = require('../config/monitoring');

module.exports = (err, _req, res, _next) => {
  // Determine HTTP status code
  const rawStatus = Number(err.statusCode || err.status || 500);
  const status = Number.isInteger(rawStatus) && rawStatus >= 400 && rawStatus <= 599 ? rawStatus : 500;
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Do not expose unknown 5xx details in production responses.
  // Operational errors (AppError) are safe to show as curated user messages.
  const rawMessage = err.message || 'Internal Server Error';
  const isOperational = Boolean(err?.isOperational);
  const message = status >= 500 && !isDevelopment && !isOperational
    ? 'Internal Server Error'
    : rawMessage;

  if (status >= 500) {
    // CRASH REPORTING (Sprint 15)
    captureException(err, {
      url: _req.originalUrl,
      method: _req.method,
      id: _req.id
    });
  }

  // Log via Winston — error level for 5xx, warn for 4xx
  const logLevel = status >= 500 ? 'error' : 'warn';
  logger[logLevel]('%s %s -> %d: %s', _req.method, _req.originalUrl, status, rawMessage, {
    ...(isDevelopment && { stack: err.stack }),
  });

  // Send error response to client
  res.status(status).json({
    error: message,
    statusCode: status,
    requestId: _req.id,
    ...(isDevelopment && { stack: err.stack }),
  });
};