/**
 * AI Intent Detection Module
 * Detects user intention from message text
 */

const intentPatterns = {
  wallet: ['wallet', 'balance', 'money', 'amount', 'remaining', 'funds', 'transaction', 'transactions', 'history', 'statement', 'payment', 'payments', 'due'],
  bookings: ['booking', 'bookings', 'orders', 'services', 'jobs', 'appointments'],
  notifications: ['notifications', 'alerts', 'updates', 'messages'],
  payouts: ['payout', 'payouts', 'redeem', 'withdraw', 'bank details', 'upi'],
};

/**
 * Detect intent from user message with confidence scoring
 * @param {string} message - User message text
 * @returns {object} { intent, score, confidence }
 */
function detectIntent(message) {
  const text = String(message || '').toLowerCase().trim();
  if (!text) return { intent: null, score: 0, confidence: 'none' };

  const wordCount = text.split(/\s+/).length;
  const scores = {};

  for (const [intent, keywords] of Object.entries(intentPatterns)) {
    const matches = keywords.filter(k => text.includes(k)).length;
    scores[intent] = wordCount > 0 ? matches / wordCount : 0;
  }

  const entries = Object.entries(scores).sort(([, a], [, b]) => b - a);
  if (entries.length === 0) return { intent: null, score: 0, confidence: 'none' };

  const [bestIntent, bestScore] = entries[0];

  let confidence;
  if (bestScore >= 0.4) confidence = 'high';
  else if (bestScore >= 0.15) confidence = 'medium';
  else confidence = 'low';

  return { intent: bestIntent || null, score: bestScore, confidence };
}

/**
 * Check if message indicates a specific intent with high confidence
 */
function isBookingRequest(message) {
  const { intent, confidence } = detectIntent(message);
  return intent === 'bookings' && (confidence === 'high' || confidence === 'medium');
}

function isWalletRequest(message) {
  const { intent, confidence } = detectIntent(message);
  return intent === 'wallet' && (confidence === 'high' || confidence === 'medium');
}

function isNotificationRequest(message) {
  const { intent, confidence } = detectIntent(message);
  return intent === 'notifications' && (confidence === 'high' || confidence === 'medium');
}

function isPayoutRequest(message) {
  const { intent, confidence } = detectIntent(message);
  return intent === 'payouts' && (confidence === 'high' || confidence === 'medium');
}

module.exports = {
  intentPatterns,
  detectIntent,
  isBookingRequest,
  isWalletRequest,
  isNotificationRequest,
  isPayoutRequest,
};
