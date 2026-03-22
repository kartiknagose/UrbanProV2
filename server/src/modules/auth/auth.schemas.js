const { body, query } = require('express-validator');

const registerSchema = [
  body('name').trim().isLength({ min: 2, max: 80 }).withMessage('Name must be between 2 and 80 characters'),
  body('email').trim().normalizeEmail().isEmail().withMessage('Valid email required'),
  body('mobile').trim().matches(/^\d{10,15}$/).withMessage('Valid mobile number required'),
  body('password')
    .isLength({ min: 8, max: 128 }).withMessage('Password must be 8-128 characters')
    .matches(/^(?=.*[A-Za-z])(?=.*\d).+$/).withMessage('Password must include at least one letter and one number'),
  body('role').optional().isIn(['CUSTOMER', 'WORKER']).withMessage('Role must be CUSTOMER or WORKER'),
];

// Customer registration schema — forces role to CUSTOMER.
const registerCustomerSchema = [
  body('name').trim().isLength({ min: 2, max: 80 }).withMessage('Name must be between 2 and 80 characters'),
  body('email').trim().normalizeEmail().isEmail().withMessage('Valid email required'),
  body('mobile').trim().matches(/^\d{10,15}$/).withMessage('Valid mobile number required'),
  body('password')
    .isLength({ min: 8, max: 128 }).withMessage('Password must be 8-128 characters')
    .matches(/^(?=.*[A-Za-z])(?=.*\d).+$/).withMessage('Password must include at least one letter and one number'),
  (req, _res, next) => { req.body.role = 'CUSTOMER'; next(); },
];

// Worker registration schema — forces role to WORKER so the client doesn't need to send it
const registerWorkerSchema = [
  body('name').trim().isLength({ min: 2, max: 80 }).withMessage('Name must be between 2 and 80 characters'),
  body('email').trim().normalizeEmail().isEmail().withMessage('Valid email required'),
  body('mobile').trim().matches(/^\d{10,15}$/).withMessage('Valid mobile number required'),
  body('password')
    .isLength({ min: 8, max: 128 }).withMessage('Password must be 8-128 characters')
    .matches(/^(?=.*[A-Za-z])(?=.*\d).+$/).withMessage('Password must include at least one letter and one number'),
  // Inject role=WORKER into req.body so the unified register handler picks it up
  (req, _res, next) => { req.body.role = 'WORKER'; next(); },
];

const loginSchema = [
  body('email').trim().normalizeEmail().isEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
];

const verifyEmailSchema = [
  query('token').trim().isLength({ min: 32, max: 256 }).withMessage('Verification token required'),
];

const forgotPasswordSchema = [
  body('email').trim().normalizeEmail().isEmail().withMessage('Valid email required'),
];

const resetPasswordSchema = [
  body('token').trim().isLength({ min: 32, max: 256 }).withMessage('Reset token required'),
  body('password')
    .isLength({ min: 8, max: 128 }).withMessage('Password must be 8-128 characters')
    .matches(/^(?=.*[A-Za-z])(?=.*\d).+$/).withMessage('Password must include at least one letter and one number'),
];

const changePasswordSchema = [
  body('currentPassword').notEmpty().withMessage('Current password required'),
  body('newPassword')
    .isLength({ min: 8, max: 128 }).withMessage('New password must be 8-128 characters')
    .matches(/^(?=.*[A-Za-z])(?=.*\d).+$/).withMessage('New password must include at least one letter and one number')
    .custom((value, { req }) => value !== req.body.currentPassword).withMessage('New password must be different from current password'),
];

module.exports = {
  registerSchema,
  registerCustomerSchema,
  registerWorkerSchema,
  loginSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
};