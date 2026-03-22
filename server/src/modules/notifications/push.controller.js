// server/src/modules/notifications/push.controller.js
// Handles push subscription management and VAPID public key endpoint.

const asyncHandler = require('../../common/utils/asyncHandler');
const pushService = require('./push.service');
const preferenceService = require('./preference.service');
const { VAPID_PUBLIC_KEY } = require('../../config/webPush');

/**
 * GET /api/notifications/push/vapid-key
 * Returns the VAPID public key so the client can subscribe.
 */
const getVapidPublicKey = asyncHandler(async (_req, res) => {
  if (!VAPID_PUBLIC_KEY) {
    return res.status(503).json({ error: 'Push notifications not configured on this server.' });
  }
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

/**
 * POST /api/notifications/push/subscribe
 * Save a push subscription for the authenticated user.
 * Body: { subscription: { endpoint, keys: { p256dh, auth } } }
 */
const subscribe = asyncHandler(async (req, res) => {
  const { subscription } = req.body;

  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({ error: 'Invalid push subscription object.' });
  }

  await pushService.saveSubscription(req.user.id, {
    endpoint: subscription.endpoint,
    keys: subscription.keys,
    userAgent: req.headers['user-agent'],
  });

  res.json({ success: true });
});

/**
 * POST /api/notifications/push/unsubscribe
 * Remove a push subscription.
 * Body: { endpoint }
 */
const unsubscribe = asyncHandler(async (req, res) => {
  const endpoint = String(req.body?.endpoint || '').trim();
  if (!endpoint) {
    return res.status(400).json({ error: 'Endpoint is required.' });
  }

  await pushService.removeSubscription(req.user.id, endpoint);
  res.json({ success: true });
});

/**
 * GET /api/notifications/push/subscriptions
 * List the current user's push subscriptions (for management UI).
 */
const getSubscriptions = asyncHandler(async (req, res) => {
  const subscriptions = await pushService.getUserSubscriptions(req.user.id);
  res.json({
    subscriptions: subscriptions.map((s) => ({
      id: s.id,
      endpoint: s.endpoint,
      userAgent: s.userAgent,
      createdAt: s.createdAt,
    })),
  });
});

/**
 * GET /api/notifications/preferences
 * Get the user's notification preferences.
 */
const getPreferences = asyncHandler(async (req, res) => {
  const preferences = await preferenceService.getPreferences(req.user.id);
  res.json({ preferences });
});

/**
 * PATCH /api/notifications/preferences
 * Update the user's notification preferences.
 * Body: partial object with boolean fields.
 */
const updatePreferences = asyncHandler(async (req, res) => {
  const preferences = await preferenceService.updatePreferences(req.user.id, req.body);
  res.json({ preferences });
});

module.exports = {
  getVapidPublicKey,
  subscribe,
  unsubscribe,
  getSubscriptions,
  getPreferences,
  updatePreferences,
};
