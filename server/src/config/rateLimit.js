const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

// Global rate limiter — applies to ALL routes as a safety net
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // 300 requests per 15 min per IP (generous for normal use)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many registration attempts. Please try again later.' },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
});

const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many password reset requests. Please try again later.' },
});

const paymentWebhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many webhook requests. Please try again later.' },
});

const walletTopupCreateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, _res) => {
    return req.user?.id ? `wallet_create:user:${req.user.id}` : `wallet_create:ip:${ipKeyGenerator(req.ip)}`;
  },
  message: { error: 'Too many add-cash requests. Please try again later.' },
});

const walletTopupVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, _res) => {
    return req.user?.id ? `wallet_verify:user:${req.user.id}` : `wallet_verify:ip:${ipKeyGenerator(req.ip)}`;
  },
  message: { error: 'Too many payment verification attempts. Please try again later.' },
});

const walletRedeemLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, _res) => {
    return req.user?.id ? `wallet_redeem:user:${req.user.id}` : `wallet_redeem:ip:${ipKeyGenerator(req.ip)}`;
  },
  message: { error: 'Too many redeem requests. Please try again later.' },
});

// Rate limiter for booking creation (stricter)
const bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // limit each user to 20 bookings per hour
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, _res) => {
    // Keep anonymous users isolated per IP instead of collapsing to a shared bucket.
    return req.user?.id ? `user:${req.user.id}` : `ip:${ipKeyGenerator(req.ip)}`;
  },
  skip: (req, _res) => {
    // Skip rate limiting for admins
    return req.user?.role === 'ADMIN';
  },
});

// Strict rate limiter for OTP verification (brute-force prevention)
// 5 attempts per 15 minutes per IP+bookingId combo.
// With 9,000 possible 4-digit OTPs, 5 attempts gives a 0.05% chance of
// guessing correctly — compared to 100% without rate limiting.
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // max 5 OTP attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req, _res) => {
    // Key by user ID + booking ID + action to keep START and COMPLETE
    // counters independent and avoid accidental lockouts across steps.
    const actorId = req.user?.id ? `user:${req.user.id}` : `ip:${ipKeyGenerator(req.ip)}`;
    const bookingId = req.params.id || 'unknown';
    const action = req.path.includes('/complete')
      ? 'complete'
      : req.path.includes('/start')
        ? 'start'
        : 'otp';

    return `otp:${actorId}:${bookingId}:${action}`;
  },
  message: {
    error: 'Too many OTP attempts. Please wait 15 minutes before trying again.',
  },
});

const aiChatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, _res) => {
    return req.user?.id ? `ai_chat:user:${req.user.id}` : `ai_chat:ip:${ipKeyGenerator(req.ip)}`;
  },
  message: { error: 'Too many AI chat requests. Please try again later.' },
});

const aiVoiceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, _res) => {
    return req.user?.id ? `ai_voice:user:${req.user.id}` : `ai_voice:ip:${ipKeyGenerator(req.ip)}`;
  },
  message: { error: 'Too many AI voice requests. Please try again later.' },
});

module.exports = {
  globalLimiter,
  authLimiter,
  registerLimiter,
  loginLimiter,
  passwordResetLimiter,
  paymentWebhookLimiter,
  bookingLimiter,
  otpLimiter,
  aiChatLimiter,
  aiVoiceLimiter,
  walletTopupCreateLimiter,
  walletTopupVerifyLimiter,
  walletRedeemLimiter,
};