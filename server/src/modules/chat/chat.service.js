const prisma = require('../../config/prisma');
const AppError = require('../../common/errors/AppError');
const { getIo } = require('../../socket');
const notificationService = require('../notifications/notification.service');
const { sanitizeText } = require('../../common/utils/sanitize');

/**
 * Get or create a conversation for a booking
 */
async function getOrCreateConversation(bookingId, userId, role) {
    const parsedBookingId = Number(bookingId);
    if (!Number.isInteger(parsedBookingId) || parsedBookingId < 1) {
        throw new AppError(400, 'Invalid booking ID');
    }

    const booking = await prisma.booking.findUnique({
        where: { id: parsedBookingId },
        include: {
            workerProfile: { select: { id: true, userId: true } }
        }
    });

    if (!booking) throw new AppError(404, 'Booking not found');
    if (!booking.workerProfileId) throw new AppError(400, 'No worker assigned to this booking yet');

    const workerUserId = booking.workerProfile.userId;
    const customerId = booking.customerId;

    // Check if user is part of this booking
    if (role === 'CUSTOMER' && userId !== customerId) throw new AppError(403, 'Unauthorized');
    if (role === 'WORKER' && userId !== workerUserId) throw new AppError(403, 'Unauthorized');
    if (!['CUSTOMER', 'WORKER', 'ADMIN'].includes(role)) throw new AppError(403, 'Unauthorized');

    let conversation = await prisma.conversation.findUnique({
        where: { bookingId: parsedBookingId }
    });

    if (!conversation) {
        conversation = await prisma.conversation.create({
            data: {
                bookingId: parsedBookingId,
                customerId,
                workerUserId
            }
        });
    }

    return conversation;
}

/**
 * Send a message
 */
async function sendMessage(conversationId, senderId, { content, type = 'TEXT', mediaUrl, fileName, fileSize }) {
    const parsedConversationId = Number(conversationId);
    if (!Number.isInteger(parsedConversationId) || parsedConversationId < 1) {
        throw new AppError(400, 'Invalid conversation ID');
    }

    const normalizedContent = typeof content === 'string' ? content.trim() : '';
    const normalizedMediaUrl = typeof mediaUrl === 'string' ? mediaUrl.trim() : '';
    const normalizedFileName = typeof fileName === 'string' ? fileName.trim() : '';
    const normalizedFileSize = fileSize !== undefined && fileSize !== null ? Number(fileSize) : undefined;

    const conversation = await prisma.conversation.findUnique({
        where: { id: parsedConversationId }
    });

    if (!conversation) throw new AppError(404, 'Conversation not found');
    if (conversation.customerId !== senderId && conversation.workerUserId !== senderId) {
        throw new AppError(403, 'Unauthorized to send message in this conversation');
    }

    const messageData = {
        conversationId: parsedConversationId,
        senderId,
        type
    };

    if (normalizedContent) {
        messageData.content = sanitizeText(normalizedContent);
        
        // FRAUD DETECTION: Off-platform sharing (Sprint 17 - #226)
        const lowerContent = normalizedContent.toLowerCase();
        const contactPatterns = [
            /[0-9]{10}/, // Phone numbers
            /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // Emails
            /whatsapp/, /gpay/, /paytm/, /phonepe/, /upi/
        ];
        
        const isSuspicious = contactPatterns.some(p => p.test(lowerContent));
        if (isSuspicious) {
            throw new AppError(400, 'Message contains prohibited contact or payment details.');
        }
    }
    if (normalizedMediaUrl) messageData.mediaUrl = normalizedMediaUrl;
    if (normalizedFileName) messageData.fileName = sanitizeText(normalizedFileName);
    if (normalizedFileSize !== undefined && Number.isInteger(normalizedFileSize) && normalizedFileSize > 0) {
        messageData.fileSize = normalizedFileSize;
    }

    const message = await prisma.message.create({
        data: messageData,
        include: {
            sender: { select: { id: true, name: true, profilePhotoUrl: true } }
        }
    });

    // Update lastMessageAt
    await prisma.conversation.update({
        where: { id: Number(conversationId) },
        data: { lastMessageAt: new Date() }
    });

    // Emit to socket (non-critical — message is already persisted)
    try {
        const io = getIo();
        io.to(`user:${conversation.customerId}`).emit('chat:message', message);
        io.to(`user:${conversation.workerUserId}`).emit('chat:message', message);
    } catch (_err) {
        console.warn('Socket.IO not available for chat notification');
    }

    // Create persistent notification for the recipient (non-blocking)
    const recipientId = conversation.customerId === senderId ? conversation.workerUserId : conversation.customerId;
    const notificationPreview = normalizedContent
        ? (normalizedContent.length > 50 ? normalizedContent.substring(0, 47) + '...' : normalizedContent)
        : (type === 'IMAGE' ? 'Sent an image' : type === 'DOCUMENT' ? 'Sent a document' : type === 'VOICE' ? 'Sent a voice message' : 'New message');

    notificationService.createNotification({
        userId: recipientId,
        type: 'CHAT',
        title: `New message from ${message.sender.name}`,
        message: notificationPreview,
        data: { conversationId: conversation.id, bookingId: conversation.bookingId }
    }).catch((err) => console.error('Failed to create chat notification:', err.message));

    return message;
}

/**
 * Get messages for a conversation
 */
async function getMessages(conversationId, userId, { skip = 0, limit = 50 } = {}) {
    const parsedConversationId = Number(conversationId);
    if (!Number.isInteger(parsedConversationId) || parsedConversationId < 1) {
        throw new AppError(400, 'Invalid conversation ID');
    }

    const conversation = await prisma.conversation.findUnique({
        where: { id: parsedConversationId }
    });

    if (!conversation) throw new AppError(404, 'Conversation not found');
    if (conversation.customerId !== userId && conversation.workerUserId !== userId) {
        throw new AppError(403, 'Unauthorized');
    }

    const where = { conversationId: parsedConversationId };
    const [data, total] = await Promise.all([
        prisma.message.findMany({
            where,
            orderBy: { createdAt: 'asc' },
            include: {
                sender: { select: { id: true, name: true, profilePhotoUrl: true } }
            },
            skip,
            take: limit,
        }),
        prisma.message.count({ where }),
    ]);
    return { data, total };
}

/**
 * Get user conversations
 */
async function getUserConversations(userId, { skip = 0, limit = 20 } = {}) {
    const where = {
        OR: [
            { customerId: userId },
            { workerUserId: userId }
        ]
    };
    const [data, total] = await Promise.all([
        prisma.conversation.findMany({
            where,
            include: {
                customer: { select: { id: true, name: true, profilePhotoUrl: true } },
                worker: { select: { id: true, name: true, profilePhotoUrl: true } },
                booking: {
                    include: {
                        service: { select: { name: true } }
                    }
                },
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            },
            orderBy: { lastMessageAt: 'desc' },
            skip,
            take: limit,
        }),
        prisma.conversation.count({ where }),
    ]);
    return { data, total };
}

module.exports = {
    getOrCreateConversation,
    sendMessage,
    getMessages,
    getUserConversations
};
