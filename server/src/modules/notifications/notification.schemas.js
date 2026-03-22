const { body } = require('express-validator');

const subscribeSchema = [
  body('subscription')
    .exists().withMessage('Subscription is required')
    .isObject().withMessage('Subscription must be an object'),
  body('subscription.endpoint')
    .isString().withMessage('Subscription endpoint is required')
    .trim()
    .isURL({ require_protocol: true }).withMessage('Subscription endpoint must be a valid URL')
    .isLength({ max: 2000 }).withMessage('Subscription endpoint is too long'),
  body('subscription.keys')
    .exists().withMessage('Subscription keys are required')
    .isObject().withMessage('Subscription keys must be an object'),
  body('subscription.keys.p256dh')
    .isString().withMessage('p256dh key is required')
    .trim()
    .isLength({ min: 20, max: 500 }).withMessage('Invalid p256dh key length'),
  body('subscription.keys.auth')
    .isString().withMessage('auth key is required')
    .trim()
    .isLength({ min: 8, max: 200 }).withMessage('Invalid auth key length'),
];

const unsubscribeSchema = [
  body('endpoint')
    .isString().withMessage('Endpoint is required')
    .trim()
    .isURL({ require_protocol: true }).withMessage('Endpoint must be a valid URL')
    .isLength({ max: 2000 }).withMessage('Endpoint is too long'),
];

const updatePreferencesSchema = [
  body('pushEnabled').optional().isBoolean().withMessage('pushEnabled must be boolean').toBoolean(),
  body('emailEnabled').optional().isBoolean().withMessage('emailEnabled must be boolean').toBoolean(),
  body('inAppEnabled').optional().isBoolean().withMessage('inAppEnabled must be boolean').toBoolean(),
  body('bookingUpdates').optional().isBoolean().withMessage('bookingUpdates must be boolean').toBoolean(),
  body('reviewAlerts').optional().isBoolean().withMessage('reviewAlerts must be boolean').toBoolean(),
  body('paymentAlerts').optional().isBoolean().withMessage('paymentAlerts must be boolean').toBoolean(),
  body('chatMessages').optional().isBoolean().withMessage('chatMessages must be boolean').toBoolean(),
  body('promotions').optional().isBoolean().withMessage('promotions must be boolean').toBoolean(),
  body('systemAlerts').optional().isBoolean().withMessage('systemAlerts must be boolean').toBoolean(),
];

module.exports = {
  subscribeSchema,
  unsubscribeSchema,
  updatePreferencesSchema,
};
