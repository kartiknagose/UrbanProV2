const prisma = require('../../config/prisma');
const AppError = require('../../common/errors/AppError');

/**
 * LOYALTY POINTS SERVICE (Sprint 17 - #75)
 * 1 point per ₹10 spent. Points redeemable at checkout.
 * Points expire after 6 months.
 */

const POINTS_PER_RUPEE = 0.1; // 1 point per ₹10
const REDEMPTION_VALUE = 10;  // 1 point = ₹0.10 (100 points = ₹10)
const EXPIRY_MONTHS = 6;

/**
 * Initialize loyalty points for a user if not exists
 */
async function initializeLoyalty(userId, tx = prisma) {
  return tx.loyaltyPoints.upsert({
    where: { userId },
    create: { userId, balance: 0, lifetime: 0 },
    update: {}
  });
}

/**
 * Award loyalty points based on payment amount
 * Called after successful booking payment
 */
async function awardPoints(userId, bookingAmount, bookingId, tx = prisma) {
  const points = Math.floor(Number(bookingAmount) * POINTS_PER_RUPEE);
  if (points <= 0) return null;

  await initializeLoyalty(userId, tx);

  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + EXPIRY_MONTHS);

  // Update balance
  await tx.loyaltyPoints.update({
    where: { userId },
    data: {
      balance: { increment: points },
      lifetime: { increment: points }
    }
  });

  // Record transaction
  return tx.loyaltyTransaction.create({
    data: {
      userId,
      points,
      type: 'EARNED',
      description: `Earned ${points} points for booking #${bookingId}`,
      referenceId: String(bookingId),
      expiresAt
    }
  });
}

/**
 * Redeem loyalty points at checkout
 * Returns the discount amount in rupees
 */
async function redeemPoints(userId, pointsToRedeem) {
  if (!Number.isInteger(pointsToRedeem) || pointsToRedeem <= 0) {
    throw new AppError(400, 'Invalid point amount.');
  }

  const loyalty = await prisma.loyaltyPoints.findUnique({ where: { userId } });
  if (!loyalty) throw new AppError(404, 'Loyalty account not found.');
  if (loyalty.balance < pointsToRedeem) {
    throw new AppError(400, `Insufficient points. You have ${loyalty.balance} points.`);
  }

  const discountAmount = (pointsToRedeem / REDEMPTION_VALUE).toFixed(2);

  await prisma.$transaction(async (tx) => {
    // Conditional decrement prevents double-spend under concurrent redeem requests.
    const updated = await tx.loyaltyPoints.updateMany({
      where: {
        userId,
        balance: { gte: pointsToRedeem },
      },
      data: { balance: { decrement: pointsToRedeem } },
    });

    if (updated.count !== 1) {
      throw new AppError(400, 'Insufficient points. Please refresh and try again.');
    }

    await tx.loyaltyTransaction.create({
      data: {
        userId,
        points: -pointsToRedeem,
        type: 'REDEEMED',
        description: `Redeemed ${pointsToRedeem} points for ₹${discountAmount} discount`
      }
    });
  });

  return { pointsRedeemed: pointsToRedeem, discountAmount: Number(discountAmount) };
}

/**
 * Get loyalty summary for a user
 */
async function getLoyaltySummary(userId) {
  await initializeLoyalty(userId);

  const loyalty = await prisma.loyaltyPoints.findUnique({ where: { userId } });

  const transactions = await prisma.loyaltyTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50
  });

  return {
    balance: loyalty.balance,
    lifetime: loyalty.lifetime,
    redeemableValue: (loyalty.balance / REDEMPTION_VALUE).toFixed(2),
    transactions
  };
}

/**
 * Expire old points (called via cron job)
 * Points earned more than 6 months ago are expired
 */
async function expireOldPoints() {
  const now = new Date();

  // Find expired transactions that haven't been processed
  const expiredTxns = await prisma.loyaltyTransaction.findMany({
    where: {
      type: 'EARNED',
      expiresAt: { lte: now },
      points: { gt: 0 }
    }
  });

  for (const txn of expiredTxns) {
    // Calculate how many of these points are still in balance
    const loyalty = await prisma.loyaltyPoints.findUnique({
      where: { userId: txn.userId }
    });

    if (loyalty && loyalty.balance > 0) {
      const pointsToExpire = Math.min(txn.points, loyalty.balance);

      await prisma.$transaction([
        prisma.loyaltyPoints.update({
          where: { userId: txn.userId },
          data: { balance: { decrement: pointsToExpire } }
        }),
        prisma.loyaltyTransaction.create({
          data: {
            userId: txn.userId,
            points: -pointsToExpire,
            type: 'EXPIRED',
            description: `${pointsToExpire} points expired`,
            referenceId: String(txn.id)
          }
        }),
        // Mark the original as processed by zeroing points
        prisma.loyaltyTransaction.update({
          where: { id: txn.id },
          data: { points: 0 }
        })
      ]);
    }
  }
}

module.exports = {
  initializeLoyalty,
  awardPoints,
  redeemPoints,
  getLoyaltySummary,
  expireOldPoints,
  POINTS_PER_RUPEE,
  REDEMPTION_VALUE,
  EXPIRY_MONTHS
};
