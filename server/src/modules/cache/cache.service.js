// Service for Redis caching: service catalog and worker profiles
const redis = require('../../config/redis');
const prisma = require('../../config/prisma');
const SERVICE_CATALOG_KEY = 'service_catalog';
const WORKER_PROFILE_KEY = (id) => `worker_profile:${id}`;

function tryParseCachedJson(raw, keyName) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_err) {
    // Remove malformed cache entries so subsequent reads can repopulate.
    redis.del(keyName).catch(() => {});
    return null;
  }
}

async function invalidateWorkerProfilePattern() {
  let cursor = '0';
  do {
    const result = await redis.scan(cursor, 'MATCH', 'worker_profile:*', 'COUNT', 200);
    cursor = result[0];
    const keys = result[1];
    if (Array.isArray(keys) && keys.length > 0) {
      await redis.del(...keys);
    }
  } while (cursor !== '0');
}

module.exports = {
  async getServiceCatalog() {
    const cached = await redis.get(SERVICE_CATALOG_KEY);
    const parsed = tryParseCachedJson(cached, SERVICE_CATALOG_KEY);
    if (parsed) return parsed;
    // Fetch from DB and cache
    const services = await prisma.service.findMany();
    await redis.set(SERVICE_CATALOG_KEY, JSON.stringify(services), 'EX', 300); // 5min TTL
    return services;
  },

  async invalidateServiceCatalog() {
    await redis.del(SERVICE_CATALOG_KEY);
  },

  async getWorkerProfile(id) {
    const cacheKey = WORKER_PROFILE_KEY(id);
    const cached = await redis.get(cacheKey);
    const parsed = tryParseCachedJson(cached, cacheKey);
    if (parsed) return parsed;

    const profile = await prisma.workerProfile.findUnique({
      where: { id },
      include: { 
        user: {
          select: {
            id: true,
            name: true,
            profilePhotoUrl: true,
            rating: true,
            totalReviews: true,
            reviewsReceived: {
              include: {
                reviewer: {
                  select: { id: true, name: true, profilePhotoUrl: true }
                }
              },
              orderBy: { createdAt: 'desc' },
              take: 5
            }
          }
        },
        services: {
          include: { 
            service: {
              select: { id: true, name: true, category: true }
            }
          }
        }
      }
    });
    await redis.set(cacheKey, JSON.stringify(profile), 'EX', 120); // 2min TTL
    return profile;
  },

  async invalidateWorkerProfile(id) {
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId < 1) return;

    // Invalidate direct key first (profile-id usage)
    await redis.del(WORKER_PROFILE_KEY(numericId));

    // Also handle caller passing a userId by resolving worker profile id.
    const profileByUser = await prisma.workerProfile.findUnique({
      where: { userId: numericId },
      select: { id: true },
    });

    if (profileByUser?.id && profileByUser.id !== numericId) {
      await redis.del(WORKER_PROFILE_KEY(profileByUser.id));
    }
  },

  async invalidateAll() {
    await Promise.all([
      redis.del(SERVICE_CATALOG_KEY),
      invalidateWorkerProfilePattern(),
    ]);
  },
};
