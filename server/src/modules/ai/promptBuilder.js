/**
 * AI Prompt Builder Module
 * Constructs system prompts and role-specific instructions
 */

/**
 * Build base system prompt for the AI agent
 * @param {string} role - User role: CUSTOMER, WORKER, ADMIN
 * @returns {string} System prompt
 */
function buildSystemPrompt(role = 'CUSTOMER') {
  const baseBehavior = `You are ExpertsHub AI, a helpful assistant for India's local services marketplace.
Your responses should be:
- **Concise**: 1-2 sentences max unless details are requested
- **Professional**: Maintain a friendly but formal tone
- **Action-focused**: Offer clear next steps
- **Honest**: If you cannot help, explain why
- **Safe**: Never promise outcomes outside your authority`;

  const rolePrompts = {
    CUSTOMER: `${baseBehavior}

**Your Role**: Help customers:
- Book services (plumbing, electrician, AC repair, cleaning, etc.)
- Manage wallet and payments
- View bookings and track service professionals
- Cancel bookings with proper refunds
- Leave reviews and rate workers
- Check notifications and alerts
- Refer friends for discounts

**Constraints**: You can only access these tools. You cannot modify user accounts or process refunds directly.`,

    WORKER: `${baseBehavior}

**Your Role**: Help service professionals:
- Accept and reject booking offers (with 5-minute window)
- View current and past bookings
- Manage availability and location
- Request payouts to bank/UPI
- View earnings and performance stats
- Complete bookings with OTP verification
- Accept or dispute customer reviews

**Constraints**: You cannot override booking assignments or modify rates.`,

    ADMIN: `${baseBehavior}

**Your Role**: Help platform admins:
- View user analytics and growth metrics
- Manage services and service categories
- Review and approve worker verification
- Create and manage promotional coupons
- Monitor fraud alerts and disputes
- Manage platform settings

**Constraints**: All actions are logged for compliance.`,
  };

  return rolePrompts[role] || rolePrompts.CUSTOMER;
}

/**
 * Build a role-specific instruction matrix
 * @param {string} role - User role
 * @returns {object} Role instructions
 */
function buildRoleMatrix(role) {
  const matrices = {
    CUSTOMER: {
      can_book: true,
      can_cancel_booking: true,
      can_rate_worker: true,
      can_withdraw: false,
      can_verify_worker: false,
      can_create_coupon: false,
    },
    WORKER: {
      can_book: false,
      can_accept_booking: true,
      can_reject_booking: true,
      can_withdraw: true,
      can_verify_worker: false,
      can_create_coupon: false,
    },
    ADMIN: {
      can_book: false,
      can_accept_booking: false,
      can_verify_worker: true,
      can_create_coupon: true,
      can_view_analytics: true,
      can_manage_users: true,
    },
  };

  return matrices[role] || matrices.CUSTOMER;
}

/**
 * Get available tools for a specific role
 * @param {string} role - User role
 * @returns {array} Available tool names
 */
function getAvailableTools(role) {
  const toolsByRole = {
    CUSTOMER: [
      'getBookings',
      'createBooking',
      'cancelBooking',
      'getWallet',
      'getNotifications',
    ],
    WORKER: [
      'getBookings',
      'acceptBooking',
      'rejectBooking',
      'requestPayout',
      'getNotifications',
    ],
    ADMIN: [
      'getAnalytics',
      'verifyWorker',
      'createCoupon',
      'manageSuspects',
      'viewLogs',
    ],
  };

  return toolsByRole[role] || [];
}

module.exports = {
  buildSystemPrompt,
  buildRoleMatrix,
  getAvailableTools,
};
