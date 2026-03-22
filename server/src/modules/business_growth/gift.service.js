const prisma = require('../../config/prisma');
const AppError = require('../../common/errors/AppError');
const { randomBytes } = require('crypto');
const GrowthService = require('./business_growth.service');

/**
 * GIFT CARD SERVICE (Sprint 17 - #76)
 */

/**
 * Purchase a gift card
 */
async function purchaseGiftCard({ senderName, recipientEmail, message, amount }) {
    const normalizedAmount = Number(amount);
    if (!Number.isFinite(normalizedAmount) || normalizedAmount < 100 || normalizedAmount > 10000) {
        throw new AppError(400, 'Gift card amount must be between ₹100 and ₹10,000.');
    }

    // Generate unique code (GIFT-XXXXX)
    const code = `GIFT-${randomBytes(4).toString('hex').toUpperCase()}`;
    
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1); // 1 year expiry

    const giftCard = await prisma.giftCard.create({
        data: {
            code,
            initialValue: normalizedAmount,
            balance: normalizedAmount,
            senderName: senderName || null,
            recipientEmail: String(recipientEmail || '').trim().toLowerCase(),
            message: message || null,
            expiryDate
        }
    });

    // In a real app, send email with the code to recipientEmail
    console.log(`[GIFT] Gift card created: ${code} for ${recipientEmail}`);

    return giftCard;
}

/**
 * Redeem a gift card into user's wallet
 */
async function redeemGiftCard(userId, code) {
    const normalizedCode = String(code || '').trim().toUpperCase();
    const giftCard = await prisma.giftCard.findUnique({ where: { code: normalizedCode } });

    if (!giftCard) throw new AppError(404, 'Invalid gift card code.');
    if (giftCard.isRedeemed || Number(giftCard.balance) <= 0) {
        throw new AppError(400, 'This gift card has already been redeemed.');
    }

    const now = new Date();
    if (now > giftCard.expiryDate) {
        throw new AppError(400, 'This gift card has expired.');
    }

    const amount = Number(giftCard.balance);

    return prisma.$transaction(async (tx) => {
        const marked = await tx.giftCard.updateMany({
            where: {
                id: giftCard.id,
                isRedeemed: false,
                balance: { gt: 0 },
                expiryDate: { gte: now },
            },
            data: {
                isRedeemed: true,
                redeemedBy: userId,
                balance: 0
            }
        });

        if (marked.count !== 1) {
            throw new AppError(409, 'This gift card has already been redeemed or expired.');
        }

        // 2. Add to user wallet
        await GrowthService.depositCredits(
            userId,
            amount,
            `Redeemed Gift Card ${giftCard.code}`,
            giftCard.code,
            tx
        );

        return { amount, code: giftCard.code };
    });
}

/**
 * Check gift card balance
 */
async function checkGiftCard(code) {
    const normalizedCode = String(code || '').trim().toUpperCase();
    const giftCard = await prisma.giftCard.findUnique({ where: { code: normalizedCode } });
    if (!giftCard) throw new AppError(404, 'Invalid gift card code.');

    const now = new Date();
    const isExpired = now > giftCard.expiryDate;

    return {
        code: giftCard.code,
        balance: Number(giftCard.balance),
        isRedeemed: giftCard.isRedeemed,
        isExpired,
        expiryDate: giftCard.expiryDate,
        sender: giftCard.senderName
    };
}

module.exports = {
    purchaseGiftCard,
    redeemGiftCard,
    checkGiftCard
};
