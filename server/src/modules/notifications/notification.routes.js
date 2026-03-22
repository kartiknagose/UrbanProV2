const express = require('express');
const router = express.Router();
const notificationController = require('./notification.controller');
const pushController = require('./push.controller');
const authenticate = require('../../middleware/auth');
const validate = require('../../middleware/validation');
const { requireAdmin } = require('../../middleware/requireRole');
const {
	subscribeSchema,
	unsubscribeSchema,
	updatePreferencesSchema,
} = require('./notification.schemas');

// Existing notification routes
router.get('/', authenticate, notificationController.getNotifications);
router.patch('/:id/read', authenticate, notificationController.readNotification);
router.post('/read-all', authenticate, notificationController.readAllNotifications);
router.get('/mock-gateway', authenticate, requireAdmin, notificationController.getMockGatewayMessages);

// Push subscription routes
router.get('/push/vapid-key', authenticate, pushController.getVapidPublicKey);
router.post('/push/subscribe', authenticate, subscribeSchema, validate, pushController.subscribe);
router.post('/push/unsubscribe', authenticate, unsubscribeSchema, validate, pushController.unsubscribe);
router.get('/push/subscriptions', authenticate, pushController.getSubscriptions);

// Notification preferences
router.get('/preferences', authenticate, pushController.getPreferences);
router.patch('/preferences', authenticate, updatePreferencesSchema, validate, pushController.updatePreferences);

module.exports = router;
