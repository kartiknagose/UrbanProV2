const { body } = require('express-validator');
const { param } = require('express-validator');
const { isValidUploadUrl } = require('../../common/utils/validateUploadUrl');

const sendMessageSchema = [
  body('content')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 2000 }).withMessage('Message must be 2000 characters or fewer'),
  body('type')
    .optional()
    .isIn(['TEXT', 'IMAGE', 'DOCUMENT', 'VOICE']).withMessage('Invalid message type'),
  body('mediaUrl')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 500 })
    .custom((value) => {
      if (!isValidUploadUrl(value, ['/uploads/chat-attachments/'])) {
        throw new Error('Invalid media URL');
      }
      return true;
    }),
  body('fileName')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 255 }).withMessage('File name is too long'),
  body('fileSize')
    .optional()
    .isInt({ min: 1, max: 25 * 1024 * 1024 }).withMessage('File size must be between 1 byte and 25MB'),
  body()
    .custom((value, { req }) => {
      const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
      const mediaUrl = typeof req.body.mediaUrl === 'string' ? req.body.mediaUrl.trim() : '';
      if (!content && !mediaUrl) {
        throw new Error('Either message content or media URL is required');
      }
      return true;
    }),
];

const conversationIdParamSchema = [
  param('conversationId')
    .isInt({ min: 1 })
    .withMessage('Conversation ID must be a positive integer')
    .toInt(),
];

const bookingIdParamSchema = [
  param('bookingId')
    .isInt({ min: 1 })
    .withMessage('Booking ID must be a positive integer')
    .toInt(),
];

module.exports = {
  sendMessageSchema,
  conversationIdParamSchema,
  bookingIdParamSchema,
};
