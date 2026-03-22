const { body } = require('express-validator');

// Validate customer profile setup (address + optional profile photo URL)
const customerProfileSchema = [
  body('name')
    .optional({ nullable: true, checkFalsy: true })
    .isString().withMessage('Name must be text')
    .trim()
    .isLength({ min: 2, max: 80 }).withMessage('Name must be between 2 and 80 characters'),

  body('line1')
    .notEmpty().withMessage('Address line 1 is required')
    .isString().withMessage('Address line 1 must be text')
    .trim()
    .isLength({ min: 3, max: 200 }).withMessage('Address line 1 must be between 3 and 200 characters'),
  body('line2')
    .optional({ nullable: true, checkFalsy: true })
    .isString().withMessage('Address line 2 must be text')
    .trim()
    .isLength({ max: 200 }).withMessage('Address line 2 must be under 200 characters'),
  body('city')
    .notEmpty().withMessage('City is required')
    .isString().withMessage('City must be text')
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('City must be between 2 and 100 characters'),
  body('state')
    .notEmpty().withMessage('State is required')
    .isString().withMessage('State must be text')
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('State must be between 2 and 100 characters'),
  body('postalCode')
    .notEmpty().withMessage('Postal code is required')
    .isString().withMessage('Postal code must be text')
    .trim()
    .isLength({ min: 3, max: 20 }).withMessage('Postal code must be between 3 and 20 characters')
    .matches(/^[A-Za-z0-9\-\s]+$/).withMessage('Postal code can only contain letters, numbers, spaces, and hyphens'),
  body('country')
    .notEmpty().withMessage('Country is required')
    .isString().withMessage('Country must be text')
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Country must be between 2 and 100 characters'),
  body('profilePhotoUrl')
    .optional({ nullable: true, checkFalsy: true })
    .isString().withMessage('Profile photo must be a valid path')
    .trim()
    .isLength({ max: 500 }).withMessage('Profile photo path is too long'),
];

module.exports = { customerProfileSchema };
