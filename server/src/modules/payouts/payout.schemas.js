const { body, query } = require('express-validator');

const updateBankDetailsSchema = [
  body('bankAccountNumber')
    .notEmpty().withMessage('Bank account number is required')
    .isString().withMessage('Bank account number must be text')
    .trim()
    .custom((value) => {
      const normalized = String(value || '').replace(/\s+/g, '');
      if (!/^\d{9,18}$/.test(normalized)) {
        throw new Error('Bank account number must be 9 to 18 digits.');
      }
      return true;
    }),
  body('bankIfsc')
    .notEmpty().withMessage('IFSC is required')
    .isString().withMessage('IFSC must be text')
    .trim()
    .toUpperCase()
    .matches(/^[A-Z]{4}0[A-Z0-9]{6}$/)
    .withMessage('Invalid IFSC format.'),
  body('razorpayAccountId')
    .optional({ nullable: true })
    .isString().withMessage('Razorpay account id must be text')
    .trim()
    .isLength({ min: 6, max: 64 }).withMessage('Razorpay account id is invalid')
    .matches(/^acc_[A-Za-z0-9]+$/).withMessage('Razorpay account id must start with acc_'),
];

const payoutHistoryQuerySchema = [
  query('skip')
    .optional()
    .isInt({ min: 0, max: 1000000 }).withMessage('Skip must be a non-negative integer')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
    .toInt(),
];

module.exports = {
  updateBankDetailsSchema,
  payoutHistoryQuerySchema,
};
