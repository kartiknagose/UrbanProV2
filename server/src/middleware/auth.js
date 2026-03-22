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

module.exports = (req, res, next) => {
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

  // Attach the authenticated user's payload to the request so downstream
  // handlers and authorization middleware can reference `req.user`.
  req.user = payload; // e.g., { id, role }
  next();
};