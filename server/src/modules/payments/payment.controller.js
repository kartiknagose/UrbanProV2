const asyncHandler = require('../../common/utils/asyncHandler');
const parsePagination = require('../../common/utils/parsePagination');
const { listMyPayments, listAllPayments } = require('./payment.service');

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

  res.status(200).send('OK');
});
