
/**
 * Request ID Middleware
 * - Generates a unique ID for every request
 * - Attaches it to req.id and X-Request-Id header
 * - Allows tracking logs back to a specific request
 */
const { randomUUID } = require('crypto');

function normalizeRequestId(raw) {
    if (typeof raw !== 'string') return null;

    const trimmed = raw.trim();
    if (!trimmed || trimmed.length > 100) return null;

    // Keep IDs log-safe and header-safe.
    if (!/^[A-Za-z0-9._:-]+$/.test(trimmed)) return null;

    return trimmed;
}

function requestIdMiddleware(req, res, next) {
    const requestId = normalizeRequestId(req.get('X-Request-Id')) || randomUUID();

    req.id = requestId;
    res.set('X-Request-Id', requestId);
    next();
}

module.exports = requestIdMiddleware;
