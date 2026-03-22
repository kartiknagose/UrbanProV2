const prisma = require('../../config/prisma');
const { hashPassword, comparePassword } = require('../../common/utils/bcrypt');
const { signJwt } = require('../../common/utils/jwt');
const { generateEmailVerificationToken, generatePasswordResetToken } = require('../../common/utils/tokenGenerator');
const AppError = require('../../common/errors/AppError');

async function registerUser({ name, email, mobile, password, role = 'CUSTOMER', referralCode = null }) {
  const normalizedName = String(name || '').trim();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedMobile = String(mobile || '').trim();
  const validRoles = ['CUSTOMER', 'WORKER'];
  if (!validRoles.includes(role)) {
    throw new AppError(400, 'Invalid role. Must be CUSTOMER or WORKER.');
  }

  const passwordHash = await hashPassword(password);
  const { token: verificationToken, expiresAt } = generateEmailVerificationToken();

  // Process referral code if provided
  let referrerId = null;
  if (referralCode) {
    const referrer = await prisma.user.findUnique({ where: { referralCode: referralCode.toUpperCase() } });
    if (referrer) {
      referrerId = referrer.id;
    }
  }

  // Keep the interactive transaction short to reduce timeout risk.
  const user = await prisma.$transaction(async (tx) => {
    // Check email uniqueness within transaction
    const existingEmail = await tx.user.findUnique({ where: { email: normalizedEmail } });
    if (existingEmail) throw new AppError(409, 'Email already registered');

    // Check mobile uniqueness within transaction
    const existingMobile = await tx.user.findUnique({ where: { mobile: normalizedMobile } });
    if (existingMobile) throw new AppError(409, 'Mobile number already registered');

    // Create user and email verification atomically (all or nothing)
    const newUser = await tx.user.create({
      data: {
        name: normalizedName,
        email: normalizedEmail,
        mobile: normalizedMobile,
        passwordHash,
        role,
        referredById: referrerId,
        emailVerifications: {
          create: {
            email: normalizedEmail,
            token: verificationToken,
            expiresAt,
          }
        }
      },
      include: { emailVerifications: true }
    });

    return newUser;
  }, {
    maxWait: 10000,
    timeout: 15000,
  });

  const jwtToken = signJwt({ id: user.id, role: user.role });
  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    token: jwtToken,
    verificationToken
  };
}

async function loginUser({ email, password }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const requireEmailVerification = String(process.env.REQUIRE_EMAIL_VERIFICATION || '').toLowerCase() === 'true';

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: {
      workerProfile: {
        select: { isVerified: true }
      }
    }
  });
  if (!user) throw new AppError(401, 'Invalid credentials');
  const ok = await comparePassword(password, user.passwordHash);
  if (!ok) throw new AppError(401, 'Invalid credentials');
  if (requireEmailVerification && !user.emailVerified && process.env.NODE_ENV !== 'development') {
    throw new AppError(403, 'Email not verified. Please check your inbox.');
  }
  if (!user.isActive) throw new AppError(403, 'Account suspended. Please contact support.');

  const token = signJwt({ id: user.id, role: user.role });

  // Flatten verification status for workers
  const userData = {
    ...user,
    isVerified: user.workerProfile?.isVerified || false,
  };
  delete userData.workerProfile;
  delete userData.passwordHash; // Ensure password hash is removed

  return { user: userData, token };
}

async function verifyEmailToken({ token }) {
  const verification = await prisma.emailVerification.findUnique({ where: { token } });
  if (!verification) throw new AppError(400, 'Invalid or expired verification link');
  if (verification.verified) throw new AppError(409, 'Email already verified');
  if (new Date() > verification.expiresAt) throw new AppError(400, 'Verification link expired');

  // Atomic transaction: update both records together
  await prisma.$transaction(async (tx) => {
    // Update EmailVerification record
    await tx.emailVerification.update({
      where: { id: verification.id },
      data: { verified: true }
    });

    // Update User record
    await tx.user.update({
      where: { id: verification.userId },
      data: { emailVerified: true, emailVerifiedAt: new Date() }
    });
  });

  // Fetch user role and profile completion info for redirect decisions
  const user = await prisma.user.findUnique({
    where: { id: verification.userId },
    include: {
      workerProfile: true,
      addresses: { take: 1 },
    },
  });

  return {
    userId: verification.userId,
    email: verification.email,
    role: user?.role,
    hasWorkerProfile: Boolean(user?.workerProfile),
    hasAddress: Boolean(user?.addresses?.length),
    isProfileComplete: Boolean(user?.isProfileComplete),
  };
}

async function requestPasswordReset({ email, baseUrl }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  // Always respond with success to avoid account enumeration
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (!user) {
    return { message: 'If an account exists, a reset link has been created.' };
  }

  const { token, expiresAt } = generatePasswordResetToken();

  await prisma.$transaction(async (tx) => {
    // Keep only the most recent reset token valid.
    await tx.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        used: false,
      },
      data: { used: true },
    });

    await tx.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });
  });

  const resetLink = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;

  return {
    message: 'If an account exists, a reset link has been created.',
    resetLink,
    recipientEmail: user.email,
  };
}

async function resetPasswordWithToken({ token, password }) {
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
  });

  if (!resetToken) throw new AppError(400, 'Invalid or expired reset token');
  if (resetToken.used) throw new AppError(409, 'Reset token already used');
  if (new Date() > resetToken.expiresAt) throw new AppError(400, 'Reset token expired');

  const passwordHash = await hashPassword(password);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    });

    // Invalidate all outstanding reset tokens once password is changed.
    await tx.passwordResetToken.updateMany({
      where: {
        userId: resetToken.userId,
        used: false,
      },
      data: { used: true },
    });
  });
}

async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'User not found');

  const isPasswordValid = await comparePassword(currentPassword, user.passwordHash);
  if (!isPasswordValid) throw new AppError(401, 'Invalid current password');
  if (currentPassword === newPassword) throw new AppError(400, 'New password must be different from current password');

  const newPasswordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newPasswordHash },
  });
}

module.exports = {
  registerUser,
  loginUser,
  verifyEmailToken,
  requestPasswordReset,
  resetPasswordWithToken,
  changePassword,
};
