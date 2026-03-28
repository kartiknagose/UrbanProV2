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
    fetchRazorpayPayment,
} = require('../payments/payment.service');

/**
 * Get User Wallet & Transactions
 */
exports.getWallet = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const wallet = await GrowthService.getWalletSnapshot(userId);
    res.json(wallet);
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
    const normalizedAmount = Math.round(amount * 100) / 100;

    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0 || normalizedAmount > 100000) {
        throw new AppError(400, 'Invalid amount.');
    }

    const order = await createRazorpayWalletTopupOrder(req.user.id, normalizedAmount);

    await prisma.walletTopupOrder.create({
        data: {
            userId: req.user.id,
            amount: normalizedAmount,
            currency: order.currency || 'INR',
            status: 'CREATED',
            razorpayOrderId: order.id,
        },
    });

    res.json({
        message: 'Top-up order created successfully.',
        order: {
            id: order.id,
            amount: order.amount,
            currency: order.currency,
        },
    });
});

/**
 * Confirm Razorpay wallet top-up payment and credit wallet
 */
exports.confirmWalletTopup = asyncHandler(async (req, res) => {
    const paymentId = String(req.body?.razorpay_payment_id || '').trim();
    const orderId = String(req.body?.razorpay_order_id || '').trim();
    const signature = String(req.body?.razorpay_signature || '').trim();

    if (!paymentId || !orderId || !signature) {
        throw new AppError(400, 'Missing payment verification details.');
    }

    const walletOrder = await prisma.walletTopupOrder.findUnique({
        where: { razorpayOrderId: orderId },
        select: {
            id: true,
            userId: true,
            amount: true,
            status: true,
            razorpayPaymentId: true,
        },
    });

    if (!walletOrder || walletOrder.userId !== req.user.id) {
        throw new AppError(400, 'Top-up order not found for this user.');
    }

    if (walletOrder.status === 'PAID') {
        return res.json({
            message: 'Top-up already processed.',
            transactionId: walletOrder.razorpayPaymentId,
        });
    }

    const isSignatureValid = verifyRazorpayPaymentSignature({
        orderId,
        paymentId,
        signature,
    });

    if (!isSignatureValid) {
        await prisma.walletTopupOrder.update({
            where: { id: walletOrder.id },
            data: { status: 'FAILED', failureReason: 'Signature verification failed.' },
        });
        throw new AppError(400, 'Invalid payment signature.');
    }

    const [order, payment] = await Promise.all([
        fetchRazorpayOrder(orderId),
        fetchRazorpayPayment(paymentId),
    ]);

    if (!order || order.status !== 'paid') {
        await prisma.walletTopupOrder.update({
            where: { id: walletOrder.id },
            data: { status: 'FAILED', failureReason: 'Order is not captured as paid.' },
        });
        throw new AppError(400, 'Payment has not been captured yet.');
    }

    const orderUserId = Number(order.notes?.userId);
    const orderPurpose = order.notes?.purpose;
    if (orderUserId !== req.user.id || orderPurpose !== 'WALLET_TOPUP') {
        await prisma.walletTopupOrder.update({
            where: { id: walletOrder.id },
            data: { status: 'FAILED', failureReason: 'Order ownership validation failed.' },
        });
        throw new AppError(400, 'Payment does not belong to this wallet top-up request.');
    }

    if (!payment || payment.order_id !== orderId || payment.id !== paymentId || payment.status !== 'captured') {
        await prisma.walletTopupOrder.update({
            where: { id: walletOrder.id },
            data: { status: 'FAILED', failureReason: 'Payment capture validation failed.' },
        });
        throw new AppError(400, 'Invalid captured payment details.');
    }

    const amountFromGateway = Number(payment.amount) / 100;
    const amountFromOrder = Number(order.amount) / 100;
    const amountFromDb = Number(walletOrder.amount);
    const isAmountMismatch = amountFromGateway !== amountFromOrder || amountFromOrder !== amountFromDb;
    if (isAmountMismatch) {
        await prisma.walletTopupOrder.update({
            where: { id: walletOrder.id },
            data: { status: 'FAILED', failureReason: 'Amount mismatch during verification.' },
        });
        throw new AppError(400, 'Payment amount mismatch.');
    }

    const existingPaidOrder = await prisma.walletTopupOrder.findFirst({
        where: { razorpayPaymentId: paymentId, status: 'PAID' },
        select: { id: true, razorpayPaymentId: true },
    });

    if (existingPaidOrder) {
        return res.json({
            message: 'Top-up already processed.',
            transactionId: existingPaidOrder.razorpayPaymentId,
        });
    }

    const referenceId = `RZP_TOPUP:${paymentId}`;

    const credited = await prisma.$transaction(async (tx) => {
        const claimResult = await tx.walletTopupOrder.updateMany({
            where: {
                id: walletOrder.id,
                userId: req.user.id,
                status: { in: ['CREATED', 'FAILED'] },
            },
            data: {
                status: 'PAID',
                razorpayPaymentId: paymentId,
                razorpaySignature: signature,
                paidAt: new Date(),
                failureReason: null,
            },
        });

        if (claimResult.count !== 1) {
            return null;
        }

        return GrowthService.depositCredits(
            req.user.id,
            amountFromDb,
            'Wallet Top-up via Razorpay',
            referenceId,
            tx
        );
    });

    if (!credited) {
        return res.json({
            message: 'Top-up already processed.',
            transactionId: paymentId,
        });
    }

    res.json({
        message: 'Wallet top-up successful.',
        transaction: credited,
    });
});

/**
 * Mark a Razorpay wallet top-up as failed
 */
exports.failWalletTopup = asyncHandler(async (req, res) => {
    const orderId = String(req.body?.razorpay_order_id || '').trim();
    const reason = String(req.body?.reason || 'Payment failed or was cancelled.').trim();

    const existing = await prisma.walletTopupOrder.findUnique({
        where: { razorpayOrderId: orderId },
        select: { id: true, userId: true, status: true },
    });

    if (!existing || existing.userId !== req.user.id) {
        throw new AppError(404, 'Top-up order not found.');
    }

    if (existing.status === 'PAID') {
        return res.json({ message: 'Top-up already paid. Failure update ignored.' });
    }

    await prisma.walletTopupOrder.update({
        where: { id: existing.id },
        data: {
            status: 'FAILED',
            failureReason: reason || 'Payment failed.',
        },
    });

    res.json({ message: 'Top-up marked as failed.' });
});

/**
 * Redeem wallet balance
 */
exports.redeemWalletBalance = asyncHandler(async (req, res) => {
    const amount = Number(req.body?.amount);
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';

    const transaction = await prisma.$transaction((tx) =>
        GrowthService.redeemWalletBalance(req.user.id, amount, description || 'Wallet redeem', tx)
    );

    res.json({
        message: 'Wallet redeemed successfully.',
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

// ── ExpertsHub PLUS (Sprint 17 - #74) ──────────────────────────────

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
 * Subscribe to ExpertsHub Plus demo
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
