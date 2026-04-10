const asyncHandler = require('../../common/utils/asyncHandler');
const AppError = require('../../common/errors/AppError');
const prisma = require('../../config/prisma');
const { FRONTEND_URL } = require('../../config/env');
const { registerUser, loginUser, verifyEmailToken, requestPasswordReset, resetPasswordWithToken, changePassword } = require('./auth.service');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../../common/utils/mailer');
const GrowthService = require('../business_growth/business_growth.service');

function isSchemaDriftError(error) {
  const code = String(error?.code || '').toUpperCase();
  return code === 'P2021' || code === 'P2022';
}

const isProduction = process.env.NODE_ENV === 'production';
const requireEmailVerification = String(process.env.REQUIRE_EMAIL_VERIFICATION || '').toLowerCase() === 'true';
const smtpSendTimeoutMs = Number(process.env.SMTP_SEND_TIMEOUT_MS || 20000);
const normalizeSameSite = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (['lax', 'strict', 'none'].includes(normalized)) return normalized;
  return isProduction ? 'none' : 'lax';
};

const resolveFrontendBaseUrl = (req) => {
  const fromEnv = String(FRONTEND_URL || '').trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  const origin = String(req.get('origin') || '').trim();
  if (origin) return origin.replace(/\/+$/, '');

  const referer = String(req.get('referer') || '').trim();
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch (_err) {
      // Ignore malformed referer.
    }
  }

  if (!isProduction) {
    return 'http://localhost:5173';
  }

  throw new AppError(500, 'FRONTEND_URL is not configured. Set FRONTEND_URL to generate email links in production.');
};

function normalizeCookieDomain(rawDomain) {
  const value = String(rawDomain || '').trim();
  if (!value) return '';

  // Accept values like "expertshub.tech" or ".expertshub.tech".
  // If someone accidentally sets a full URL, extract the hostname.
  let candidate = value;
  if (/^https?:\/\//i.test(candidate)) {
    try {
      candidate = new URL(candidate).hostname;
    } catch (_err) {
      return '';
    }
  }

  candidate = candidate.replace(/^\.+/, '').replace(/\/+$/, '');
  if (!candidate || candidate.includes(' ')) return '';

  // Domain option should not include port, protocol, or path.
  if (candidate.includes(':') || candidate.includes('/')) return '';

  return `.${candidate}`;
}

const cookieDomain = normalizeCookieDomain(process.env.COOKIE_DOMAIN);
const cookieMaxAgeMs = Number(process.env.AUTH_COOKIE_MAX_AGE_MS || 24 * 60 * 60 * 1000);
const cookieSameSite = normalizeSameSite(process.env.AUTH_COOKIE_SAMESITE);
const cookieSecure = String(process.env.AUTH_COOKIE_SECURE || '').trim().toLowerCase() === 'true'
  ? true
  : (String(process.env.AUTH_COOKIE_SECURE || '').trim().toLowerCase() === 'false' ? false : isProduction);

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: cookieSameSite,
  secure: cookieSecure,
  maxAge: cookieMaxAgeMs,
  path: '/',
  ...(cookieDomain ? { domain: cookieDomain } : {}),
};

const CLEAR_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: COOKIE_OPTIONS.sameSite,
  secure: COOKIE_OPTIONS.secure,
  path: COOKIE_OPTIONS.path,
  ...(COOKIE_OPTIONS.domain ? { domain: COOKIE_OPTIONS.domain } : {}),
};

exports.register = asyncHandler(async (req, res) => {
  const { name, email, mobile, password, role } = req.body;
  const { user, verificationToken } = await registerUser({ name, email, mobile, password, role });
  // Use FRONTEND_URL (never comma-separated CORS_ORIGIN) to build a valid, clickable link
  const baseUrl = resolveFrontendBaseUrl(req);
  const verificationLink = `${baseUrl}/verify-email?token=${encodeURIComponent(verificationToken)}`;

  const sendVerificationWithTimeout = async () => {
    await Promise.race([
      sendVerificationEmail({ to: user.email, link: verificationLink }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Verification email timeout')), smtpSendTimeoutMs)),
    ]);
  };

  const isRetryableMailError = (error) => {
    if (!error) return false;
    const code = String(error.code || '').toUpperCase();
    const message = String(error.message || '').toLowerCase();
    return code === 'ETIMEDOUT'
      || code === 'ECONNECTION'
      || code === 'ECONNRESET'
      || message.includes('timeout');
  };

  const trySendVerification = async () => {
    try {
      await sendVerificationWithTimeout();
      console.log(`✅ Verification email sent to ${user.email}`);
      return;
    } catch (firstError) {
      if (!isRetryableMailError(firstError)) {
        throw firstError;
      }

      console.warn(`⚠️ Verification email first attempt failed for ${user.email}. Retrying once...`);
      await sendVerificationWithTimeout();
      console.log(`✅ Verification email sent to ${user.email} (retry success)`);
    }
  };

  if (isProduction) {
    try {
      await trySendVerification();
    } catch (error) {
      console.error('❌ Verification email failed (SMTP Error):');
      if (error.response) console.error('Response:', error.response);
      if (error.code) console.error('Code:', error.code);
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);

      if (requireEmailVerification) {
        try {
          await prisma.user.delete({ where: { id: user.id } });
        } catch (cleanupError) {
          console.error('Failed to clean up user after email failure:', cleanupError.message);
        }

        const smtpHint = error?.code === 'EAUTH'
          ? ' SMTP authentication failed. Please check SMTP_USER/SMTP_PASS (Gmail App Password).'
          : '';
        throw new AppError(502, `Unable to send verification email.${smtpHint}`);
      }

      console.warn('⚠️ Continuing registration despite email failure because REQUIRE_EMAIL_VERIFICATION is false.');
    }
  } else {
    (async () => {
      try {
        await trySendVerification();
      } catch (error) {
        console.error('❌ Verification email failed (SMTP Error):');
        if (error.response) console.error('Response:', error.response);
        if (error.code) console.error('Code:', error.code);
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
      }
    })();
  }

  try {
    await prisma.$transaction(async (tx) => {
      await GrowthService.initializeWallet(user.id, tx);
      await GrowthService.generateReferralCode(user.id, tx);
    }, {
      maxWait: 10000,
      timeout: 15000,
    });
  } catch (setupError) {
    console.error('[AUTH] Post-registration growth setup failed:', setupError.message);
  }

  // ALWAYS log link in dev for easy testing
  if (process.env.NODE_ENV === 'development') {
    console.log('DEV ONLY - Manual Verification Link:', verificationLink);
    try {
      require('fs').writeFileSync(require('path').join(process.cwd(), 'verification_link.txt'), verificationLink);
    } catch (e) {
      console.error('Failed to write verification link to file:', e);
    }
  }
  
  // User must verify email before logging in, so we don't set the auth cookie yet.
  // Production waits for the verification send to succeed; development logs it best-effort.
  res.status(201).json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      profilePhotoUrl: user.profilePhotoUrl || null,
    },
  });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const { user, token } = await loginUser({ email, password });
  res.cookie('token', token, COOKIE_OPTIONS);
  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      profilePhotoUrl: user.profilePhotoUrl || null,
      isProfileComplete: user.isProfileComplete,
      isVerified: user.isVerified || false, // For workers
    },
  });
});

exports.logout = asyncHandler(async (_req, res) => {
  res.clearCookie('token', CLEAR_COOKIE_OPTIONS);
  res.json({ message: 'Logged out' });
});

exports.me = asyncHandler(async (req, res) => {
  // Fetch full user for consistent UI hydration (photo + name).
  let user;
  try {
    user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        profilePhotoUrl: true,
        emailVerified: true,
        isProfileComplete: true,
        workerProfile: {
          select: { isVerified: true }
        }
      },
    });
  } catch (error) {
    if (!isSchemaDriftError(error)) throw error;

    user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        profilePhotoUrl: true,
        emailVerified: true,
        isProfileComplete: true,
      },
    });
  }

  if (!user) {
    throw new AppError(404, 'User not found');
  }

  const userData = {
    ...user,
    isVerified: user.workerProfile?.isVerified || false,
  };
  delete userData.workerProfile;

  res.json({ user: userData });
});

exports.verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.query;
  const result = await verifyEmailToken({ token });
  res.json({ message: 'Email verified successfully', ...result });
});

exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const baseUrl = resolveFrontendBaseUrl(req);

  // NOTE: result contains { resetLink, message }
  const result = await requestPasswordReset({ email, baseUrl });

  // If there's a reset link, send the email
  if (result.resetLink) {
    try {
      await sendPasswordResetEmail({ to: result.recipientEmail, link: result.resetLink });
    } catch (error) {
      console.error('Password reset email failed:', error);
      // We still return success to avoid leaking email existence
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('DEV ONLY - Password Reset Link:', result.resetLink);
    }
  }

  // Always return the standard message, never the link
  res.json({ message: result.message });
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  await resetPasswordWithToken({ token, password });
  res.json({ message: 'Password reset successfully' });
});

exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;
  await changePassword(userId, { currentPassword, newPassword });
  res.json({ message: 'Password updated successfully' });
});