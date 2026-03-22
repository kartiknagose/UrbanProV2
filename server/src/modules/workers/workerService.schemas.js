const { body, param, query } = require('express-validator');

const addServiceSchema = [
  body('serviceId')
    .notEmpty()
    .withMessage('Service ID is required')
    .isInt({ min: 1 })
    .withMessage('Service ID must be a positive integer'),
];

const removeServiceSchema = [
  param('serviceId')
    .isInt({ min: 1 })
    .withMessage('Service ID must be a positive integer'),
];

const workerIdParamSchema = [
  param('workerId')
    .isInt({ min: 1 })
    .withMessage('Worker ID must be a positive integer'),
];

const leaderboardQuerySchema = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];

module.exports = {
  addServiceSchema,
  removeServiceSchema,
  workerIdParamSchema,
  leaderboardQuerySchema,
};
