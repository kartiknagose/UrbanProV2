const prisma = require('../../config/prisma');
const AppError = require('../../common/errors/AppError');
const Redis = require('ioredis');

let redisClient = null;
try {
    redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
        maxRetriesPerRequest: 1,
        retryStrategy: () => null, // Don't retry — fall back to DB
        lazyConnect: true,
    });
    redisClient.connect().catch(() => {
        console.warn('Location service: Redis unavailable, using database only');
        redisClient = null;
    });
} catch {
    console.warn('Location service: Redis unavailable, using database only');
    redisClient = null;
}

/**
 * Update worker real-time location and cache in Redis
 * @param {number} userId - User ID of the worker
 * @param {Object} data - { latitude, longitude, isOnline }
 */
async function updateLocation(userId, data) {
    const profile = await prisma.workerProfile.findUnique({
        where: { userId },
        select: { id: true }
    });

    if (!profile) {
        throw new AppError(404, 'Worker profile not found');
    }

    const location = await prisma.workerLocation.upsert({
        where: { workerProfileId: profile.id },
        create: {
            workerProfileId: profile.id,
            latitude: data.latitude,
            longitude: data.longitude,
            isOnline: data.isOnline ?? true,
            lastUpdated: new Date()
        },
        update: {
            latitude: data.latitude,
            longitude: data.longitude,
            isOnline: data.isOnline ?? true,
            lastUpdated: new Date()
        },
        include: {
            workerProfile: {
                include: {
                    user: {
                        select: { id: true, name: true }
                    }
                }
            }
        }
    });

    // Cache location in Redis (if available)
    if (redisClient) {
        try {
            await redisClient.set(
                `worker_location:${profile.id}`,
                JSON.stringify({
                    latitude: location.latitude,
                    longitude: location.longitude,
                    isOnline: location.isOnline,
                    lastUpdated: location.lastUpdated
                }),
                'EX', 300 // 5 min TTL
            );
        } catch { /* Redis down, ignore */ }
    }

    return location;
}

/**
 * Get location of a specific worker (prefer Redis cache)
 */
async function getWorkerLocation(workerProfileId) {
    // Try Redis cache first (if available)
    if (redisClient) {
        try {
            const cached = await redisClient.get(`worker_location:${workerProfileId}`);
            if (cached) {
                const parsed = JSON.parse(cached);
                return {
                    workerProfileId,
                    ...parsed
                };
            }
        } catch { /* Redis down, fall through to DB */ }
    }
    // Fallback to DB
    return prisma.workerLocation.findUnique({
        where: { workerProfileId },
        include: {
            workerProfile: {
                include: {
                    user: {
                        select: { id: true, name: true, profilePhotoUrl: true }
                    }
                }
            }
        }
    });
}

/**
 * Get all online workers within a radius
 * (Simple box filter for now, can be improved with PostGIS if needed)
 */
async function getNearbyWorkers(lat, lng, radiusKm = 10, limit = 50) {
    // 1 degree latitude is approx 111km
    // 1 degree longitude is approx 111km * cos(lat)
    const latDelta = radiusKm / 111;
    const cosLatitude = Math.cos(lat * (Math.PI / 180));
    const safeCosLatitude = Math.max(Math.abs(cosLatitude), 0.01);
    const lngDelta = radiusKm / (111 * safeCosLatitude);

    const candidates = await prisma.workerLocation.findMany({
        where: {
            isOnline: true,
            latitude: {
                gte: lat - latDelta,
                lte: lat + latDelta
            },
            longitude: {
                gte: lng - lngDelta,
                lte: lng + lngDelta
            },
            workerProfile: {
                isVerified: true,
                user: {
                    isActive: true,
                },
            },
        },
        select: {
            id: true,
            workerProfileId: true,
            latitude: true,
            longitude: true,
            isOnline: true,
            lastUpdated: true,
            workerProfile: {
                select: {
                    id: true,
                    rating: true,
                    totalReviews: true,
                    isVerified: true,
                    user: {
                        select: { id: true, name: true, profilePhotoUrl: true }
                    },
                    services: {
                        select: {
                            service: true
                        }
                    }
                }
            }
        }
    });

    return candidates
        .map((workerLocation) => {
            const distanceKm = calculateDistance(lat, lng, workerLocation.latitude, workerLocation.longitude);
            return {
                ...workerLocation,
                distanceKm,
            };
        })
        .filter((workerLocation) => workerLocation.distanceKm <= radiusKm)
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, limit);
}

/**
 * Calculate distance between two points (Haversine formula) in KM
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in KM
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * CITY MANAGEMENT (Sprint 17 - #83)
 */

async function getCities() {
    return prisma.city.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' }
    });
}

async function getCityServices(citySlug) {
    const city = await prisma.city.findUnique({
        where: { slug: citySlug },
        include: {
            services: {
                where: { isActive: true },
                include: {
                    service: true
                }
            }
        }
    });

    if (!city) throw new AppError(404, 'City not found');

    // Return services with their city-specific basePrice if available
    return city.services.map(cs => ({
        ...cs.service,
        basePrice: cs.basePrice || cs.service.basePrice,
        citySpecific: !!cs.basePrice
    }));
}

module.exports = {
    updateLocation,
    getWorkerLocation,
    getNearbyWorkers,
    calculateDistance,
    getCities,
    getCityServices
};
