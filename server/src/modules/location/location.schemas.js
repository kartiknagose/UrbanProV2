const { body, param, query } = require('express-validator');

const updateLocationSchema = [
  body('latitude')
    .notEmpty().withMessage('Latitude is required')
    .isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90')
    .toFloat(),
  body('longitude')
    .notEmpty().withMessage('Longitude is required')
    .isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180')
    .toFloat(),
  body('isOnline')
    .optional({ nullable: true })
    .isBoolean().withMessage('isOnline must be a boolean')
    .toBoolean(),
];

const getNearbyWorkersSchema = [
  query('lat')
    .notEmpty().withMessage('Latitude is required')
    .isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90')
    .toFloat(),
  query('lng')
    .notEmpty().withMessage('Longitude is required')
    .isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180')
    .toFloat(),
  query('radius')
    .optional()
    .isFloat({ min: 1, max: 100 }).withMessage('Radius must be between 1 and 100 km')
    .toFloat(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
    .toInt(),
];

const getWorkerLocationSchema = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Worker ID must be a positive integer')
    .toInt(),
];

const getCityServicesSchema = [
  param('slug')
    .isSlug()
    .withMessage('City slug must be a valid slug'),
];

module.exports = {
  updateLocationSchema,
  getNearbyWorkersSchema,
  getWorkerLocationSchema,
  getCityServicesSchema,
};
