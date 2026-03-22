const { body, param } = require('express-validator');

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const toMinutes = (time) => {
  const [hours, minutes] = String(time).split(':').map(Number);
  return hours * 60 + minutes;
};

const createAvailabilitySchema = [
  body('dayOfWeek')
    .notEmpty()
    .withMessage('Day of week is required')
    .isInt({ min: 0, max: 6 })
    .withMessage('Day of week must be between 0 (Sunday) and 6 (Saturday)'),
  body('startTime')
    .notEmpty()
    .withMessage('Start time is required')
    .isString()
    .trim()
    .matches(timePattern)
    .withMessage('Start time must be in HH:mm format'),
  body('endTime')
    .notEmpty()
    .withMessage('End time is required')
    .isString()
    .trim()
    .matches(timePattern)
    .withMessage('End time must be in HH:mm format')
    .custom((value, { req }) => {
      const start = toMinutes(req.body.startTime);
      const end = toMinutes(value);
      if (start >= end) {
        throw new Error('Start time must be before end time');
      }
      return true;
    }),
];

const removeAvailabilitySchema = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Availability ID must be a positive integer'),
];

module.exports = {
  createAvailabilitySchema,
  removeAvailabilitySchema,
};
