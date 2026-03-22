const { body, param } = require('express-validator');

const walletTopupOrderSchema = [
  body('amount')
    .isFloat({ min: 1, max: 100000 })
    .withMessage('Amount must be between 1 and 100000')
    .toFloat(),
];

const walletTopupConfirmSchema = [
  body('paymentReference')
    .isString()
    .trim()
    .isLength({ min: 6, max: 128 })
    .withMessage('paymentReference is required'),
  body('paymentOrderId')
    .isString()
    .trim()
    .isLength({ min: 6, max: 128 })
    .withMessage('paymentOrderId is required'),
  body('paymentSignature')
    .isString()
    .trim()
    .isLength({ min: 16, max: 256 })
    .withMessage('paymentSignature is required'),
];

const walletAddCreditsSchema = [
  body('amount')
    .isFloat({ min: 1, max: 100000 })
    .withMessage('Amount must be between 1 and 100000')
    .toFloat(),
  body('description')
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Description must be up to 200 characters'),
  body('userId')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('userId must be a positive integer')
    .toInt(),
];

const applyReferralSchema = [
  body('code')
    .isString()
    .trim()
    .isLength({ min: 4, max: 32 })
    .withMessage('Referral code is required'),
];

const validateCouponSchema = [
  body('code')
    .isString()
    .trim()
    .isLength({ min: 3, max: 32 })
    .withMessage('Coupon code is required'),
  body('bookingAmount')
    .optional({ nullable: true })
    .isFloat({ min: 0, max: 1000000 })
    .withMessage('bookingAmount must be a valid amount')
    .toFloat(),
  body('serviceCategory')
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ min: 1, max: 80 })
    .withMessage('serviceCategory must be text'),
];

const toggleFavoriteSchema = [
  body('workerProfileId')
    .isInt({ min: 1 })
    .withMessage('workerProfileId must be a positive integer')
    .toInt(),
];

const workerProfileIdParamSchema = [
  param('workerProfileId')
    .isInt({ min: 1 })
    .withMessage('workerProfileId must be a positive integer')
    .toInt(),
];

const redeemPointsSchema = [
  body('points')
    .isInt({ min: 1, max: 1000000 })
    .withMessage('points must be a positive integer')
    .toInt(),
];

const subscribeProPlusSchema = [
  body('planId')
    .isString()
    .trim()
    .isIn(['plus_monthly', 'plus_yearly'])
    .withMessage('Invalid planId'),
];

const purchaseGiftCardSchema = [
  body('senderName')
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ min: 1, max: 80 })
    .withMessage('senderName must be 1-80 characters'),
  body('recipientEmail')
    .isEmail()
    .withMessage('recipientEmail must be valid')
    .normalizeEmail(),
  body('message')
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('message must be up to 500 characters'),
  body('amount')
    .isFloat({ min: 100, max: 10000 })
    .withMessage('Gift card amount must be between 100 and 10000')
    .toFloat(),
];

const redeemGiftCardSchema = [
  body('code')
    .isString()
    .trim()
    .isLength({ min: 6, max: 32 })
    .withMessage('Gift card code is required'),
];

const giftCardCodeParamSchema = [
  param('code')
    .isString()
    .trim()
    .isLength({ min: 6, max: 32 })
    .withMessage('Gift card code is required'),
];

module.exports = {
  walletTopupOrderSchema,
  walletTopupConfirmSchema,
  walletAddCreditsSchema,
  applyReferralSchema,
  validateCouponSchema,
  toggleFavoriteSchema,
  workerProfileIdParamSchema,
  redeemPointsSchema,
  subscribeProPlusSchema,
  purchaseGiftCardSchema,
  redeemGiftCardSchema,
  giftCardCodeParamSchema,
};
