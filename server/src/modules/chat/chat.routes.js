const express = require('express');
const router = express.Router();
const chatController = require('./chat.controller');
const authenticate = require('../../middleware/auth');
const validate = require('../../middleware/validation');
const { sendMessageSchema, conversationIdParamSchema, bookingIdParamSchema } = require('./chat.schemas');

router.use(authenticate);

router.get('/conversations', chatController.getUserConversations);
router.get('/booking/:bookingId', bookingIdParamSchema, validate, chatController.getOrCreateConversation);
router.get('/:conversationId/messages', conversationIdParamSchema, validate, chatController.getMessages);
router.post('/:conversationId/messages', conversationIdParamSchema, sendMessageSchema, validate, chatController.sendMessage);

module.exports = router;
