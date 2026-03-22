const asyncHandler = require('../../common/utils/asyncHandler');
const prisma = require('../../config/prisma');
const GrowthService = require('./business_growth.service');
const FavoritesService = require('./favorites.service');
const LoyaltyService = require('./loyalty.service');
const ProPlusService = require('./proplus.service');
const AppError = require('../../common/errors/AppError');
const {
    createRazorpayWalletTopupOrder,
    verifyRazorpayPaymentSignature,
    fetchRazorpayOrder,
} = require('../payments/payment.service');

/**
 * Get User Wallet & Transactions
 */
exports.getWallet = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const wallet = await prisma.wallet.findUnique({
        where: { userId },
        include: {
            user: {
                select: {
                    transactions: {
                        orderBy: { createdAt: 'desc' },
                        take: 50
                    }
                }
            }
        }
    });

    res.json({
        balance: wallet?.balance || 0,
        currency: wallet?.currency || 'INR',
        transactions: wallet?.user?.transactions || []
    });
});

/**
 * Get Referral Info
 */
exports.getReferralInfo = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            referralCode: true,
            _count: {
                select: { referrals: true }
            }
        }
    });

    // Award bonus if user doesn't have a code yet
    let code = user.referralCode;
    if (!code) {
        code = await GrowthService.generateReferralCode(userId);
    }

    res.json({
        referralCode: code,
        totalReferrals: user._count.referrals
    });
});

/**
 * Validate a Coupon (Checkout)
 */
exports.checkCoupon = asyncHandler(async (req, res) => {
    const { code, bookingAmount, serviceCategory } = req.body;

    const result = await GrowthService.validateCoupon(code, req.user.id, {
        bookingAmount,
        serviceCategory
    });

    res.json(result);
});

/**
 * Apply a Referral Code (if not applied during signup)
 */
exports.applyReferralCode = asyncHandler(async (req, res) => {
    const code = String(req.body.code || '').trim();
    await GrowthService.applyReferral(req.user.id, code);
    res.json({ message: 'Referral code applied successfully!' });
});

/**
 * Create Razorpay order for wallet top-up
 */
exports.createWalletTopupOrder = asyncHandler(async (req, res) => {
    const amount = Number(req.body?.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
        throw new AppError(400, 'Invalid amount.');
    }

    const order = await createRazorpayWalletTopupOrder(req.user.id, amount);
    res.json({
        message: 'Top-up order created successfully.',
        order,
    });
});

/**
 * Confirm Razorpay wallet top-up payment and credit wallet
 */
exports.confirmWalletTopup = asyncHandler(async (req, res) => {
    const paymentReference = req.body?.paymentReference;
    const paymentOrderId = req.body?.paymentOrderId;
    const paymentSignature = req.body?.paymentSignature;

    if (!paymentReference || !paymentOrderId || !paymentSignature) {
        throw new AppError(400, 'Missing payment verification details.');
    }

    const isSignatureValid = verifyRazorpayPaymentSignature({
        orderId: paymentOrderId,
        paymentId: paymentReference,
        signature: paymentSignature,
    });

    if (!isSignatureValid) {
        throw new AppError(400, 'Invalid payment signature.');
    }

    const order = await fetchRazorpayOrder(paymentOrderId);
    if (!order || order.status !== 'paid') {
        throw new AppError(400, 'Payment has not been captured yet.');
    }

    const orderUserId = Number(order.notes?.userId);
    const orderPurpose = order.notes?.purpose;
    if (orderUserId !== req.user.id || orderPurpose !== 'WALLET_TOPUP') {
        throw new AppError(400, 'Payment does not belong to this wallet top-up request.');
    }

    const referenceId = `RZP_TOPUP:${paymentReference}`;
    const alreadyCredited = await prisma.walletTransaction.findFirst({
        where: {
            userId: req.user.id,
            referenceId,
            type: 'DEPOSIT',
            status: 'COMPLETED',
        },
        select: { id: true },
    });

    if (alreadyCredited) {
        return res.json({
            message: 'Top-up already processed.',
            transactionId: alreadyCredited.id,
        });
    }

    const creditedAmount = Number(order.amount) / 100;
    const transaction = await GrowthService.depositCredits(
        req.user.id,
        creditedAmount,
        'Wallet Top-up via Razorpay',
        referenceId
    );

    res.json({
        message: 'Wallet top-up successful.',
        transaction,
    });
});

/**
 * Add Credits to Wallet (manual/internal use)
 */
exports.addCredits = asyncHandler(async (req, res) => {
    const amount = Number(req.body.amount);
    const description = typeof req.body.description === 'string' ? req.body.description.trim() : undefined;
    const targetUserId = req.body.userId ? Number(req.body.userId) : req.user.id;

    if (!Number.isFinite(amount) || amount <= 0) throw new AppError(400, 'Invalid amount.');
    if (!Number.isInteger(targetUserId) || targetUserId <= 0) throw new AppError(400, 'Invalid target user id.');

    const transaction = await GrowthService.depositCredits(
        targetUserId,
        amount,
        description || 'Wallet Top-up'
    );

    res.json({
        message: 'Credits added successfully!',
        transaction
    });
});

// ── FAVORITE WORKERS (Sprint 17 - #80) ─────────────────────────────

/**
 * POST /api/growth/favorites/toggle
 * Toggle favorite status for a worker
 */
exports.toggleFavorite = asyncHandler(async (req, res) => {
    const workerProfileId = Number(req.body.workerProfileId);
    if (!Number.isInteger(workerProfileId) || workerProfileId <= 0) {
        throw new AppError(400, 'workerProfileId is required.');
    }

    const result = await FavoritesService.toggleFavorite(req.user.id, workerProfileId);
    res.json(result);
});

/**
 * GET /api/growth/favorites
 * Get all favorite workers
 */
exports.getFavorites = asyncHandler(async (req, res) => {
    const favorites = await FavoritesService.getFavorites(req.user.id);
    res.json({ favorites });
});

/**
 * GET /api/growth/favorites/check/:workerProfileId
 * Check if a worker is favorited
 */
exports.checkFavorite = asyncHandler(async (req, res) => {
    const workerProfileId = Number(req.params.workerProfileId);
    const favorited = await FavoritesService.isFavorited(req.user.id, workerProfileId);
    res.json({ favorited });
});

/**
 * GET /api/growth/favorites/ids
 * Get all favorite worker IDs (for bulk UI rendering)
 */
exports.getFavoriteIds = asyncHandler(async (req, res) => {
    const ids = await FavoritesService.getFavoriteWorkerIds(req.user.id);
    res.json({ workerProfileIds: ids });
});

// ── LOYALTY POINTS (Sprint 17 - #75) ──────────────────────────────

/**
 * GET /api/growth/loyalty
 * Get loyalty points summary
 */
exports.getLoyaltySummary = asyncHandler(async (req, res) => {
    const summary = await LoyaltyService.getLoyaltySummary(req.user.id);
    res.json(summary);
});

/**
 * POST /api/growth/loyalty/redeem
 * Redeem loyalty points for discount
 */
exports.redeemPoints = asyncHandler(async (req, res) => {
    const points = Number(req.body.points);
    if (!Number.isInteger(points) || points <= 0) throw new AppError(400, 'Invalid points amount.');

    const result = await LoyaltyService.redeemPoints(req.user.id, points);
    res.json(result);
});

// ── URBANPRO PLUS (Sprint 17 - #74) ──────────────────────────────

/**
 * GET /api/growth/proplus
 * Get subscription details
 */
exports.getProPlusSubscription = asyncHandler(async (req, res) => {
    const info = await ProPlusService.getSubscriptionInfo(req.user.id);
    res.json({ subscription: info });
});

/**
 * POST /api/growth/proplus/subscribe
 * Subscribe to UrbanPro Plus demo
 */
exports.subscribeProPlus = asyncHandler(async (req, res) => {
    const { planId } = req.body;
    if (!planId) throw new AppError(400, 'planId is required');
    
    const sub = await ProPlusService.subscribeUser(req.user.id, planId);
    res.json({ message: 'Subscribed successfully', subscription: sub });
});

/**
 * POST /api/growth/proplus/cancel
 * Cancel subscription auto-renewal
 */
exports.cancelProPlus = asyncHandler(async (req, res) => {
    const sub = await ProPlusService.cancelSubscription(req.user.id);
    res.json({ message: 'Subscription cancelled', subscription: sub });
});
// ── GIFT CARDS (Sprint 17 - #76) ──────────────────────────────────
/**
 * POST /api/growth/giftcards/purchase
 */
exports.purchaseGiftCard = asyncHandler(async (req, res) => {
    const senderName = typeof req.body.senderName === 'string' ? req.body.senderName.trim() : null;
    const recipientEmail = String(req.body.recipientEmail || '').trim().toLowerCase();
    const message = typeof req.body.message === 'string' ? req.body.message.trim() : null;
    const amount = Number(req.body.amount);
    const card = await GrowthService.purchaseGiftCard({ senderName, recipientEmail, message, amount });
    res.json({ message: 'Gift card purchased successfully', card });
});

/**
 * POST /api/growth/giftcards/redeem
 */
exports.redeemGiftCard = asyncHandler(async (req, res) => {
    const code = String(req.body.code || '').trim();
    if (!code) throw new AppError(400, 'Gift card code is required.');

    const result = await GrowthService.redeemGiftCard(req.user.id, code);
    res.json({ message: `Success! ₹${result.amount} added to your wallet.`, code: result.code });
});

/**
 * GET /api/growth/giftcards/check/:code
 */
exports.checkGiftCard = asyncHandler(async (req, res) => {
    const code = String(req.params.code || '').trim();
    const info = await GrowthService.checkGiftCard(code);
    res.json(info);
});
