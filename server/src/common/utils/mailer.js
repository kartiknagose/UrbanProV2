const nodemailer = require('nodemailer');
const logger = require('../../config/logger');

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const buildTransport = () => {
  const host = process.env.SMTP_HOST;
  const port = toNumber(process.env.SMTP_PORT, 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';

  if (!host || !user || !pass) {
    const missingFields = [];
    if (!host) missingFields.push('SMTP_HOST');
    if (!user) missingFields.push('SMTP_USER');
    if (!pass) missingFields.push('SMTP_PASS');
    throw new Error(`SMTP credentials are not configured. Missing: ${missingFields.join(', ')}`);
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    connectionUrl: `smtp${secure ? 's' : ''}://${user}:***@${host}:${port}`,
  });

  // Test connection on creation
  transporter.verify((error, success) => {
    if (error) {
      console.error(`[Email] ❌ SMTP Connection Failed:\n`, {
        host,
        port,
        secure,
        user,
        error: error.message,
        code: error.code,
        command: error.command,
      });
      logger.error('SMTP Connection verification failed', { error: error.message, code: error.code });
    } else if (success) {
      console.log(`[Email] ✅ SMTP Connected Successfully (${host}:${port})`);
    }
  });

  return transporter;
};

const getFromAddress = () => {
  const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER;
  const fromName = process.env.FROM_NAME || 'UrbanPro';
  return `${fromName} <${fromEmail}>`;
};

async function sendVerificationEmail({ to, link }) {
  try {
    const transporter = buildTransport();
    
    const info = await transporter.sendMail({
      from: getFromAddress(),
      to,
      subject: 'Verify your UrbanPro email',
      text: `Welcome to UrbanPro! Verify your email: ${link}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>Verify your email</h2>
          <p>Thanks for signing up with UrbanPro. Please verify your email to continue.</p>
          <p>
            <a href="${link}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;">Verify Email</a>
          </p>
          <p>If the button does not work, copy and paste this link into your browser:</p>
          <p>${link}</p>
        </div>
      `,
    });
    
    console.log(`[Email] ✅ Verification email sent: ${info.messageId} → ${to}`);
    logger.info('Verification email sent', { to, messageId: info.messageId });
    return info;
  } catch (error) {
    console.error(`[Email] ❌ Failed to send verification email to ${to}:`, {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      stack: error.stack.split('\n').slice(0, 3).join('\n'),
    });
    logger.error('Failed to send verification email', { 
      to, 
      message: error.message, 
      code: error.code,
      response: error.response 
    });
    throw error;
  }
}

async function sendPasswordResetEmail({ to, link }) {
  try {
    const transporter = buildTransport();

    const info = await transporter.sendMail({
      from: getFromAddress(),
      to,
      subject: 'Reset your UrbanPro password',
      text: `Reset your password here: ${link}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>Reset Password</h2>
          <p>You requested a password reset for UrbanPro.</p>
          <p>
            <a href="${link}" style="display:inline-block;padding:10px 16px;background:#ef4444;color:#ffffff;text-decoration:none;border-radius:6px;">Reset Password</a>
          </p>
          <p>If you didn't request this, you can ignore this email.</p>
          <p>Link: ${link}</p>
        </div>
      `,
    });
    
    console.log(`[Email] ✅ Password reset email sent: ${info.messageId} → ${to}`);
    logger.info('Password reset email sent', { to, messageId: info.messageId });
    return info;
  } catch (error) {
    console.error(`[Email] ❌ Failed to send password reset email to ${to}:`, {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
    });
    logger.error('Failed to send password reset email', { 
      to, 
      message: error.message, 
      code: error.code 
    });
    throw error;
  }
}

const BOOKING_STATUS_CONFIG = {
  PENDING: {
    customerSubject: 'Booking Requested – UrbanPro',
    customerHeading: 'Booking Requested',
    customerBody: (s) => `Your booking for <strong>${s.serviceName}</strong> has been placed. The worker will respond shortly.`,
    workerSubject: 'New Job Request – UrbanPro',
    workerHeading: 'New Job Request',
    workerBody: (s) => `You have a new booking request for <strong>${s.serviceName}</strong> from ${s.customerName}.`,
  },
  CONFIRMED: {
    customerSubject: 'Booking Confirmed – UrbanPro',
    customerHeading: 'Booking Confirmed',
    customerBody: (s) => `Great news! Your booking for <strong>${s.serviceName}</strong> has been confirmed by ${s.workerName}.`,
    workerSubject: 'You Accepted a Job – UrbanPro',
    workerHeading: 'Job Accepted',
    workerBody: (s) => `You accepted the booking for <strong>${s.serviceName}</strong> (Booking #${s.bookingId}).`,
  },
  IN_PROGRESS: {
    customerSubject: 'Job Started – UrbanPro',
    customerHeading: 'Job In Progress',
    customerBody: (s) => `${s.workerName} has started working on your <strong>${s.serviceName}</strong> booking.`,
    workerSubject: 'Job Started – UrbanPro',
    workerHeading: 'Job Started',
    workerBody: (s) => `You've started working on <strong>${s.serviceName}</strong> (Booking #${s.bookingId}).`,
  },
  COMPLETED: {
    customerSubject: 'Job Completed – UrbanPro',
    customerHeading: 'Job Completed',
    customerBody: (s) => `Your <strong>${s.serviceName}</strong> job is complete. Please rate your experience!`,
    workerSubject: 'Job Completed – UrbanPro',
    workerHeading: 'Job Completed',
    workerBody: (s) => `Great work! You completed <strong>${s.serviceName}</strong> (Booking #${s.bookingId}).`,
  },
  CANCELLED: {
    customerSubject: 'Booking Cancelled – UrbanPro',
    customerHeading: 'Booking Cancelled',
    customerBody: (s) => `Your booking for <strong>${s.serviceName}</strong> has been cancelled.`,
    workerSubject: 'Booking Cancelled – UrbanPro',
    workerHeading: 'Booking Cancelled',
    workerBody: (s) => `The booking for <strong>${s.serviceName}</strong> (Booking #${s.bookingId}) has been cancelled.`,
  },
};

function buildEmailHtml(heading, bodyHtml, bookingId) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <div style="background:#2563eb;padding:16px 24px;">
        <h1 style="color:#fff;margin:0;font-size:20px;">UrbanPro</h1>
      </div>
      <div style="padding:24px;line-height:1.6;color:#1f2937;">
        <h2 style="margin:0 0 12px;font-size:18px;">${heading}</h2>
        <p style="margin:0 0 16px;">${bodyHtml}</p>
        <p style="margin:0;font-size:13px;color:#6b7280;">Booking #${bookingId}</p>
      </div>
      <div style="background:#f9fafb;padding:12px 24px;font-size:12px;color:#9ca3af;text-align:center;">
        UrbanPro &mdash; Home services, simplified.
      </div>
    </div>`;
}

/**
 * Send booking status email to customer and/or worker.
 * Fire-and-forget — errors are logged but never thrown.
 */
async function sendBookingStatusEmail(booking) {
  const status = booking.status;
  const config = BOOKING_STATUS_CONFIG[status];
  if (!config) return;

  const customerEmail = booking.customer?.email;
  const workerEmail = booking.workerProfile?.user?.email;
  const vars = {
    serviceName: booking.service?.name || 'your service',
    customerName: booking.customer?.name || 'Customer',
    workerName: booking.workerProfile?.user?.name || 'Worker',
    bookingId: booking.id,
  };

  let transporter;
  try {
    transporter = buildTransport();
  } catch (err) {
    logger.warn('SMTP not configured, skipping booking email:', err.message);
    return;
  }

  const from = getFromAddress();
  const sends = [];

  if (customerEmail) {
    sends.push(
      transporter.sendMail({
        from,
        to: customerEmail,
        subject: config.customerSubject,
        html: buildEmailHtml(config.customerHeading, config.customerBody(vars), booking.id),
      })
    );
  }

  if (workerEmail) {
    sends.push(
      transporter.sendMail({
        from,
        to: workerEmail,
        subject: config.workerSubject,
        html: buildEmailHtml(config.workerHeading, config.workerBody(vars), booking.id),
      })
    );
  }

  try {
    await Promise.allSettled(sends);
  } catch (err) {
    logger.warn('Booking status email send error:', err.message);
  }
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendBookingStatusEmail,
};
