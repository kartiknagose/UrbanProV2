const asyncHandler = require('../../common/utils/asyncHandler');
const AppError = require('../../common/errors/AppError');
const prisma = require('../../config/prisma');
const { registerUser, loginUser, verifyEmailToken, requestPasswordReset, resetPasswordWithToken, changePassword } = require('./auth.service');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../../common/utils/mailer');

const isProduction = process.env.NODE_ENV === 'production';

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: isProduction ? 'none' : 'lax',
  secure: isProduction,
  maxAge: 24 * 60 * 60 * 1000,
};

exports.register = asyncHandler(async (req, res) => {
  const { name, email, mobile, password, role } = req.body;
  const { user, verificationToken } = await registerUser({ name, email, mobile, password, role });
  const baseUrl = req.get('origin') || process.env.CORS_ORIGIN || 'http://localhost:5173';
  const verificationLink = `${baseUrl}/verify-email?token=${encodeURIComponent(verificationToken)}`;
  try {
    await sendVerificationEmail({ to: user.email, link: verificationLink });
  } catch (error) {
    console.error('❌ Verification email failed (SMTP Error):');
    if (error.response) console.error('Response:', error.response);
    if (error.code) console.error('Code:', error.code);
    console.error('Message:', error.message);
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
  const baseUrl = req.get('origin') || process.env.CORS_ORIGIN || 'http://localhost:5173';

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