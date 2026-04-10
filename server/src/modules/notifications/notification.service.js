const prisma = require('../../config/prisma');
const { pushToUser } = require('./push.service');
const { shouldNotify } = require('./preference.service');
const logger = require('../../config/logger');
const NOTIFICATION_DELIVERY_TIMEOUT_MS = 8000;

let getIo;
try {
    ({ getIo } = require('../../socket'));
} catch (_err) {
    getIo = null;
}

async function createNotification({ userId, type, title, message, data }) {
    let notification;
    try {
        notification = await prisma.notification.create({
            data: {
                userId,
                type,
                title,
                message,
                data: data || {}
            }
        });

    } catch (error) {
        console.error('Error creating notification:', error);
        return null;
    }

    // Fanout should never slow down the request path that creates a notification.
    setImmediate(() => {
        Promise.allSettled([
            deliverInAppNotification(userId, type, notification),
            deliverPushNotification(userId, type, title, message, data, notification.id),
        ]).catch(() => {});
    });

    return notification;
}

async function withTimeout(promise, timeoutMs) {
    return Promise.race([
        promise,
        new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
}

async function deliverInAppNotification(userId, type, notification) {
    try {
        const sendInApp = await withTimeout(shouldNotify(userId, 'inApp', type), NOTIFICATION_DELIVERY_TIMEOUT_MS);
        if (!sendInApp) return;

        const io = getIo ? getIo() : null;
        if (io) {
            io.to(`user:${userId}`).emit('notification:new', notification);
        }
    } catch (error) {
        console.warn('In-app notification delivery failed:', error.message);
    }
}

async function deliverPushNotification(userId, type, title, message, data, notificationId) {
    try {
        const sendPush = await withTimeout(shouldNotify(userId, 'push', type), NOTIFICATION_DELIVERY_TIMEOUT_MS);
        if (!sendPush) return;

        await withTimeout(
            pushToUser(userId, {
                title,
                body: message,
                icon: '/pwa-192x192.png',
                badge: '/pwa-64x64.png',
                tag: `${type}-${notificationId}`,
                data: { url: data?.url || getNotificationUrl(type, data), ...(data || {}) },
            }),
            NOTIFICATION_DELIVERY_TIMEOUT_MS
        );
    } catch (error) {
        console.warn('Push notification delivery failed:', error.message);
    }
}

/**
 * Generate a URL to navigate to when the user clicks the push notification.
 */
function getNotificationUrl(type, data) {
    if (!data) return '/';
    switch (type) {
        case 'BOOKING_UPDATE':
            return data.bookingId ? `/bookings/${data.bookingId}` : '/dashboard';
        case 'BOOKING_REPORT':
            return data.bookingId ? `/bookings/${data.bookingId}` : '/admin/reports';
        case 'REVIEW_RECEIVED':
            return '/reviews';
        case 'PAYMENT':
            return data.bookingId ? `/bookings/${data.bookingId}` : '/payments';
        case 'CHAT':
            return '/messages';
        default:
            return '/';
    }
}

async function getUserNotifications(userId, { skip = 0, limit = 20 } = {}) {
    const where = { userId };
    try {
        const [data, total] = await Promise.all([
            prisma.notification.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.notification.count({ where }),
        ]);
        return { data, total, degraded: false };
    } catch (error) {
        // Keep UI usable during transient DB/network outages.
        logger.warn('Notifications unavailable, returning empty list: %s', error.message);
        return { data: [], total: 0, degraded: true };
    }
}

async function markAsRead(notificationId, userId) {
    try {
        return await prisma.notification.updateMany({
            where: { id: notificationId, userId },
            data: { read: true }
        });
    } catch (error) {
        logger.warn('Failed to mark notification as read: %s', error.message);
        return { count: 0 };
    }
}

async function markAllAsRead(userId) {
    try {
        return await prisma.notification.updateMany({
            where: { userId, read: false },
            data: { read: true }
        });
    } catch (error) {
        logger.warn('Failed to mark all notifications as read: %s', error.message);
        return { count: 0 };
    }
}

async function getUnreadCount(userId) {
    try {
        return await prisma.notification.count({
            where: { userId, read: false }
        });
    } catch (error) {
        logger.warn('Unread notification count unavailable, defaulting to 0: %s', error.message);
        return 0;
    }
}

module.exports = {
    createNotification,
    getUserNotifications,
    markAsRead,
    markAllAsRead,
    getUnreadCount
};
