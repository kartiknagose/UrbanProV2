const { body, param, query } = require('express-validator');

const triggerSosSchema = [
  body('bookingId')
    .notEmpty().withMessage('Booking ID is required')
    .isInt({ min: 1 }).withMessage('Booking ID must be a positive integer')
    .toInt(),
  body('location')
    .optional({ nullable: true })
    .isObject().withMessage('Location must be an object'),
  body('location.latitude')
    .optional({ nullable: true })
    .isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90')
    .toFloat(),
  body('location.longitude')
    .optional({ nullable: true })
    .isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180')
    .toFloat(),
];

const addContactSchema = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be 2–100 characters'),
  body('phone')
    .trim()
    .isMobilePhone('any', { strictMode: false })
    .withMessage('A valid phone number is required'),
  body('relation')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Relation must be 2–50 characters'),
];

const deleteContactSchema = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Contact ID must be a positive integer')
    .toInt(),
];

const listSosAlertsQuerySchema = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 100000 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];

const updateSosAlertStatusSchema = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Alert ID must be a positive integer')
    .toInt(),
  body('status')
    .notEmpty()
    .isIn(['ACKNOWLEDGED', 'RESOLVED'])
    .withMessage('Status must be ACKNOWLEDGED or RESOLVED'),
];

module.exports = {
  triggerSosSchema,
  addContactSchema,
  deleteContactSchema,
  listSosAlertsQuerySchema,
  updateSosAlertStatusSchema,
};
