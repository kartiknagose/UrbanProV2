const { body } = require('express-validator');
const { query } = require('express-validator');
const { isValidUploadUrl } = require('../../common/utils/validateUploadUrl');

const applyVerificationSchema = [
  body('notes')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must be 1000 characters or less'),
  body('documents')
    .optional()
    .isArray({ max: 10 })
    .withMessage('Documents must be an array'),
  body('documents.*.type')
    .optional()
    .isIn([
      'ID_PROOF',
      'EXPERIENCE_LETTER',
      'CERTIFICATION',
      'PORTFOLIO',
      'ADDRESS_PROOF',
    ])
    .withMessage('Invalid document type'),
  body('documents.*.url')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 500 })
    .notEmpty()
    .withMessage('Document URL is required')
    .custom((value) => {
      if (!isValidUploadUrl(value, ['/uploads/verification-docs/'])) {
        throw new Error('Document URL must come from the verification upload endpoint');
      }
      return true;
    }),
];

const reviewVerificationSchema = [
  body('status')
    .notEmpty()
    .isIn(['PENDING', 'APPROVED', 'REJECTED', 'MORE_INFO'])
    .withMessage('Status must be one of: PENDING, APPROVED, REJECTED, MORE_INFO'),
  body('score')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Score must be between 0 and 100'),
  body('notes')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must be 1000 characters or less'),
  body('level')
    .optional()
    .isIn(['BASIC', 'DOCUMENTS', 'VERIFIED', 'PREMIUM'])
    .withMessage('Verification level must be one of: BASIC, DOCUMENTS, VERIFIED, PREMIUM'),
];

const listApplicationsQuerySchema = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 100000 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];

module.exports = {
  applyVerificationSchema,
  reviewVerificationSchema,
  listApplicationsQuerySchema,
};
