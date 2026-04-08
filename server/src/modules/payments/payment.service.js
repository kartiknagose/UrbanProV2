const Razorpay = require('razorpay');
const crypto = require('crypto');
const AppError = require('../../common/errors/AppError');
const prisma = require('../../config/prisma');
const CircuitBreaker = require('../../common/utils/circuitBreaker');

// Circuit breaker for Razorpay API calls (4.4)
const razorpayBreaker = new CircuitBreaker('razorpay', {
  failureThreshold: 5,
  resetTimeout: 60000, // 60 seconds
  successThreshold: 2,
});

function toPaiseAmount(amount) {
  const normalizedAmount = Number(amount);
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    throw new AppError(400, 'Invalid payment amount.');
  }

  const paise = Math.round(normalizedAmount * 100);
  if (!Number.isSafeInteger(paise) || paise <= 0) {
    throw new AppError(400, 'Invalid payment amount.');
  }

  return paise;
}

async function getRazorpayClient() {
  return razorpayBreaker.execute(async () => {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      throw new AppError(500, 'Payment gateway is not configured.');
    }

    return new Razorpay({ key_id: keyId, key_secret: keySecret });
  });
}

// Create Razorpay order for booking
async function createRazorpayOrder(bookingId, amount, currency = 'INR') {
  const razorpay = await getRazorpayClient();
  const options = {
    amount: toPaiseAmount(amount), // Razorpay expects paise
    currency,
    receipt: `booking_${bookingId}`,
    notes: { bookingId: String(bookingId) },
    payment_capture: 1,
  };
  const order = await razorpay.orders.create(options);
  return order;
}

async function createRazorpayWalletTopupOrder(userId, amount, currency = 'INR') {
  const razorpay = await getRazorpayClient();
  const options = {
    amount: toPaiseAmount(amount),
    currency,
    receipt: `wallet_${userId}_${Date.now()}`,
    notes: { userId: String(userId), purpose: 'WALLET_TOPUP' },
    payment_capture: 1,
  };
  const order = await razorpay.orders.create(options);
  return order;
}

function verifyRazorpayPaymentSignature({ orderId, paymentId, signature }) {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    throw new AppError(500, 'Payment gateway is not configured.');
  }

  if (!orderId || !paymentId || !signature) {
    return false;
  }

  const payload = `${orderId}|${paymentId}`;
  const digest = crypto.createHmac('sha256', keySecret).update(payload).digest('hex');

  const providedSignature = String(signature);
  if (providedSignature.length !== digest.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(digest, 'utf8'), Buffer.from(providedSignature, 'utf8'));
}

async function fetchRazorpayOrder(orderId) {
  const razorpay = await getRazorpayClient();
  return razorpay.orders.fetch(orderId);
}

async function fetchRazorpayPayment(paymentId) {
  const razorpay = await getRazorpayClient();
  return razorpay.payments.fetch(paymentId);
}

async function listMyPayments(userId, role, { skip = 0, limit = 20 } = {}) {
  const where =
    role === 'WORKER'
      ? { booking: { workerProfile: { userId } } }
      : { customerId: userId };

  const [data, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        booking: {
          include: { service: { select: { id: true, name: true, category: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.payment.count({ where }),
  ]);
  return { data, total };
}

async function listAllPayments({ skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    prisma.payment.findMany({
      include: {
        booking: {
          include: { service: { select: { id: true, name: true, category: true } } },
        },
        customer: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.payment.count(),
  ]);
  return { data, total };
}

module.exports = {
  getRazorpayClient,
  listMyPayments,
  listAllPayments,
  createRazorpayOrder,
  createRazorpayWalletTopupOrder,
  verifyRazorpayPaymentSignature,
  fetchRazorpayOrder,
  fetchRazorpayPayment,
};
