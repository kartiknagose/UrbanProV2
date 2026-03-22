const { body } = require('express-validator');

const createReviewSchema = [
  body('bookingId')
    .notEmpty()
    .withMessage('Booking ID is required')
    .isInt({ min: 1 })
    .withMessage('Booking ID must be a positive integer')
    .toInt(),
  body('rating')
    .notEmpty()
    .withMessage('Rating is required')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5')
    .toInt(),
  body('comment')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 5, max: 1000 })
    .withMessage('Comment must be between 5 and 1000 characters'),
];

module.exports = {
  createReviewSchema,
};
