const { body } = require('express-validator');

const addServiceSchema = [
  body('serviceId')
    .notEmpty()
    .withMessage('Service ID is required')
    .isInt({ min: 1 })
    .withMessage('Service ID must be a positive integer'),
];

module.exports = {
  addServiceSchema,
};
