const nodemailer = require('nodemailer');
const axios = require('axios');
const logger = require('../../config/logger');

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isProduction = process.env.NODE_ENV === 'production';
const SMTP_CONNECTION_TIMEOUT_MS = toNumber(process.env.SMTP_CONNECTION_TIMEOUT_MS, 10000);
const SMTP_GREETING_TIMEOUT_MS = toNumber(process.env.SMTP_GREETING_TIMEOUT_MS, 10000);
const SMTP_SOCKET_TIMEOUT_MS = toNumber(process.env.SMTP_SOCKET_TIMEOUT_MS, 20000);
const SMTP_VERIFY_TIMEOUT_MS = toNumber(process.env.SMTP_VERIFY_TIMEOUT_MS, 12000);
const RESEND_HTTP_TIMEOUT_MS = toNumber(process.env.RESEND_HTTP_TIMEOUT_MS, 10000);
const SMTP_DISABLED = String(process.env.SMTP_DISABLED || '').toLowerCase() === 'true';

let transporterSingleton = null;

const normalizeSecret = (value) => {
  if (value == null) return '';
  // Remove wrapping quotes and trim accidental whitespace/newlines.
  return String(value).trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
};

const normalizeGmailAppPassword = (value) => {
  // Gmail App Password is 16 chars; users often paste it with spaces.
  return normalizeSecret(value).replace(/\s+/g, '');
};

const readSmtpConfig = () => {
  const host = normalizeSecret(process.env.SMTP_HOST || process.env.MAIL_HOST);
  const port = toNumber(process.env.SMTP_PORT || process.env.MAIL_PORT, 587);
  const user = normalizeSecret(process.env.SMTP_USER || process.env.MAIL_USER || process.env.EMAIL_USER);
  const secure = String(process.env.SMTP_SECURE || process.env.MAIL_SECURE || 'false').toLowerCase() === 'true';

  // Support multiple common key names to reduce misconfiguration issues.
  const rawPass =
    process.env.SMTP_PASS ||
    process.env.SMTP_PASSWORD ||
    process.env.MAIL_PASS ||
    process.env.MAIL_PASSWORD ||
    process.env.EMAIL_PASS ||
    process.env.GMAIL_APP_PASSWORD ||
    '';

  const pass = host.toLowerCase().includes('gmail')
    ? normalizeGmailAppPassword(rawPass)
    : normalizeSecret(rawPass);

  return { host, port, user, pass, secure };
};

const buildTransport = () => {
  if (SMTP_DISABLED) {
    console.warn('[Email] ⚠️ SMTP is disabled by SMTP_DISABLED=true. Using fallback provider if configured.');
    return null;
  }

  if (transporterSingleton) return transporterSingleton;

  const { host, port, user, pass, secure } = readSmtpConfig();

  if (!host || !user || !pass) {
    const missingFields = [];
    if (!host) missingFields.push('SMTP_HOST/MAIL_HOST');
    if (!user) missingFields.push('SMTP_USER/MAIL_USER/EMAIL_USER');
    if (!pass) missingFields.push('SMTP_PASS/SMTP_PASSWORD/MAIL_PASS/MAIL_PASSWORD/EMAIL_PASS/GMAIL_APP_PASSWORD');
    console.warn(`[Email] ⚠️ SMTP credentials not fully configured. Missing: ${missingFields.join(', ')}`);
    return null;
  }

  const isGmailHost = host.toLowerCase().includes('gmail');
  if (isGmailHost && pass.length !== 16) {
    console.warn(
      `[Email] ⚠️ Gmail SMTP likely misconfigured: expected a 16-character App Password after removing spaces, got ${pass.length}.`
    );
    console.warn('[Email] ⚠️ Use Google App Password (not normal Gmail password) and ensure 2-Step Verification is enabled.');
  }

  transporterSingleton = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    requireTLS: !secure,
    connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
    greetingTimeout: SMTP_GREETING_TIMEOUT_MS,
    socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
  });

  // Test connection on creation
  transporterSingleton.verify((error, success) => {
    if (error) {
      console.error(`[Email] ❌ SMTP Connection Failed for user ${user}:`, {
        host, port, secure, code: error.code, message: error.message,
        response: error.response
      });
    } else if (success) {
      console.log(`[Email] ✅ SMTP Connected Successfully to ${host}:${port} as ${user}`);
    }
  });

  return transporterSingleton;
};

async function verifySmtpConnection() {
  const transporter = buildTransport();
  if (!transporter) {
    return {
      ok: false,
      reason: 'SMTP transport not configured',
    };
  }

  try {
    await Promise.race([
      transporter.verify(),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('SMTP verify timeout')), SMTP_VERIFY_TIMEOUT_MS);
      }),
    ]);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      code: error.code,
      message: error.message,
      response: error.response,
    };
  }
}

const getFromAddress = () => {
  const fromEmail = process.env.SMTP_USER || process.env.FROM_EMAIL;
  const fromName = process.env.FROM_NAME || 'UrbanPro';
  return `${fromName} <${fromEmail}>`;
};

const shouldFallbackToResend = (error) => {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();
  return code === 'ETIMEDOUT' || code === 'ECONNECTION' || code === 'ECONNRESET' || message.includes('timeout');
};

const isResendConfigured = () => {
  return Boolean(normalizeSecret(process.env.RESEND_API_KEY));
};

async function sendViaResend({ to, subject, text, html, logContext = 'Default' }) {
  const resendApiKey = normalizeSecret(process.env.RESEND_API_KEY);
  const resendFrom = normalizeSecret(process.env.RESEND_FROM || process.env.FROM_EMAIL || process.env.SMTP_USER || 'onboarding@resend.dev');

  if (!resendApiKey) {
    throw new Error('Resend fallback unavailable: RESEND_API_KEY is not configured');
  }

  const payload = {
    from: resendFrom,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    text,
  };

  let response;
  try {
    response = await axios.post('https://api.resend.com/emails', payload, {
      timeout: RESEND_HTTP_TIMEOUT_MS,
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    const status = error?.response?.status;
    const data = error?.response?.data;
    console.error(`[Email] ❌ Resend failed for [${logContext}] to ${to}:`, {
      message: error.message,
      status,
      data,
    });
    throw error;
  }

  const messageId = response?.data?.id || 'unknown';
  console.log(`[Email] ✅ Sent [${logContext}] via Resend: ${messageId} → ${to}`);
  return { messageId, provider: 'resend' };
}

/**
 * Generic email sender with robust logging
 */
async function sendEmail({ to, subject, text, html, logContext = 'Default' }) {
  const transporter = buildTransport();
  if (!transporter) {
    if (isProduction && process.env.RESEND_API_KEY) {
      return sendViaResend({ to, subject, text, html, logContext });
    }

    const message = `SMTP transport not configured for ${logContext}`;
    console.warn(`[Email] ⚠️ Not sending email [${logContext}] to ${to}: ${message}`);
    if (isProduction) {
      throw new Error(message);
    }
    return null;
  }

  try {
    const info = await transporter.sendMail({
      from: getFromAddress(),
      to,
      subject,
      text,
      html,
    });
    console.log(`[Email] ✅ Sent [${logContext}]: ${info.messageId} → ${to}`);
    return info;
  } catch (error) {
    console.error(`[Email] ❌ Failed to send [${logContext}] to ${to}:`, {
      message: error.message,
      code: error.code,
      response: error.response,
    });

    if (isProduction && process.env.RESEND_API_KEY && shouldFallbackToResend(error)) {
      console.warn(`[Email] ⚠️ Falling back to Resend for [${logContext}] due to SMTP connectivity issue (${error.code || error.message}).`);
      return sendViaResend({ to, subject, text, html, logContext });
    }

    throw error;
  }
}

async function sendVerificationEmail({ to, link }) {
  return sendEmail({
    to,
    logContext: 'Verification',
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
}

async function sendPasswordResetEmail({ to, link }) {
  return sendEmail({
    to,
    logContext: 'Password Reset',
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

  if (!transporter) {
    logger.warn('SMTP not configured, skipping booking email: transport unavailable');
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
  verifySmtpConnection,
  isResendConfigured,
};
