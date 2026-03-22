const prisma = require('../../config/prisma');
const AppError = require('../../common/errors/AppError');
const { getRazorpayClient } = require('../payments/payment.service');
const crypto = require('crypto');

const MIN_PAYOUT_THRESHOLD = 100.0;
const INSTANT_PAYOUT_FEE_PERCENT = 2.0;
const PAYOUT_MODE = (process.env.RAZORPAY_PAYOUT_MODE || 'SIMULATED').toUpperCase();

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
            walletBalance: true,
            razorpayAccountId: true
        }
    });

    if (!profile) throw new AppError(404, 'Worker profile not found');

    // Mask account number
    const maskedAcc = profile.bankAccountNumber ?
        'XXXX' + profile.bankAccountNumber.slice(-4) : null;

    return {
        ...profile,
        bankAccountNumber: maskedAcc,
        isLinked: !!profile.razorpayAccountId,
        payoutMode: PAYOUT_MODE,
    };
};

exports.updateWorkerBankDetails = async (userId, bankAccountNumber, bankIfsc, razorpayAccountId) => {
    const profile = await prisma.workerProfile.findUnique({ where: { userId }, include: { user: true } });
    if (!profile) throw new AppError(404, 'Worker profile not found');

    if (!bankAccountNumber || !bankIfsc) {
        throw new AppError(400, 'Bank Account Number and IFSC are required');
    }

    const normalizedAcc = String(bankAccountNumber).replace(/\s+/g, '');
    const normalizedIfsc = String(bankIfsc).trim().toUpperCase();
    if (!/^\d{9,18}$/.test(normalizedAcc)) {
        throw new AppError(400, 'Bank account number must be 9 to 18 digits.');
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(normalizedIfsc)) {
        throw new AppError(400, 'Invalid IFSC format.');
    }

    let accountId = razorpayAccountId ? String(razorpayAccountId).trim() : profile.razorpayAccountId;

    if (accountId && !/^acc_[A-Za-z0-9]+$/.test(accountId)) {
        throw new AppError(400, 'Invalid Razorpay account id format.');
    }

    // In simulated mode we auto-generate a stable testing account ID if none is provided.
    if (!accountId && PAYOUT_MODE !== 'LIVE') {
        accountId = `acc_test_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
    }

    if (PAYOUT_MODE === 'LIVE' && !accountId) {
        throw new AppError(400, 'Razorpay linked account ID is required for live payouts.');
    }

    await prisma.workerProfile.update({
        where: { id: profile.id },
        data: {
            bankAccountNumber: normalizedAcc,
            bankIfsc: normalizedIfsc,
            razorpayAccountId: accountId
        }
    });

    return {
        isLinked: !!accountId,
        payoutMode: PAYOUT_MODE,
    };
};

exports.processInstantPayout = async (userId) => {
    const profile = await prisma.workerProfile.findUnique({ where: { userId }, include: { user: true } });
    if (!profile) throw new AppError(404, 'Worker profile not found');

    if (!profile.razorpayAccountId) {
        throw new AppError(400, 'Bank account not linked yet for Payouts');
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
        include: { user: true }
    });

    console.log(`[CRON] Found ${eligibleWorkers.length} eligible workers for payout.`);

    for (const profile of eligibleWorkers) {
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
            const razorpay = getRazorpayClient();
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

        return prisma.payout.update({
            where: { id: payoutRecord.id },
            data: {
                status: 'PROCESSED',
                transferReference: transferId,
                processedAt: new Date()
            }
        });
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
