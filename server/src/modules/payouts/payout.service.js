const prisma = require('../../config/prisma');
const AppError = require('../../common/errors/AppError');
const { getRazorpayClient } = require('../payments/payment.service');
const { createNotification } = require('../notifications/notification.service');
const crypto = require('crypto');

const MIN_PAYOUT_THRESHOLD = 100.0;
const INSTANT_PAYOUT_FEE_PERCENT = 2.0;
const PAYOUT_MODE = (process.env.RAZORPAY_PAYOUT_MODE || 'SIMULATED').toUpperCase();
const SUPPORTED_PAYOUT_METHODS = ['BANK', 'UPI', 'LINKED_ACCOUNT'];

function roundMoney(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) {
        throw new AppError(400, 'Invalid amount.');
    }
    return Math.round(amount * 100) / 100;
}

function toPaise(value) {
    const paise = Math.round(roundMoney(value) * 100);
    if (!Number.isSafeInteger(paise) || paise <= 0) {
        throw new AppError(400, 'Invalid payout amount.');
    }
    return paise;
}

exports.getWorkerBankDetails = async (userId) => {
    const profile = await prisma.workerProfile.findUnique({
        where: { userId },
        select: {
            bankAccountNumber: true,
            bankIfsc: true,
            upiId: true,
            payoutMethod: true,
            walletBalance: true,
            razorpayAccountId: true,
            user: { select: { deletedAt: true, isActive: true } },
        }
    });

    if (!profile) throw new AppError(404, 'Worker profile not found');
    if (!profile.user || profile.user.deletedAt || !profile.user.isActive) throw new AppError(404, 'Worker profile not found');

    // Mask account number
    const maskedAcc = profile.bankAccountNumber ?
        'XXXX' + profile.bankAccountNumber.slice(-4) : null;

    const maskedUpi = profile.upiId
        ? `${String(profile.upiId).split('@')[0].slice(0, 2)}***@${String(profile.upiId).split('@')[1] || ''}`
        : null;

    return {
        ...profile,
        upiId: maskedUpi,
        bankAccountNumber: maskedAcc,
        isLinked: !!profile.razorpayAccountId,
        payoutMethod: profile.payoutMethod || 'BANK',
        availableMethods: SUPPORTED_PAYOUT_METHODS,
        payoutMode: PAYOUT_MODE,
    };
};

exports.updateWorkerBankDetails = async (userId, payload = {}) => {
    const profile = await prisma.workerProfile.findUnique({
        where: { userId },
        include: { user: { select: { deletedAt: true, isActive: true } } },
    });
    if (!profile) throw new AppError(404, 'Worker profile not found');
    if (!profile.user || profile.user.deletedAt || !profile.user.isActive) throw new AppError(404, 'Worker profile not found');

    const payoutMethod = String(payload.payoutMethod || 'BANK').toUpperCase();
    if (!SUPPORTED_PAYOUT_METHODS.includes(payoutMethod)) {
        throw new AppError(400, 'Unsupported payout method.');
    }

    const normalizedAcc = payload.bankAccountNumber ? String(payload.bankAccountNumber).replace(/\s+/g, '') : null;
    const normalizedIfsc = payload.bankIfsc ? String(payload.bankIfsc).trim().toUpperCase() : null;
    const normalizedUpiId = payload.upiId ? String(payload.upiId).trim().toLowerCase() : null;
    let accountId = payload.razorpayAccountId ? String(payload.razorpayAccountId).trim() : profile.razorpayAccountId;

    if (payoutMethod === 'BANK') {
        if (!normalizedAcc || !normalizedIfsc) {
            throw new AppError(400, 'Bank account number and IFSC are required for BANK payouts.');
        }
        if (!/^\d{9,18}$/.test(normalizedAcc)) {
            throw new AppError(400, 'Bank account number must be 9 to 18 digits.');
        }
        if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(normalizedIfsc)) {
            throw new AppError(400, 'Invalid IFSC format.');
        }
    }

    if (payoutMethod === 'UPI') {
        if (!normalizedUpiId) {
            throw new AppError(400, 'UPI ID is required for UPI payouts.');
        }
        if (!/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/.test(normalizedUpiId)) {
            throw new AppError(400, 'Invalid UPI ID format.');
        }
    }

    if (payoutMethod === 'LINKED_ACCOUNT' && !accountId) {
        throw new AppError(400, 'Razorpay linked account id is required for LINKED_ACCOUNT payouts.');
    }

    if (accountId && !/^acc_[A-Za-z0-9]+$/.test(accountId)) {
        throw new AppError(400, 'Invalid Razorpay account id format.');
    }

    // In simulated mode we auto-generate a stable testing account ID if none is provided.
    if (!accountId && PAYOUT_MODE !== 'LIVE') {
        accountId = `acc_test_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
    }

    if (PAYOUT_MODE === 'LIVE' && payoutMethod === 'LINKED_ACCOUNT' && !accountId) {
        throw new AppError(400, 'Razorpay linked account ID is required for linked-account payouts in live mode.');
    }

    const updateData = {
        payoutMethod,
        bankAccountNumber: payoutMethod === 'BANK' ? normalizedAcc : profile.bankAccountNumber,
        bankIfsc: payoutMethod === 'BANK' ? normalizedIfsc : profile.bankIfsc,
        upiId: payoutMethod === 'UPI' ? normalizedUpiId : profile.upiId,
        razorpayAccountId: accountId,
    };

    await prisma.workerProfile.update({
        where: { id: profile.id },
        data: updateData
    });

    return {
        isLinked: !!accountId,
        payoutMethod,
        availableMethods: SUPPORTED_PAYOUT_METHODS,
        payoutMode: PAYOUT_MODE,
    };
};

exports.processInstantPayout = async (userId) => {
    const profile = await prisma.workerProfile.findUnique({
        where: { userId },
        include: { user: { select: { deletedAt: true, isActive: true } } },
    });
    if (!profile) throw new AppError(404, 'Worker profile not found');
    if (!profile.user || profile.user.deletedAt || !profile.user.isActive) throw new AppError(404, 'Worker profile not found');

    const payoutMethod = String(profile.payoutMethod || 'BANK').toUpperCase();
    const hasBank = Boolean(profile.bankAccountNumber && profile.bankIfsc);
    const hasUpi = Boolean(profile.upiId);
    const hasLinked = Boolean(profile.razorpayAccountId);

    if (
        (payoutMethod === 'BANK' && !hasBank) ||
        (payoutMethod === 'UPI' && !hasUpi) ||
        (payoutMethod === 'LINKED_ACCOUNT' && !hasLinked)
    ) {
        throw new AppError(400, `Payout destination for ${payoutMethod} is not configured.`);
    }

    if (PAYOUT_MODE === 'LIVE' && payoutMethod !== 'LINKED_ACCOUNT' && !hasLinked) {
        throw new AppError(400, 'Live payout currently requires a linked Razorpay account id.');
    }

    const balance = roundMoney(profile.walletBalance);
    if (balance < MIN_PAYOUT_THRESHOLD) {
        throw new AppError(400, `Minimum payout threshold is ₹${MIN_PAYOUT_THRESHOLD}. Current balance: ₹${balance.toFixed(2)}`);
    }

    // Calculate 2% instant payout fee
    const fee = roundMoney(balance * (INSTANT_PAYOUT_FEE_PERCENT / 100));
    const payoutAmount = roundMoney(balance - fee);
    if (payoutAmount <= 0) {
        throw new AppError(400, 'Payout amount must be greater than zero after fees.');
    }

    return processRazorpayTransfer(profile, balance, payoutAmount);
};

exports.processDailyCronPayouts = async () => {
    console.log('[CRON] Starting daily automated payouts...');
    // Find all workers with balance >= 100 mapped to a Razorpay Account
    const eligibleWorkers = await prisma.workerProfile.findMany({
        where: {
            walletBalance: { gte: MIN_PAYOUT_THRESHOLD },
            razorpayAccountId: { not: null }
        },
        include: { user: { select: { id: true, deletedAt: true, isActive: true } } }
    });

    console.log(`[CRON] Found ${eligibleWorkers.length} eligible workers for payout.`);

    for (const profile of eligibleWorkers) {
        if (!profile.user || profile.user.deletedAt || !profile.user.isActive) {
            continue;
        }
        try {
            const balance = Number(profile.walletBalance);
            // Scheduled payouts have zero fees
            await processRazorpayTransfer(profile, balance, balance);
            console.log(`[CRON] Processed ₹${balance} payout for Worker ${profile.id}`);
        } catch (err) {
            console.error(`[CRON] Payout failed for Worker ${profile.id}:`, err.message);
        }
    }
};

async function processRazorpayTransfer(profile, deductBalance, payoutAmount) {
    const roundedDeductBalance = roundMoney(deductBalance);
    const roundedPayoutAmount = roundMoney(payoutAmount);

    if (roundedDeductBalance <= 0 || roundedPayoutAmount <= 0) {
        throw new AppError(400, 'Invalid payout amount.');
    }

    // First transaction: reserve funds + create processing record.
    const payoutRecord = await prisma.$transaction(async (tx) => {
        const reservation = await tx.workerProfile.updateMany({
            where: {
                id: profile.id,
                walletBalance: { gte: roundedDeductBalance }
            },
            data: { walletBalance: { decrement: roundedDeductBalance } }
        });

        if (reservation.count !== 1) {
            throw new AppError(409, 'Insufficient wallet balance for payout. Please refresh and try again.');
        }

        return tx.payout.create({
            data: {
                workerProfileId: profile.id,
                amount: roundedPayoutAmount,
                status: 'PROCESSING'
            }
        });
    }, {
        maxWait: 10000,
        timeout: 15000,
    });

    try {
        // External API call should stay out of interactive transaction.
        let transferId;

        const canUseLiveTransfer =
            PAYOUT_MODE === 'LIVE' &&
            typeof profile.razorpayAccountId === 'string' &&
            profile.razorpayAccountId.startsWith('acc_');

        if (canUseLiveTransfer) {
            const razorpay = await getRazorpayClient();
            const transfer = await razorpay.transfers.create({
                account: profile.razorpayAccountId,
                amount: toPaise(roundedPayoutAmount),
                currency: 'INR',
                notes: {
                    workerProfileId: String(profile.id),
                    payoutType: 'WORKER_WITHDRAWAL',
                },
            });
            transferId = transfer.id;
        } else {
            transferId = `trf_test_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
        }

        const updatedPayout = await prisma.payout.update({
            where: { id: payoutRecord.id },
            data: {
                status: 'PROCESSED',
                transferReference: transferId,
                processedAt: new Date()
            }
        });

        // Notify worker of successful payout
        try {
            await createNotification({
                userId: profile.userId,
                type: 'PAYOUT_SUCCESS',
                title: 'Payout successful',
                message: `₹${roundedPayoutAmount.toFixed(2)} has been transferred to your account.`,
                data: { payoutId: updatedPayout.id, amount: roundedPayoutAmount, transferId }
            });

            // Broadcast updated worker stats
            try {
                const { broadcastWorkerStats } = require('../workers/worker-stats.service');
                await broadcastWorkerStats(profile.userId);
            } catch (statsErr) {
                console.warn('Failed to broadcast worker stats:', statsErr.message);
            }
        } catch (notifyErr) {
            console.warn('Failed to send payout success notification:', notifyErr.message);
        }

        return updatedPayout;
    } catch (_apiError) {
        // Recovery transaction: refund reserved funds + mark failed.
        await prisma.$transaction(async (tx) => {
            await tx.workerProfile.update({
                where: { id: profile.id },
                data: { walletBalance: { increment: roundedDeductBalance } }
            });
            await tx.payout.update({
                where: { id: payoutRecord.id },
                data: { status: 'FAILED' }
            });
        }, {
            maxWait: 10000,
            timeout: 15000,
        });

        // Notify worker of failed payout
        try {
            await createNotification({
                userId: profile.userId,
                type: 'PAYOUT_FAILED',
                title: 'Payout failed',
                message: `Your payout attempt for ₹${roundedPayoutAmount.toFixed(2)} failed. Please try again or contact support.`,
                data: { payoutId: payoutRecord.id, amount: roundedPayoutAmount, error: _apiError.message }
            });
        } catch (notifyErr) {
            console.warn('Failed to send payout failure notification:', notifyErr.message);
        }

        throw new AppError(502, 'Payout gateway failed to process transfer. Please try again.');
    }
}

exports.getWorkerPayoutHistory = async (userId, { skip, limit }) => {
    const profile = await prisma.workerProfile.findUnique({ where: { userId } });
    if (!profile) throw new AppError(404, 'Worker profile not found');

    const safeSkip = Number.isInteger(skip) && skip >= 0 ? skip : 0;
    const safeLimit = Number.isInteger(limit) && limit > 0 && limit <= 100 ? limit : 20;

    const [data, total] = await Promise.all([
        prisma.payout.findMany({
            where: { workerProfileId: profile.id },
            orderBy: { createdAt: 'desc' },
            skip: safeSkip,
            take: safeLimit
        }),
        prisma.payout.count({ where: { workerProfileId: profile.id } })
    ]);
    return { data, total, pagination: { skip: safeSkip, limit: safeLimit, totalPages: Math.ceil(total / safeLimit) } };
};
