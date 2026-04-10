const asyncHandler = require('../../common/utils/asyncHandler');
const parsePagination = require('../../common/utils/parsePagination');
const { listMyPayments, listAllPayments } = require('./payment.service');
const prisma = require('../../config/prisma');
const redis = require('../../config/redis');

exports.listMine = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { data: payments, total } = await listMyPayments(req.user.id, req.user.role, { skip, limit });
  res.json({ payments, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

exports.listAll = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { data: payments, total } = await listAllPayments({ skip, limit });
  res.json({ payments, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

const crypto = require('crypto');
const bookingService = require('../bookings/booking.service');

const WEBHOOK_EVENT_TTL_SECONDS = 60 * 60 * 6;
const localWebhookEventCache = new Map();

function cleanupLocalWebhookCache(now = Date.now()) {
  if (localWebhookEventCache.size === 0) return;
  for (const [key, expiresAt] of localWebhookEventCache.entries()) {
    if (expiresAt <= now) {
      localWebhookEventCache.delete(key);
    }
  }
}

async function claimWebhookEvent(eventId) {
  if (!eventId) return true;

  const cacheKey = `razorpay:webhook:event:${eventId}`;

  try {
    if (typeof redis?.set === 'function' && redis?.status === 'ready') {
      const claimed = await redis.set(cacheKey, '1', 'EX', WEBHOOK_EVENT_TTL_SECONDS, 'NX');
      return claimed === 'OK';
    }
  } catch (error) {
    console.warn('Razorpay Webhook: redis dedupe unavailable:', error.message);
  }

  const now = Date.now();
  cleanupLocalWebhookCache(now);
  if (localWebhookEventCache.has(cacheKey)) {
    return false;
  }

  localWebhookEventCache.set(cacheKey, now + WEBHOOK_EVENT_TTL_SECONDS * 1000);
  return true;
}

async function createPaymentIfNotExists({ bookingId, customerId, amount, status, reference }) {
  if (!reference) return;

  await prisma.$transaction(async (tx) => {
    const existing = await tx.payment.findFirst({
      where: {
        bookingId,
        status,
        reference,
      },
      select: { id: true },
    });

    if (existing) return;

    await tx.payment.create({
      data: {
        bookingId,
        customerId,
        amount,
        status,
        reference,
      },
    });
  });
}

exports.razorpayWebhook = asyncHandler(async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('Razorpay Webhook: missing RAZORPAY_WEBHOOK_SECRET');
    return res.status(500).send('Webhook secret is not configured');
  }

  const signature = req.headers['x-razorpay-signature'];
  if (!signature) {
    return res.status(400).send('Missing signature');
  }

  const bodyString = req.rawBody;
  if (!bodyString) {
    console.error('Razorpay Webhook: missing raw body payload');
    return res.status(400).send('Invalid payload');
  }

  const expectedSignature = crypto.createHmac('sha256', secret).update(bodyString).digest('hex');
  const normalizedSignature = String(signature || '');

  const isSignatureValid =
    normalizedSignature.length === expectedSignature.length
    && crypto.timingSafeEqual(Buffer.from(expectedSignature, 'utf8'), Buffer.from(normalizedSignature, 'utf8'));

  // To prevent the webhook from crashing if the signature mismatch, we simply log and return 400
  if (!isSignatureValid) {
    console.warn('Razorpay Webhook: Invalid signature');
    return res.status(400).send('Invalid signature');
  }

  let event;
  try {
    event = typeof req.body === 'object' ? req.body : JSON.parse(bodyString);
  } catch (_err) {
    return res.status(400).send('Invalid payload');
  }

  const headerEventId = String(req.headers['x-razorpay-event-id'] || '').trim();
  const payloadEventId = String(event?.payload?.payment?.entity?.id || event?.payload?.refund?.entity?.id || '').trim();
  const dedupeEventId = headerEventId || (payloadEventId ? `${event.event}:${payloadEventId}` : '');
  const isFirstDelivery = await claimWebhookEvent(dedupeEventId);
  if (!isFirstDelivery) {
    return res.status(200).send('Duplicate event ignored');
  }

  if (event.event === 'order.paid' || event.event === 'payment.captured') {
    const paymentEntity = event?.payload?.payment?.entity;
    if (!paymentEntity) {
      return res.status(200).send('Ignored');
    }

    const bookingId = Number(paymentEntity.notes?.bookingId);

    if (Number.isInteger(bookingId) && bookingId > 0) {
      try {
        await bookingService.payBooking(
          bookingId,
          null, // Webhook has no user ID
          'WEBHOOK',
          {
            paymentReference: paymentEntity.id,
            paymentOrderId: paymentEntity.order_id,
            paymentSignature: signature,
            isWebhook: true,
          }
        );
      } catch (err) {
        if (!(err && err.statusCode === 400 && String(err.message).toLowerCase().includes('already paid'))) {
          console.error('Razorpay Webhook payBooking error:', err.message);
        }
      }
    }
  }

  if (event.event === 'payment.failed') {
    const paymentEntity = event?.payload?.payment?.entity;
    const bookingId = Number(paymentEntity?.notes?.bookingId);

    if (Number.isInteger(bookingId) && bookingId > 0) {
      const booking = await prisma.booking.findUnique({ where: { id: bookingId }, select: { customerId: true } });

      await prisma.booking.updateMany({
        where: { id: bookingId, paymentStatus: 'PENDING' },
        data: {
          paymentStatus: 'FAILED',
          updatedAt: new Date(),
        },
      });

      if (booking?.customerId && paymentEntity?.id) {
        await createPaymentIfNotExists({
          bookingId,
          customerId: booking.customerId,
          amount: Number(paymentEntity?.amount || 0) / 100,
          status: 'FAILED',
          reference: paymentEntity.id,
        });
      }
    }
  }

  if (event.event === 'refund.processed') {
    const refundEntity = event?.payload?.refund?.entity;
    const bookingIdFromNotes = Number(refundEntity?.notes?.bookingId);
    const paymentReference = refundEntity?.payment_id;

    const booking = Number.isInteger(bookingIdFromNotes) && bookingIdFromNotes > 0
      ? await prisma.booking.findUnique({ where: { id: bookingIdFromNotes }, select: { id: true, customerId: true } })
      : (paymentReference
        ? await prisma.booking.findFirst({ where: { paymentReference }, select: { id: true, customerId: true } })
        : null);

    if (booking?.id) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { paymentStatus: 'REFUNDED', updatedAt: new Date() },
      });

      if (refundEntity?.id) {
        await createPaymentIfNotExists({
          bookingId: booking.id,
          customerId: booking.customerId,
          amount: Number(refundEntity?.amount || 0) / 100,
          status: 'REFUNDED',
          reference: refundEntity.id,
        });
      }
    }
  }

  res.status(200).send('OK');
});
