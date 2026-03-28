// Centralized query keys for React Query
// Keeps cache namespaces consistent across roles and features

export const queryKeys = {
  // ── Bookings ──────────────────────────────────────────────
  bookings: {
    all: () => ['bookings'],
    customer: () => ['bookings', 'customer'],
    worker: () => ['bookings', 'worker'],
    admin: () => ['bookings', 'admin'],
    open: () => ['open-bookings'],
    detail: (id) => ['bookings', 'detail', id],
    sessions: (id) => ['bookings', 'sessions', id],
    history: (id) => ['bookings', 'history', id],
  },

  // ── Reviews ───────────────────────────────────────────────
  reviews: {
    customerPending: () => ['reviews', 'customer', 'pending'],
    customerWritten: () => ['reviews', 'customer', 'written'],
    workerPending: () => ['reviews', 'worker', 'pending'],
    workerWritten: () => ['reviews', 'worker', 'written'],
    workerReceived: () => ['reviews', 'worker', 'received'],
  },

  // ── Services ──────────────────────────────────────────────
  services: {
    all: () => ['services'],
    list: (filters) => ['services', filters],
    detail: (id) => ['service', id],
    workers: (serviceId) => ['service-workers', serviceId],
    preview: () => ['services-preview'],
    status: () => ['services-status'],
  },

  // ── Worker ────────────────────────────────────────────────
  worker: {
    profile: () => ['worker-profile'],
    profilePublic: (id) => ['worker-profile-proper', id],
    profileWindow: (id) => ['worker-profile-window', id],
    services: () => ['worker-services'],
    payments: () => ['worker-payments'],
    bookingsWith: (workerId) => ['my-bookings-with-worker', workerId],
    availability: () => ['availability'],
  },

  // ── Admin ─────────────────────────────────────────────────
  admin: {
    dashboard: () => ['admin-dashboard'],
    bookingsPreview: () => ['admin-bookings-preview'],
    usersPreview: () => ['admin-users-preview'],
    users: (roleFilter) => ['admin-users', roleFilter],
    workers: () => ['admin-workers'],
    workersPreview: () => ['admin-workers-preview'],
    verificationPreview: () => ['admin-verification-preview'],
    aiAuditSummary: () => ['admin-ai-audit-summary'],
    aiAudits: (filters) => ['admin-ai-audits', filters],
  },

  // ── Verification ──────────────────────────────────────────
  verification: {
    my: () => ['verification'],
    applications: () => ['verification-applications'],
  },

  // ── Chat ──────────────────────────────────────────────────
  chat: {
    conversations: () => ['chat', 'conversations'],
    booking: (bookingId) => ['chat', 'booking', bookingId],
    messages: (conversationId) => ['chat', 'messages', conversationId],
  },

  // ── Safety ────────────────────────────────────────────────
  safety: {
    sosAlerts: () => ['sos-alerts'],
    emergencyContacts: () => ['emergency-contacts'],
  },

  // ── Notifications ─────────────────────────────────────────
  notifications: {
    all: () => ['notifications'],
    preferences: () => ['notifications', 'preferences'],
    pushSubscriptions: () => ['notifications', 'push-subscriptions'],
  },

  // ── Profile ───────────────────────────────────────────────
  profile: {
    current: () => ['profile'],
  },

  // ── Health / System ───────────────────────────────────────
  health: {
    status: () => ['health'],
  },
};
