const asyncHandler = require('../../common/utils/asyncHandler');
const AppError = require('../../common/errors/AppError');
const prisma = require('../../config/prisma');
const { FRONTEND_URL } = require('../../config/env');
const { registerUser, loginUser, verifyEmailToken, requestPasswordReset, resetPasswordWithToken, changePassword } = require('./auth.service');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../../common/utils/mailer');
const GrowthService = require('../business_growth/business_growth.service');

const isProduction = process.env.NODE_ENV === 'production';
const requireEmailVerification = String(process.env.REQUIRE_EMAIL_VERIFICATION || '').toLowerCase() === 'true';

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: isProduction ? 'none' : 'lax',
  secure: isProduction,
  maxAge: 24 * 60 * 60 * 1000,
};

exports.register = asyncHandler(async (req, res) => {
  const { name, email, mobile, password, role } = req.body;
  const { user, verificationToken } = await registerUser({ name, email, mobile, password, role });
  // Use FRONTEND_URL (never comma-separated CORS_ORIGIN) to build a valid, clickable link
  const baseUrl = FRONTEND_URL;
  const verificationLink = `${baseUrl}/verify-email?token=${encodeURIComponent(verificationToken)}`;

  if (process.env.NODE_ENV === 'production') {
    try {
      // Avoid hanging registration for a long SMTP timeout in production.
      await Promise.race([
        sendVerificationEmail({ to: user.email, link: verificationLink }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Verification email timeout')), 8000)),
      ]);
      console.log(`✅ Verification email sent to ${user.email}`);
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
        await sendVerificationEmail({ to: user.email, link: verificationLink });
        console.log(`✅ Verification email sent to ${user.email}`);
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
  res.clearCookie('token', COOKIE_OPTIONS);
  res.json({ message: 'Logged out' });
});

exports.me = asyncHandler(async (req, res) => {
  // Fetch full user for consistent UI hydration (photo + name).
  const user = await prisma.user.findUnique({
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
  const baseUrl = FRONTEND_URL;

  // NOTE: result contains { resetLink, message }
  const result = await requestPasswordReset({ email, baseUrl });

  // If there's a reset link, send the email
  if (result.resetLink) {
    try {
      await sendPasswordResetEmail({ to: email, link: result.resetLink });
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