const asyncHandler = require('../../common/utils/asyncHandler');
const parseId = require('../../common/utils/parseId');
const parsePagination = require('../../common/utils/parsePagination');
const chatService = require('./chat.service');

const getOrCreateConversation = asyncHandler(async (req, res) => {
    const bookingId = parseId(req.params.bookingId, 'Booking ID');
    const conversation = await chatService.getOrCreateConversation(bookingId, req.user.id, req.user.role);
    res.status(200).json({ conversation });
});

const sendMessage = asyncHandler(async (req, res) => {
    const conversationId = parseId(req.params.conversationId, 'Conversation ID');
    const message = await chatService.sendMessage(conversationId, req.user.id, req.body);
    res.status(201).json({ message });
});

const getMessages = asyncHandler(async (req, res) => {
    const conversationId = parseId(req.params.conversationId, 'Conversation ID');
    const { page, limit, skip } = parsePagination(req.query);
    const { data: messages, total } = await chatService.getMessages(conversationId, req.user.id, { skip, limit });
    res.status(200).json({ messages, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

const getUserConversations = asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const { data: conversations, total } = await chatService.getUserConversations(req.user.id, { skip, limit });
    res.status(200).json({ conversations, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

module.exports = {
    getOrCreateConversation,
    sendMessage,
    getMessages,
    getUserConversations
};
