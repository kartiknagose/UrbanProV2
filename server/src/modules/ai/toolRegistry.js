const TOOL_REGISTRY = {
  getWallet: {
    name: 'getWallet',
    description: 'Get current user wallet balance and transactions.',
    method: 'GET',
    endpoint: '/api/growth/wallet',
    requiredParams: [],
    allowedRoles: ['CUSTOMER', 'WORKER'],
  },
  getBookings: {
    name: 'getBookings',
    description: 'Get bookings for the authenticated user.',
    method: 'GET',
    endpoint: '/api/bookings',
    requiredParams: [],
    allowedRoles: ['AUTHENTICATED'],
  },
  getNotifications: {
    name: 'getNotifications',
    description: 'Get notifications for the authenticated user.',
    method: 'GET',
    endpoint: '/api/notifications',
    requiredParams: [],
    allowedRoles: ['AUTHENTICATED'],
  },
  cancelBooking: {
    name: 'cancelBooking',
    description: 'Cancel an existing booking for the authenticated user.',
    method: 'PATCH',
    endpoint: '/api/bookings/:id/cancel',
    requiredParams: ['bookingId'],
    allowedRoles: ['AUTHENTICATED'],
  },
  createBooking: {
    name: 'createBooking',
    description: 'Create a new booking for a customer.',
    method: 'POST',
    endpoint: '/api/bookings',
    requiredParams: [],
    allowedRoles: ['CUSTOMER'],
  },
  markNotificationsRead: {
    name: 'markNotificationsRead',
    description: 'Mark all notifications as read for the authenticated user.',
    method: 'POST',
    endpoint: '/api/notifications/read-all',
    requiredParams: [],
    allowedRoles: ['AUTHENTICATED'],
  },
};

function getTool(toolName) {
  return TOOL_REGISTRY[toolName] || null;
}

function listTools() {
  return Object.values(TOOL_REGISTRY);
}

module.exports = {
  TOOL_REGISTRY,
  getTool,
  listTools,
};
