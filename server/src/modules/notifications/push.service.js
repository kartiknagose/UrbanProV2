// server/src/modules/notifications/push.service.js
// Manages push subscriptions and sending browser push notifications.

const prisma = require('../../config/prisma');
const { sendPushNotification } = require('../../config/webPush');

/**
 * Save or update a push subscription for a user.
 * Uses upsert on the unique `endpoint` — if the same browser re-subscribes
 * with updated keys, we just update the existing row.
 */
async function saveSubscription(userId, { endpoint, keys, userAgent }) {
  return prisma.pushSubscription.upsert({
    where: { endpoint },
    update: {
      userId,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: userAgent || null,
    },
    create: {
      userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: userAgent || null,
    },
  });
}

/**
 * Remove a push subscription (user unsubscribed or endpoint expired).
 */
async function removeSubscription(userId, endpoint) {
  return prisma.pushSubscription.deleteMany({
    where: {
      endpoint,
      userId,
    },
  });
}

/**
 * Get all push subscriptions for a user.
 */
async function getUserSubscriptions(userId) {
  return prisma.pushSubscription.findMany({ where: { userId } });
}

/**
 * Send push notification to all of a user's subscribed devices.
 * Automatically cleans up expired/invalid subscriptions.
 */
async function pushToUser(userId, payload) {
  const subscriptions = await getUserSubscriptions(userId);
  if (subscriptions.length === 0) return;

  const expiredEndpoints = [];

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      const success = await sendPushNotification(sub, payload);
      if (!success) {
        expiredEndpoints.push(sub.endpoint);
      }
    })
  );

  // Clean up expired subscriptions
  if (expiredEndpoints.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: { endpoint: { in: expiredEndpoints } },
    });
  }
}

module.exports = {
  saveSubscription,
  removeSubscription,
  getUserSubscriptions,
  pushToUser,
};
