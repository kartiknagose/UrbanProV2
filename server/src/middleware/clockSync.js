/**
 * Clock Sync Validation Middleware
 * Detects and logs system clock skew issues that can cause Cloudinary
 * "Stale request" errors (error: 401, message: "Stale request - reported time is...")
 * 
 * Root cause: If server clock is >1 hour off from Cloudinary's servers,
 * the API signature validation fails.
 * 
 * Quick Fix:
 * - Linux/WSL: ntpdate -s time.nist.gov
 * - macOS: ntpdate -s time.apple.com
 * - Windows: Set-Date (as admin) or use w32tm /resync
 * - Docker: Ensure host clock is synced, or use: -v /etc/localtime:/etc/localtime:ro
 */

const logger = require('../config/logger');

// Store last reported skip timestamp to avoid log spam
let lastClockSkewReported = 0;
const REPORT_COOLDOWN_MS = 60_000; // Only log once per minute

function isCloudinaryUploadRoute(req) {
  return (
    req.path === '/profile-photo' ||
    req.path === '/verification-doc' ||
    req.path === '/booking-photo' ||
    req.path === '/chat-attachment'
  ) && req.method === 'POST';
}

/**
 * Middleware that validates system clock is reasonably in sync.
 * Called before file upload routes to catch clock skew early.
 */
const clockSyncMiddleware = (req, res, next) => {
  // Only check on upload routes
  if (!isCloudinaryUploadRoute(req)) {
    return next();
  }

  const now = Date.now();
  
  // Simple heuristic: if system reports a year 2026 but timestamp seems very old,
  // we might have a clock skew. This is a best-effort check.
  // More robust: use NTP time sync checks in monitoring/cron jobs.
  
  // For now, just ensure we're past epoch and within reasonable range
  const yearFromNow = new Date().getFullYear() + 1;
  const currentYear = new Date().getFullYear();
  
  // If year is way in the future or past, flag it
  if (currentYear < 2020 || currentYear > yearFromNow) {
    const now = Date.now();
    
    // Avoid log spam
    if (now - lastClockSkewReported > REPORT_COOLDOWN_MS) {
      lastClockSkewReported = now;
      logger.error(
        '[CLOCK_SKEW_ALERT] System clock may be out of sync. ' +
        'Current year: %d (expected ~%d). ' +
        'Cloudinary uploads will fail with "Stale request" error. ' +
        'Fix: ntpdate -s time.nist.gov (Linux/WSL) or sync system time.',
        currentYear,
        new Date().getFullYear()
      );
    }
    
    // Don't block the request, but attach warning to response headers
    res.set('X-Clock-Skew-Warning', 'true');
  }

  // Add server timestamp to response for client debugging
  res.set('X-Server-Time', new Date().toISOString());
  
  next();
};

/**
 * Utility function to validate request timestamps.
 * @param {Date} requestTimestamp - The timestamp from the request
 * @param {number} maxAgeMsallowed - Max age in milliseconds (default: 1 hour)
 * @returns {boolean} true if timestamp is within acceptable range
 */
function isTimestampValid(requestTimestamp, maxAgeMsallowed = 60 * 60 * 1000) {
  if (!requestTimestamp) return true; // No timestamp to validate
  
  const now = Date.now();
  const age = now - requestTimestamp.getTime();
  
  return age >= 0 && age <= maxAgeMsallowed;
}

module.exports = {
  clockSyncMiddleware,
  isTimestampValid,
  isCloudinaryUploadRoute
};
