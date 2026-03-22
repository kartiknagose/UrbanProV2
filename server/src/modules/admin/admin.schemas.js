const { body, query, param } = require('express-validator');

const VALID_ROLES = ['CUSTOMER', 'WORKER', 'ADMIN'];

const getUsersSchema = [
  query('role')
    .optional()
    .toUpperCase()
    .isIn(VALID_ROLES)
    .withMessage(`Role must be one of: ${VALID_ROLES.join(', ')}`),
];

const updateUserStatusSchema = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer')
    .toInt(),
  body('isActive')
    .exists({ checkNull: true })
    .withMessage('isActive is required')
    .isBoolean()
    .withMessage('isActive must be a boolean')
    .toBoolean(),
];

const listWorkersSchema = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 100000 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];

const userIdParamSchema = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer')
    .toInt(),
];

const couponIdParamSchema = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Coupon ID must be a positive integer')
    .toInt(),
];

const createCouponSchema = [
  body('code')
    .isString()
    .trim()
    .isLength({ min: 3, max: 32 })
    .withMessage('Coupon code must be 3-32 characters')
    .matches(/^[A-Za-z0-9_-]+$/)
    .withMessage('Coupon code can only contain letters, numbers, underscore, and hyphen'),
  body('discountType')
    .isIn(['PERCENTAGE', 'FIXED'])
    .withMessage('discountType must be PERCENTAGE or FIXED'),
  body('discountValue')
    .isFloat({ min: 0.01, max: 100000 })
    .withMessage('discountValue must be a positive number')
    .toFloat(),
  body('minOrderValue')
    .optional({ nullable: true })
    .isFloat({ min: 0, max: 1000000 })
    .withMessage('minOrderValue must be a non-negative number')
    .toFloat(),
  body('maxDiscount')
    .optional({ nullable: true })
    .isFloat({ min: 0, max: 1000000 })
    .withMessage('maxDiscount must be a non-negative number')
    .toFloat(),
  body('usageLimit')
    .optional({ nullable: true })
    .isInt({ min: 1, max: 1000000 })
    .withMessage('usageLimit must be a positive integer')
    .toInt(),
  body('applicableTo')
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ min: 2, max: 80 })
    .withMessage('applicableTo must be 2-80 characters'),
  body('firstTimeOnly')
    .optional({ nullable: true })
    .isBoolean()
    .withMessage('firstTimeOnly must be boolean')
    .toBoolean(),
  body('isActive')
    .optional({ nullable: true })
    .isBoolean()
    .withMessage('isActive must be boolean')
    .toBoolean(),
  body('startDate')
    .optional({ nullable: true })
    .isISO8601()
    .withMessage('startDate must be a valid date'),
  body('endDate')
    .optional({ nullable: true })
    .isISO8601()
    .withMessage('endDate must be a valid date')
    .custom((value, { req }) => {
      const start = req.body.startDate ? new Date(req.body.startDate) : null;
      const end = value ? new Date(value) : null;
      if (start && end && end <= start) {
        throw new Error('endDate must be after startDate');
      }
      return true;
    }),
];

const updateCouponStatusSchema = [
  ...couponIdParamSchema,
  body('isActive')
    .exists({ checkNull: true })
    .withMessage('isActive is required')
    .isBoolean()
    .withMessage('isActive must be a boolean')
    .toBoolean(),
];

module.exports = {
  getUsersSchema,
  updateUserStatusSchema,
  listWorkersSchema,
  userIdParamSchema,
  couponIdParamSchema,
  createCouponSchema,
  updateCouponStatusSchema,
};
