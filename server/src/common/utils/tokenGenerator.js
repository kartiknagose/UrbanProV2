const crypto = require('crypto');

/**
 * Generate a secure random verification token
 * @returns {string} Hex string token
 */
function generateVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate email verification token with expiry
 * @param {number} expiryHours - How many hours until token expires (default: 24)
 * @returns {object} { token, expiresAt }
 */
function generateEmailVerificationToken(expiryHours = 24) {
  const safeExpiryHours = Number.isFinite(Number(expiryHours))
    ? Math.min(24 * 30, Math.max(1, Number(expiryHours)))
    : 24;

  const token = generateVerificationToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + safeExpiryHours);
  return { token, expiresAt };
}

/**
 * Generate password reset token with expiry
 * @param {number} expiryHours - How many hours until token expires (default: 2)
 * @returns {object} { token, expiresAt }
 */
function generatePasswordResetToken(expiryHours = 2) {
  const safeExpiryHours = Number.isFinite(Number(expiryHours))
    ? Math.min(24 * 7, Math.max(1, Number(expiryHours)))
    : 2;

  const token = generateVerificationToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + safeExpiryHours);
  return { token, expiresAt };
}

module.exports = {
  generateVerificationToken,
  generateEmailVerificationToken,
  generatePasswordResetToken,
};
