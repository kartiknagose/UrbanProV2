const { param, query } = require('express-validator');

const bookingInvoiceParamSchema = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Booking ID must be a positive integer')
    .toInt(),
];

const reportQuerySchema = [
  query('month')
    .optional()
    .isInt({ min: 1, max: 12 })
    .withMessage('Month must be between 1 and 12')
    .toInt(),
  query('year')
    .optional()
    .isInt({ min: 2020, max: 2100 })
    .withMessage('Year must be between 2020 and 2100')
    .toInt(),
];

module.exports = {
  bookingInvoiceParamSchema,
  reportQuerySchema,
};
