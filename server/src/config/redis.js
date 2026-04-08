// Redis client setup for ExpertsHub V2
const Redis = require('ioredis');

const redisUrl = String(process.env.REDIS_URL || '').trim();

const createNoopRedisClient = () => ({
  status: 'disabled',
  get: async () => null,
  set: async () => 'OK',
  del: async () => 0,
  scan: async () => ['0', []],
  on: () => {},
});

if (!redisUrl) {
  console.warn('Redis disabled: REDIS_URL is not configured. Running without cache layer.');
  module.exports = createNoopRedisClient();
} else {
  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
    enableOfflineQueue: false,
  });

  let loggedConnectionError = false;

  redis.on('error', (err) => {
    if (!loggedConnectionError) {
      loggedConnectionError = true;
      const message = err?.message || 'Unknown connection error';
      console.warn(`Redis error: ${message}`);
    }
  });

  redis.connect().catch(() => {
    if (!loggedConnectionError) {
      loggedConnectionError = true;
      console.warn('Redis unavailable at startup. Cache will be bypassed until connection is restored.');
    }
  });

  redis.on('ready', () => {
    loggedConnectionError = false;
  });

  module.exports = redis;
}
