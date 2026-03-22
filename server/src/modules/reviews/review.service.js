/**
 * REVIEW SERVICE - TWO-WAY REVIEW SYSTEM
 * 
 * Supports both Customer → Worker AND Worker → Customer reviews.
 * Each user involved in a booking can leave exactly one review.
 */

const prisma = require('../../config/prisma');
const AppError = require('../../common/errors/AppError');

/**
 * CREATE A REVIEW (Two-Way)
 * 
 * @param {number} userId - The logged-in user's ID
 * @param {string} userRole - The logged-in user's role (CUSTOMER or WORKER)
 * @param {object} data - { bookingId, rating, comment }
 */
async function createReview(userId, userRole, data) {
  const bookingId = Number(data.bookingId);
  const rating = Number(data.rating);
  const comment = typeof data.comment === 'string' ? data.comment.trim() : undefined;

  if (!Number.isInteger(bookingId) || bookingId < 1) {
    throw new AppError(400, 'Booking ID must be a positive integer.');
  }

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new AppError(400, 'Rating must be between 1 and 5.');
  }

  // 1. Fetch booking with worker profile info
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      workerProfile: { select: { id: true, userId: true } },
    },
  });

  if (!booking) {
    throw new AppError(404, 'Booking not found.');
  }

  if (booking.status !== 'COMPLETED') {
    throw new AppError(400, 'You can only review completed bookings.');
  }

  // 2. Determine reviewer and reviewee
  let reviewerId;
  let revieweeId;

  if (userRole === 'CUSTOMER' && booking.customerId === userId) {
    // Customer reviewing the worker
    reviewerId = userId;
    revieweeId = booking.workerProfile?.userId;
    if (!revieweeId) {
      throw new AppError(404, 'Worker profile not found for this booking.');
    }
  } else if (userRole === 'WORKER') {
    // Worker reviewing the customer
    const workerProfile = await prisma.workerProfile.findUnique({
      where: { userId },
    });
    if (!workerProfile || booking.workerProfileId !== workerProfile.id) {
      throw new AppError(403, 'You are not assigned to this booking.');
    }
    reviewerId = userId;
    revieweeId = booking.customerId;
  } else {
    throw new AppError(403, 'You are not involved in this booking.');
  }

  // 3. Check if this user already reviewed this booking
  const existingReview = await prisma.review.findUnique({
    where: {
      bookingId_reviewerId: {
        bookingId,
        reviewerId,
      },
    },
  });

  if (existingReview) {
    throw new AppError(409, 'You have already reviewed this booking.');
  }

  // 3b. FRAUD DETECTION: Review Spam
  if (comment) {
    const spamKeywords = ['cheap', 'offer', 'hot', 'discount', 'free', 'win', 'cash', 'money', 'link', 'click', 'sex', 'porn'];
    const lowerComment = comment.toLowerCase();

    // Check for spam keywords
    const hasSpamKeyword = spamKeywords.some(keyword => lowerComment.includes(keyword));

    // Check for URL-like patterns
    const hasUrl = /https?:\/\/[^\s]+/.test(lowerComment) || /www\.[^\s]+/.test(lowerComment);

    // Check for repetitive characters (e.g., "aaaaa")
    const hasRepetition = /(.)\1{4,}/.test(lowerComment);

    if (hasSpamKeyword || hasUrl || hasRepetition) {
      throw new AppError(400, 'Review comment contains suspicious or prohibited patterns. Please provide a helpful, natural review.');
    }

    if (comment.trim().length < 5) {
      throw new AppError(400, 'Review comment is too short. Please provide a more detailed feedback (min 5 characters).');
    }
  }

  // 4-7. Create review + recalculate rating in a transaction for atomicity
  let review;
  try {
    review = await prisma.$transaction(async (tx) => {
    // 4. Create the review
    const newReview = await tx.review.create({
      data: {
        bookingId,
        reviewerId,
        revieweeId,
        rating,
        comment: comment || null,
      },
      include: {
        booking: {
          include: { service: { select: { id: true, name: true, category: true } } },
        },
        reviewer: { select: { id: true, name: true } },
        reviewee: { select: { id: true, name: true } },
      },
    });

    // 5. Update aggregate rating for the reviewee (can be Customer or Worker)
    const aggregate = await tx.review.aggregate({
      where: { revieweeId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await tx.user.update({
      where: { id: revieweeId },
      data: {
        rating: aggregate._avg.rating || 0,
        totalReviews: aggregate._count.rating || 0,
      },
    });

    // 6. If reviewee is a worker, also sync to WorkerProfile for legacy compatibility/charts
    const revieweeWorkerProfile = await tx.workerProfile.findUnique({
      where: { userId: revieweeId },
    });

    if (revieweeWorkerProfile) {
      await tx.workerProfile.update({
        where: { userId: revieweeId },
        data: {
          rating: aggregate._avg.rating || 0,
          totalReviews: aggregate._count.rating || 0,
        },
      });
    }

    return newReview;
    });
  } catch (error) {
    if (error.code === 'P2002') {
      throw new AppError(409, 'You have already reviewed this booking.');
    }
    throw error;
  }

  return review;
}

/**
 * GET REVIEWS WRITTEN BY A USER (My Reviews)
 * Shows reviews the logged-in user has written
 */
async function getMyReviews(userId, { skip = 0, limit = 20 } = {}) {
  const where = { reviewerId: userId };
  const [data, total] = await Promise.all([
    prisma.review.findMany({
      where,
      include: {
        booking: {
          include: { service: { select: { id: true, name: true, category: true } } },
        },
        reviewee: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.review.count({ where }),
  ]);
  return { data, total };
}

/**
 * GET REVIEWS ABOUT A USER (Reviews Received)
 * Shows reviews others have written about the logged-in user
 */
async function getReviewsAboutMe(userId, { skip = 0, limit = 20 } = {}) {
  const where = { revieweeId: userId };
  const [data, total] = await Promise.all([
    prisma.review.findMany({
      where,
      include: {
        booking: {
          include: { service: { select: { id: true, name: true, category: true } } },
        },
        reviewer: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.review.count({ where }),
  ]);
  return { data, total };
}

/**
 * GET BOOKINGS PENDING REVIEW
 * Returns completed bookings where the user has NOT yet left a review
 */
async function getPendingReviews(userId, userRole, { skip = 0, limit = 20 } = {}) {
  if (!['CUSTOMER', 'WORKER'].includes(userRole)) {
    throw new AppError(403, 'Only customers and workers can access pending reviews.');
  }

  let whereClause = {
    status: 'COMPLETED',
    reviews: { none: { reviewerId: userId } },
  };

  if (userRole === 'CUSTOMER') {
    whereClause.customerId = userId;
  } else if (userRole === 'WORKER') {
    const workerProfile = await prisma.workerProfile.findUnique({
      where: { userId },
    });
    if (!workerProfile) return { data: [], total: 0 };
    whereClause.workerProfileId = workerProfile.id;
  }

  const [data, total] = await Promise.all([
    prisma.booking.findMany({
      where: whereClause,
      include: {
        service: { select: { id: true, name: true, category: true } },
        workerProfile: {
          select: {
            id: true,
            userId: true,
            user: { select: { id: true, name: true } },
          },
        },
        customer: { select: { id: true, name: true } },
        reviews: {
          select: { reviewerId: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.booking.count({ where: whereClause }),
  ]);

  return { data, total };
}

module.exports = {
  createReview,
  getMyReviews,
  getReviewsAboutMe,
  getPendingReviews,
};
