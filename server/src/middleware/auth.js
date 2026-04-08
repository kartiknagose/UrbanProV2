// Authentication middleware
// Verifies a JWT stored in an HTTP-only cookie and attaches the decoded
// payload to `req.user`. This middleware is intended to be used on routes
// that require a logged-in user.
//
// Notes:
// - Tokens are expected in `req.cookies.token`. If you prefer Authorization
//   headers (Bearer tokens) adapt callers and this middleware accordingly.
// - `verifyJwt` should return the decoded payload (e.g., { id, role }) or
//   null/false if verification fails.
const { verifyJwt } = require('../common/utils/jwt');
const { getTokenVersion } = require('../common/utils/tokenVersion');
const prisma = require('../config/prisma');

module.exports = async (req, res, next) => {
  const cookieToken = req.cookies?.token;
  const authHeader = req.get('authorization') || '';
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const bearerToken = bearerMatch ? bearerMatch[1].trim() : '';
  const token = cookieToken || bearerToken;

  if (!token) return res.status(401).json({ error: 'Authentication required', statusCode: 401 });

  const payload = verifyJwt(token);
  if (!payload || !payload.id || !payload.role) {
    return res.status(401).json({ error: 'Invalid or expired token', statusCode: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { isActive: true, deletedAt: true },
    });

    if (!user || user.deletedAt || !user.isActive) {
      return res.status(401).json({ error: 'Account unavailable', statusCode: 401 });
    }

    const currentVersion = await getTokenVersion(payload.id);
    const tokenVersion = Number.isInteger(Number(payload.tv)) ? Number(payload.tv) : 0;

    if (tokenVersion !== currentVersion) {
      return res.status(401).json({ error: 'Session expired. Please log in again.', statusCode: 401 });
    }
  } catch (_error) {
    return res.status(503).json({ error: 'Authentication service unavailable', statusCode: 503 });
  }

  // Attach the authenticated user's payload to the request so downstream
  // handlers and authorization middleware can reference `req.user`.
  req.user = payload; // e.g., { id, role }
  next();
};