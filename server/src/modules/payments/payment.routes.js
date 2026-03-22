const { Router } = require('express');
const auth = require('../../middleware/auth');
const { requireRole, requireAdmin } = require('../../middleware/requireRole');
const { paymentWebhookLimiter } = require('../../config/rateLimit');
const { listMine, listAll, razorpayWebhook } = require('./payment.controller');

const router = Router();

// Payments for the logged-in user (Customer OR Worker)
router.get('/me', auth, requireRole('CUSTOMER', 'WORKER'), listMine);

// Admin payments
router.get('/admin', auth, requireAdmin, listAll);

// Razorpay Webhook (public endpoint)
router.post('/webhook', paymentWebhookLimiter, razorpayWebhook);

module.exports = router;
