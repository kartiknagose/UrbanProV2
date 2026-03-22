const prisma = require('../../config/prisma');
const AppError = require('../../common/errors/AppError');

/**
 * FAVORITE WORKER SERVICE (Sprint 17 - #80)
 * Allows customers to save/wishlist workers for quick rebooking.
 */

/**
 * Toggle favorite status for a worker
 * If already favorited → remove, else → add
 */
async function toggleFavorite(userId, workerProfileId) {
  if (!Number.isInteger(workerProfileId) || workerProfileId <= 0) {
    throw new AppError(400, 'Invalid worker profile id.');
  }

  // Verify worker exists
  const worker = await prisma.workerProfile.findUnique({
    where: { id: workerProfileId },
    select: { id: true, userId: true }
  });
  if (!worker) throw new AppError(404, 'Worker not found.');
  if (worker.userId === userId) throw new AppError(400, 'You cannot favorite yourself.');

  const existing = await prisma.favoriteWorker.findUnique({
    where: { userId_workerProfileId: { userId, workerProfileId } }
  });

  if (existing) {
    await prisma.favoriteWorker.delete({ where: { id: existing.id } });
    return { favorited: false };
  }

  await prisma.favoriteWorker.create({
    data: { userId, workerProfileId }
  });
  return { favorited: true };
}

/**
 * Get all favorite workers for a user
 */
async function getFavorites(userId) {
  const favorites = await prisma.favoriteWorker.findMany({
    where: { userId },
    include: {
      workerProfile: {
        include: {
          user: { select: { id: true, name: true, profilePhotoUrl: true } },
          services: { include: { service: { select: { id: true, name: true, category: true } } } }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return favorites.map(f => ({
    id: f.id,
    workerProfileId: f.workerProfileId,
    savedAt: f.createdAt,
    worker: {
      id: f.workerProfile.id,
      name: f.workerProfile.user.name,
      profilePhotoUrl: f.workerProfile.user.profilePhotoUrl,
      rating: f.workerProfile.rating,
      totalReviews: f.workerProfile.totalReviews,
      hourlyRate: f.workerProfile.hourlyRate,
      verificationLevel: f.workerProfile.verificationLevel,
      services: f.workerProfile.services.map(ws => ({
        id: ws.service.id,
        name: ws.service.name,
        category: ws.service.category
      }))
    }
  }));
}

/**
 * Check if a worker is favorited by user
 */
async function isFavorited(userId, workerProfileId) {
  const count = await prisma.favoriteWorker.count({
    where: { userId, workerProfileId }
  });
  return count > 0;
}

/**
 * Get favorite worker IDs for a user (for bulk checking)
 */
async function getFavoriteWorkerIds(userId) {
  const favorites = await prisma.favoriteWorker.findMany({
    where: { userId },
    select: { workerProfileId: true }
  });
  return favorites.map(f => f.workerProfileId);
}

module.exports = {
  toggleFavorite,
  getFavorites,
  isFavorited,
  getFavoriteWorkerIds
};
