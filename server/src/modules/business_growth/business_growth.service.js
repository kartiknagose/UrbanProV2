const prisma = require('../../config/prisma');
const AppError = require('../../common/errors/AppError');
const { randomBytes } = require('crypto');

// Import specialized services
const LoyaltyService = require('./loyalty.service');
const ProPlusService = require('./proplus.service');
const FavoritesService = require('./favorites.service');
const GiftCardService = require('./gift.service');

/**
 * BUSINESS GROWTH SERVICE (Sprint 17)
 * Handles Wallet, Referrals, and Coupons.
 * Consolidates sub-services for easier access from other modules.
 */

/**
 * Initialize a wallet for a user if it doesn't exist
 */
async function initializeWallet(userId, tx = prisma) {
    return tx.wallet.upsert({
        where: { userId },
        create: { userId, balance: 0.0, currency: 'INR' },
        update: {} // Do nothing if exists
    });
}

/**
 * Generate a unique referral code for a user
 */
async function generateReferralCode(userId, tx = prisma) {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { name: true, referralCode: true } });
    if (!user) throw new AppError(404, 'User not found.');
    if (user.referralCode) return user.referralCode;

    // Format: NAME + 4 random chars
    const normalizedName = String(user.name || '').trim();
    const namePart = (normalizedName.split(' ')[0] || 'USER').replace(/[^a-zA-Z]/g, '').toUpperCase().substring(0, 4) || 'USER';

    for (let attempt = 0; attempt < 5; attempt += 1) {
        const randomPart = randomBytes(2).toString('hex').toUpperCase();
        const code = `${namePart}${randomPart}`;

        try {
            await tx.user.update({
                where: { id: userId },
                data: { referralCode: code }
            });
            return code;
        } catch (error) {
            if (error.code !== 'P2002') {
                throw error;
            }
        }
    }

    throw new AppError(500, 'Unable to generate referral code. Please try again.');
}

/**
 * Apply a referral code during registration or later
 */
async function applyReferral(userId, code) {
    const normalizedCode = String(code || '').trim().toUpperCase();
    if (!normalizedCode) {
        throw new AppError(400, 'Referral code is required.');
    }

    const referrer = await prisma.user.findUnique({ where: { referralCode: normalizedCode } });
    if (!referrer) throw new AppError(404, 'Invalid referral code.');
    if (referrer.id === userId) throw new AppError(400, 'You cannot refer yourself.');

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(404, 'User not found.');
    if (user.referredById) throw new AppError(400, 'Referral already applied to this account.');

    return prisma.user.update({
        where: { id: userId },
        data: { referredById: referrer.id }
    });
}

/**
 * Process a Wallet Transaction
 */
async function processWalletTransaction({ userId, amount, type, description, referenceId }, tx = prisma) {
    const normalizedAmount = Number(amount);
    if (!Number.isFinite(normalizedAmount) || normalizedAmount === 0) {
        throw new AppError(400, 'Transaction amount must be a non-zero number.');
    }

    const wallet = await tx.wallet.findUnique({ where: { userId }, select: { id: true } });
    if (!wallet) throw new AppError(404, 'User wallet not found.');

    if (normalizedAmount < 0) {
        const updated = await tx.wallet.updateMany({
            where: {
                id: wallet.id,
                balance: { gte: Math.abs(normalizedAmount) },
            },
            data: {
                balance: { increment: normalizedAmount },
            },
        });

        if (updated.count !== 1) {
            throw new AppError(400, 'Insufficient wallet balance.');
        }
    } else {
        await tx.wallet.update({
            where: { id: wallet.id },
            data: { balance: { increment: normalizedAmount } },
        });
    }

    // 2. Create Transaction History
    return tx.walletTransaction.create({
        data: {
            userId,
            amount: normalizedAmount,
            type,
            description: description || null,
            referenceId: referenceId === undefined || referenceId === null ? null : String(referenceId),
            status: 'COMPLETED'
        }
    });
}

/**
 * Validate Coupon code
 */
async function validateCoupon(code, userId, { bookingAmount, serviceCategory } = {}) {
    const normalizedCode = String(code || '').trim().toUpperCase();
    if (!normalizedCode) {
        throw new AppError(400, 'Coupon code is required.');
    }

    const normalizedBookingAmount = Number(bookingAmount);
    if (!Number.isFinite(normalizedBookingAmount) || normalizedBookingAmount < 0) {
        throw new AppError(400, 'Booking amount must be a valid non-negative number.');
    }

    const normalizedServiceCategory = typeof serviceCategory === 'string' ? serviceCategory.trim().toUpperCase() : null;

    const coupon = await prisma.coupon.findUnique({ where: { code: normalizedCode } });

    if (!coupon || !coupon.isActive) throw new AppError(404, 'Coupon not found or inactive.');

    const now = new Date();
    if (coupon.startDate && now < coupon.startDate) throw new AppError(400, 'Coupon is not yet active.');
    if (coupon.endDate && now > coupon.endDate) throw new AppError(400, 'Coupon has expired.');

    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
        throw new AppError(400, 'Coupon usage limit reached.');
    }

    if (coupon.minOrderValue && normalizedBookingAmount < Number(coupon.minOrderValue)) {
        throw new AppError(400, `Minimum order value of ₹${coupon.minOrderValue} required.`);
    }

    const couponApplicableTo = typeof coupon.applicableTo === 'string' ? coupon.applicableTo.trim().toUpperCase() : null;
    if (couponApplicableTo && couponApplicableTo !== 'ALL' && couponApplicableTo !== normalizedServiceCategory) {
        throw new AppError(400, `Coupon is only valid for ${coupon.applicableTo} services.`);
    }

    // Check if user already used this coupon (optional rule depending on requirements)
    const usage = await prisma.booking.count({
        where: { customerId: userId, couponId: coupon.id, status: { not: 'CANCELLED' } }
    });

    if (usage > 0) throw new AppError(400, 'You have already used this coupon.');

    if (coupon.firstTimeOnly) {
        const totalBookings = await prisma.booking.count({
            where: { customerId: userId, status: { not: 'CANCELLED' } }
        });
        if (totalBookings > 0) throw new AppError(400, 'This coupon is for first-time users only.');
    }

    // Calculate Discount
    let discountAmount;
    if (coupon.discountType === 'PERCENTAGE') {
        discountAmount = (normalizedBookingAmount * Number(coupon.discountValue)) / 100;
        if (coupon.maxDiscount && discountAmount > Number(coupon.maxDiscount)) {
            discountAmount = Number(coupon.maxDiscount);
        }
    } else {
        discountAmount = Number(coupon.discountValue);
    }

    return {
        couponId: coupon.id,
        discountAmount: Math.min(discountAmount, normalizedBookingAmount), // Can't be more than price
        code: coupon.code
    };
}

/**
 * Award Referral Bonus
 */
async function awardReferralBonus(bookingId, tx = prisma) {
    const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
            customer: { select: { id: true, referredById: true } },
            service: true
        }
    });

    if (!booking || !booking.customer.referredById) return;

    // Check if this is the customer's first completed job
    const completedJobs = await tx.booking.count({
        where: { customerId: booking.customerId, status: 'COMPLETED' }
    });

    if (completedJobs === 1) {
        // Referrer gets 50
        await processWalletTransaction({
            userId: booking.customer.referredById,
            amount: 50.0,
            type: 'REFERRAL_BONUS',
            description: `Referral bonus for inviting member #${booking.customer.id}`,
            referenceId: bookingId
        }, tx);

        // Referee gets 50
        await processWalletTransaction({
            userId: booking.customerId,
            amount: 50.0,
            type: 'REFERRAL_BONUS',
            description: `Welcome bonus for joining via referral`,
            referenceId: bookingId
        }, tx);
    }
}

/**
 * Add credits to a user's wallet
 */
async function depositCredits(userId, amount, description = 'Wallet Deposit', referenceId = 'manual', tx = prisma) {
    const normalizedAmount = Number(amount);
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
        throw new AppError(400, 'Deposit amount must be greater than zero.');
    }

    await initializeWallet(userId, tx);
    return processWalletTransaction({
        userId,
        amount: normalizedAmount,
        type: 'DEPOSIT',
        description,
        referenceId
    }, tx);
}

// Re-export specialized services for simplified access
module.exports = {
    initializeWallet,
    generateReferralCode,
    applyReferral,
    processWalletTransaction,
    validateCoupon,
    awardReferralBonus,
    depositCredits,

    // Proxy to specialized services
    awardLoyaltyPoints: LoyaltyService.awardPoints,
    redeemLoyaltyPoints: LoyaltyService.redeemPoints,
    getLoyaltySummary: LoyaltyService.getLoyaltySummary,
    
    subscribeProPlus: ProPlusService.subscribeUser,
    getProPlusSubscription: ProPlusService.getSubscriptionInfo,
    cancelProPlus: ProPlusService.cancelSubscription,

    toggleFavoriteWorker: FavoritesService.toggleFavorite,
    getFavoriteWorkers: FavoritesService.getFavorites,

    purchaseGiftCard: GiftCardService.purchaseGiftCard,
    redeemGiftCard: GiftCardService.redeemGiftCard,
    checkGiftCard: GiftCardService.checkGiftCard
};

