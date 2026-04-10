const redis = require('../../config/redis');

const getKey = (userId) => `auth:token-version:${Number(userId)}`;

async function getTokenVersion(userId) {
  try {
    const raw = await redis.get(getKey(userId));
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
  } catch (_err) {
    // Fail closed when Redis is unavailable so stale tokens cannot silently pass.
    return -1;
  }
}

async function incrementTokenVersion(userId) {
  const key = getKey(userId);

  if (typeof redis.incr === 'function') {
    try {
      const next = await redis.incr(key);
      return Number(next);
    } catch (_err) {
      // Fall through to non-Redis fallback.
    }
  }

  const current = await getTokenVersion(userId);
  const next = current + 1;
  try {
    await redis.set(key, String(next));
  } catch (_err) {
    // If Redis is down we cannot persist token version; return computed value.
  }
  return next;
}

module.exports = {
  getTokenVersion,
  incrementTokenVersion,
};
