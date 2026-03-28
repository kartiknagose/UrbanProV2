const crypto = require('crypto');
const axios = require('axios');
const { listTools, getTool } = require('./toolRegistry');
const { executeTool } = require('./toolExecutor');

const pendingConfirmations = new Map();
const userRequestTracker = new Map();
const userContextStore = new Map();
const userPreferenceStore = new Map();
const userJourneyStore = new Map();
const apiResponseCache = new Map();
const bookingAttemptTracker = new Map();
const bookingIdempotencyStore = new Map();
const GROQ_UNAVAILABLE_MESSAGE = 'AI is temporarily unavailable. Try again.';
const LLM_PARSE_FALLBACK_MESSAGE = 'I can help with bookings, wallet, or notifications. What do you want to do?';
const RATE_LIMIT_MESSAGE = 'Too many requests. Please slow down.';
const FAILSAFE_MESSAGE = "Something went wrong. Let's try that again.";

const intentPatterns = {
  wallet: ['wallet', 'balance', 'money', 'amount', 'remaining', 'funds', 'transaction', 'transactions', 'history', 'statement'],
  bookings: ['booking', 'bookings', 'orders', 'services', 'jobs', 'appointments'],
  notifications: ['notifications', 'alerts', 'updates', 'messages'],
};

const intentToolMap = {
  wallet: 'getWallet',
  bookings: 'getBookings',
  notifications: 'getNotifications',
};

const serviceMap = {
  plumber: 'plumbing',
  ac: 'ac repair',
  cleaning: 'cleaning',
  electrician: 'electrician',
};

const roleToolAccess = {
  CUSTOMER: new Set(['getWallet', 'getBookings', 'getNotifications', 'cancelBooking', 'createBooking', 'markNotificationsRead']),
  WORKER: new Set(['getWallet', 'getBookings', 'getNotifications', 'cancelBooking', 'markNotificationsRead']),
  ADMIN: new Set(['getBookings', 'getNotifications', 'markNotificationsRead']),
};

function createSessionId() {
  return crypto.randomUUID();
}

function getSessionKey(userId, sessionId) {
  return `${userId}:${sessionId}`;
}

function nowIso() {
  return new Date().toISOString();
}

function logAiAgent(payload = {}) {
  const entry = {
    userId: payload.userId || 'unknown',
    message: String(payload.message || ''),
    detectedIntent: payload.detectedIntent || null,
    confidenceScore: Number.isFinite(Number(payload.confidenceScore)) ? Number(payload.confidenceScore) : 0,
    toolUsed: payload.toolUsed || null,
    success: Boolean(payload.success),
    error: payload.error || null,
    fallbackUsed: Boolean(payload.fallbackUsed),
    timestamp: payload.timestamp || nowIso(),
  };
  console.log(`[AI_AGENT_LOG] ${JSON.stringify(entry)}`);
}

function getAuthTokenFromContext(context = {}) {
  return String(context.token || '').trim();
}

function normalizeText(text) {
  return String(text || '').trim();
}

function toFailsafeTextResponse(sessionId) {
  return toTextResponse({
    sessionId,
    message: FAILSAFE_MESSAGE,
  });
}

function isConfirmMessage(text) {
  const normalized = normalizeText(text).toLowerCase();
  if (['yes', 'y', 'confirm', 'confirmed', 'ok', 'okay', 'proceed', 'sure'].includes(normalized)) {
    return true;
  }

  // Support natural confirmations like "yes confirm it" without requiring exact token match.
  if (/\b(no|cancel|stop|decline|don't|do not)\b/i.test(normalized)) {
    return false;
  }

  return /\b(yes|confirm|confirmed|ok|okay|proceed|sure)\b/i.test(normalized);
}

function isDeclineMessage(text) {
  const normalized = normalizeText(text).toLowerCase();
  return ['no', 'n', 'cancel', 'stop', 'decline'].includes(normalized);
}

function stripMarkdownCodeFences(value) {
  const text = String(value || '').trim();
  if (!text.startsWith('```')) return text;
  return text.replace(/^```[a-zA-Z]*\s*/, '').replace(/```\s*$/, '').trim();
}

function parseJsonEnvelope(raw) {
  try {
    const cleaned = stripMarkdownCodeFences(raw);
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function getUserContext(userId) {
  const key = String(userId);
  if (!userContextStore.has(key)) {
    userContextStore.set(key, {
      lastIntent: null,
      lastBookingId: null,
      pendingBooking: null,
      availableWorkers: [],
      lastWorkerOptions: [],
      bestWorkerId: null,
      cheapestWorkerId: null,
      workerMetadata: null,
    });
  }
  return userContextStore.get(key);
}

function getUserJourney(userId) {
  const key = String(userId);
  if (!userJourneyStore.has(key)) {
    userJourneyStore.set(key, {
      bookingStarted: false,
      bookingCompleted: false,
      lastStep: 'idle',
    });
  }
  return userJourneyStore.get(key);
}

function updateUserJourney(userId, updates = {}) {
  const journey = getUserJourney(userId);
  Object.assign(journey, updates || {});
  console.log(`[AI_AGENT_LOG] ${JSON.stringify({
    userId: String(userId),
    event: 'journey_transition',
    bookingStarted: Boolean(journey.bookingStarted),
    bookingCompleted: Boolean(journey.bookingCompleted),
    lastStep: journey.lastStep || 'idle',
    timestamp: nowIso(),
  })}`);
}

function getUserPreference(userId) {
  const key = String(userId);
  if (!userPreferenceStore.has(key)) {
    userPreferenceStore.set(key, { preference: null });
  }
  return userPreferenceStore.get(key);
}

function setUserPreference(userId, preference) {
  const pref = getUserPreference(userId);
  if (preference === 'best' || preference === 'cheap') {
    pref.preference = preference;
  } else {
    pref.preference = null;
  }
}

function getCacheTtlMsForEndpoint(method, endpoint) {
  if (String(method || '').toUpperCase() !== 'GET') return 0;
  if (endpoint === '/api/services') return 5 * 60 * 1000;
  if (/^\/api\/services\/[^/]+\/workers$/i.test(String(endpoint || ''))) return 2 * 60 * 1000;
  return 0;
}

function getCacheKey(method, endpoint) {
  return `${String(method || '').toUpperCase()}:${String(endpoint || '')}`;
}

function getCachedResponse(method, endpoint) {
  const ttl = getCacheTtlMsForEndpoint(method, endpoint);
  if (!ttl) return null;
  const key = getCacheKey(method, endpoint);
  const entry = apiResponseCache.get(key);
  if (!entry) return null;
  if (Date.now() > Number(entry.expiryTimestamp || 0)) {
    apiResponseCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedResponse(method, endpoint, data) {
  const ttl = getCacheTtlMsForEndpoint(method, endpoint);
  if (!ttl) return;
  const key = getCacheKey(method, endpoint);
  apiResponseCache.set(key, {
    data,
    expiryTimestamp: Date.now() + ttl,
  });
}

function isBookingAttemptRateLimited(userId) {
  const key = String(userId);
  const now = Date.now();
  const existing = bookingAttemptTracker.get(key) || [];
  const recent = existing.filter((ts) => now - ts <= 60_000);
  if (recent.length >= 3) {
    bookingAttemptTracker.set(key, recent);
    return true;
  }
  recent.push(now);
  bookingAttemptTracker.set(key, recent);
  return false;
}

function createBookingIdempotencyKey(userId, booking = {}) {
  const serviceId = booking?.serviceId || 'na';
  const scheduledAt = booking?.scheduledAt || 'na';
  const workerId = booking?.workerId || 'na';
  return `${String(userId)}:${serviceId}:${scheduledAt}:${workerId}`;
}

function canStartBookingExecution(idempotencyKey) {
  if (!idempotencyKey) return true;
  const now = Date.now();
  const existing = bookingIdempotencyStore.get(idempotencyKey);
  if (existing && now <= Number(existing.expiryTimestamp || 0) && existing.status === 'in_progress') {
    return false;
  }
  bookingIdempotencyStore.set(idempotencyKey, {
    status: 'in_progress',
    expiryTimestamp: now + (2 * 60 * 1000),
  });
  return true;
}

function completeBookingExecution(idempotencyKey, success) {
  if (!idempotencyKey) return;
  bookingIdempotencyStore.set(idempotencyKey, {
    status: success ? 'completed' : 'failed',
    expiryTimestamp: Date.now() + (2 * 60 * 1000),
  });
}

function clearPendingBooking(userId) {
  const context = getUserContext(userId);
  context.pendingBooking = null;
  context.pendingBookingSessionId = null;
  context.pendingBookingCreatedAt = null;
  context.availableWorkers = [];
  context.lastWorkerOptions = [];
  context.bestWorkerId = null;
  context.cheapestWorkerId = null;
  context.workerMetadata = null;
}

function hasActiveCreateBookingConfirmationForUser(userId) {
  const prefix = `${String(userId)}:`;
  const now = Date.now();
  for (const [key, value] of pendingConfirmations.entries()) {
    if (!String(key).startsWith(prefix)) continue;
    if (value?.toolName !== 'createBooking') continue;
    const createdAt = Number(value?.createdAt || 0);
    // Auto-expire orphaned confirmations after 10 minutes.
    if (createdAt && now - createdAt > 10 * 60 * 1000) {
      pendingConfirmations.delete(key);
      continue;
    }
    return true;
  }
  return false;
}

function updateUserContextAfterExecution(userId, { intent = null, params = {}, toolResult = {} } = {}) {
  if (!toolResult?.success) return;

  const context = getUserContext(userId);
  if (intent) {
    context.lastIntent = intent;
  }

  const bookingId = params?.bookingId;
  if (bookingId !== undefined && bookingId !== null && String(bookingId).trim() !== '') {
    const numeric = Number.parseInt(String(bookingId), 10);
    if (Number.isFinite(numeric)) {
      context.lastBookingId = numeric;
    }
  }

  const resultBookingId = toolResult?.data?.id ?? toolResult?.data?.bookingId ?? null;
  if (resultBookingId !== null && resultBookingId !== undefined) {
    const numeric = Number.parseInt(String(resultBookingId), 10);
    if (Number.isFinite(numeric)) {
      context.lastBookingId = numeric;
    }
  }

  const bookings = getBookingsListFromData(toolResult?.data);
  const latestBooking = pickMostRecentBooking(bookings);
  const latestId = latestBooking?.id ?? null;
  if (latestId !== null && latestId !== undefined) {
    const numeric = Number.parseInt(String(latestId), 10);
    if (Number.isFinite(numeric)) {
      context.lastBookingId = numeric;
    }
  }

  if (toolResult?.success && (intent === 'bookings' || params?.bookingId || toolResult?.data?.bookingId || toolResult?.data?.id)) {
    clearPendingBooking(userId);
  }
}

function inferIntentFromTool(toolName) {
  if (toolName === 'getWallet') return 'wallet';
  if (toolName === 'getBookings' || toolName === 'cancelBooking' || toolName === 'createBooking') return 'bookings';
  if (toolName === 'getNotifications' || toolName === 'markNotificationsRead') return 'notifications';
  return null;
}

function splitCommands(message) {
  const text = normalizeText(message);
  return text
    .split(/\b(?:and|then)\b/i)
    .map((part) => normalizeText(part))
    .filter(Boolean);
}

function isCancelRequest(message) {
  return /\bcancel\b/i.test(String(message || ''));
}

function hasContextReference(message) {
  return /\b(it|that|this)\b/i.test(String(message || ''));
}

function getBookingsListFromData(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.bookings)) return data.bookings;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function pickMostRecentBooking(bookings) {
  if (!Array.isArray(bookings) || bookings.length === 0) return null;

  const withDate = bookings
    .map((booking) => {
      const stamp = booking?.scheduledAt || booking?.createdAt || booking?.date || booking?.updatedAt || null;
      const ts = stamp ? new Date(stamp).getTime() : Number.NaN;
      return { booking, ts };
    })
    .filter((entry) => Number.isFinite(entry.ts))
    .sort((a, b) => b.ts - a.ts);

  if (withDate.length > 0) {
    return withDate[0].booking;
  }

  return bookings[0] || null;
}

function resolveParamsWithContext(message, params, context) {
  const merged = { ...(params || {}) };
  if (!merged.bookingId && hasContextReference(message) && context?.lastBookingId) {
    merged.bookingId = context.lastBookingId;
  }
  return merged;
}

async function resolveLatestBookingId({ user, token }) {
  const result = await executeTool({
    toolName: 'getBookings',
    params: {},
    userContext: {
      userId: user.id,
      role: user.role,
      token,
    },
  });

  if (!result.success) {
    return { success: false, bookingId: null, bookingsData: null };
  }

  const bookings = getBookingsListFromData(result.data);
  const latestBooking = pickMostRecentBooking(bookings);
  const latestId = latestBooking?.id ?? null;
  if (latestId === null || latestId === undefined) {
    return { success: true, bookingId: null, bookingsData: result.data };
  }

  const numeric = Number.parseInt(String(latestId), 10);
  if (!Number.isFinite(numeric)) {
    return { success: true, bookingId: null, bookingsData: result.data };
  }

  return {
    success: true,
    bookingId: numeric,
    bookingsData: result.data,
  };
}

function detectIntent(message) {
  const text = normalizeText(message).toLowerCase();
  const scores = {
    wallet: 0,
    bookings: 0,
    notifications: 0,
  };

  for (const [intent, keywords] of Object.entries(intentPatterns)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        scores[intent] += 1;
      }
    }
  }

  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [bestIntent, bestScore] = entries[0] || [null, 0];

  if (!bestIntent || bestScore <= 0) {
    return { intent: null, score: 0 };
  }

  return {
    intent: bestIntent,
    score: bestScore,
  };
}

function extractParams(message) {
  const text = normalizeText(message);
  const latestBooking = /\b(last|latest|recent)\b/i.test(text);
  const numberMatch = text.match(/\d+/);

  if (!numberMatch) {
    return latestBooking ? { latestBooking: true } : {};
  }

  const numeric = Number.parseInt(numberMatch[0], 10);
  if (!Number.isFinite(numeric)) {
    return {};
  }

  const out = { bookingId: numeric };
  if (latestBooking) out.latestBooking = true;
  return out;
}

function detectService(message) {
  const text = normalizeText(message).toLowerCase();
  for (const [keyword, serviceName] of Object.entries(serviceMap)) {
    if (text.includes(keyword)) {
      return serviceName;
    }
  }
  return null;
}

function isBookingRequest(message) {
  return /\b(book|schedule|create booking)\b/i.test(String(message || ''));
}

function isRescheduleRequest(message) {
  return /\b(reschedule|change time)\b/i.test(String(message || ''));
}

function isPartialBookingHint(message) {
  const text = normalizeText(message).toLowerCase();
  const hasWorkerPreference = /\b(cheap|cheapest|best|top)\b/i.test(text);
  const hasTimingHint = Boolean(extractTime(text)) || /\b(tomorrow|today|maybe|later|5pm|6pm|7pm|8pm)\b/i.test(text);
  return hasWorkerPreference && hasTimingHint;
}

function isLikelyNonsenseInput(message) {
  const text = normalizeText(message);
  if (!text) return true;
  const lowered = text.toLowerCase();
  const alpha = (text.match(/[a-z]/gi) || []).length;
  const hasMeaningfulWords = /\b(book|booking|wallet|notification|cancel|reschedule|service|worker|time|tomorrow|today|best|cheapest)\b/i.test(text);
  if (hasMeaningfulWords) return false;
  if (!/\s/.test(lowered) && lowered.length >= 7 && /^[a-z]+$/i.test(lowered)) {
    // Single long token with no known intent words is likely gibberish.
    return true;
  }
  return alpha < 3;
}

async function doesUserOwnBooking({ user, token, bookingId }) {
  const result = await executeTool({
    toolName: 'getBookings',
    params: {},
    userContext: {
      userId: user.id,
      role: user.role,
      token,
    },
  });

  if (!result?.success) return false;
  const bookings = getBookingsListFromData(result.data);
  return bookings.some((booking) => String(booking?.id) === String(bookingId));
}

function isComparisonRequest(message) {
  return /\b(which is better|compare|difference)\b/i.test(String(message || ''));
}

function isChangeWorkerRequest(message) {
  const text = normalizeText(message);
  return /^no$/i.test(text) || /\b(not this|change worker|different worker|another worker)\b/i.test(text);
}

function getWorkerChoiceFromMessage(message) {
  const text = normalizeText(message).toLowerCase();
  if (/\b(cheap|cheapest)\b/i.test(text)) return 'cheap';
  if (/\b(best|top|top\s+rated)\b/i.test(text)) return 'best';
  return null;
}

function buildWorkerComparisonMessage(context) {
  const bestName = context?.workerMetadata?.bestWorkerName || 'Recommended worker';
  const bestRating = context?.workerMetadata?.bestWorkerRating;
  const cheapName = context?.workerMetadata?.cheapestWorkerName || 'Affordable worker';
  const cheapPrice = context?.workerMetadata?.cheapestWorkerPrice;

  const ratingText = Number.isFinite(Number(bestRating)) ? `${Number(bestRating).toFixed(1)}⭐` : 'high rating';
  const priceText = formatPrice(cheapPrice);

  if (context?.bestWorkerId && context?.cheapestWorkerId && String(context.bestWorkerId) === String(context.cheapestWorkerId)) {
    return `${bestName} is both highly rated (${ratingText}) and affordable (${priceText}).`;
  }

  return `${bestName} has higher rating (${ratingText}) while ${cheapName} is cheaper (${priceText}).`;
}

function pickWorkersFromResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.workers)) return data.workers;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function selectWorkerByPreference(message, workers = []) {
  if (!Array.isArray(workers) || workers.length === 0) return null;

  const text = normalizeText(message).toLowerCase();
  const numberMatch = text.match(/\b(1|2|3)\b/);
  if (numberMatch) {
    const idx = Number.parseInt(numberMatch[1], 10) - 1;
    if (workers[idx]) return workers[idx];
  }

  // Enhanced: "best", "top", "top rated" all map to highest rating
  if (/\b(best|top|top\s+rated)\b/i.test(text)) {
    return [...workers].sort((a, b) => (Number(b?.rating || 0) - Number(a?.rating || 0)))[0] || null;
  }

  if (/\b(cheap|cheapest)\b/i.test(text)) {
    return [...workers].sort((a, b) => (Number(a?.price || a?.hourlyRate || Number.MAX_SAFE_INTEGER) - Number(b?.price || b?.hourlyRate || Number.MAX_SAFE_INTEGER)))[0] || null;
  }

  return null;
}

function extractTime(message) {
  const text = normalizeText(message).toLowerCase();
  const isTomorrow = text.includes('tomorrow');
  const isToday = text.includes('today');

  const timeMatch = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (!timeMatch) {
    return null;
  }

  const hourRaw = Number.parseInt(timeMatch[1], 10);
  const minuteRaw = Number.parseInt(timeMatch[2] || '0', 10);
  const meridiem = String(timeMatch[3] || '').toLowerCase();
  if (!Number.isFinite(hourRaw) || !Number.isFinite(minuteRaw)) return null;
  if (hourRaw < 1 || hourRaw > 12 || minuteRaw < 0 || minuteRaw > 59) return null;

  let hour24 = hourRaw % 12;
  if (meridiem === 'pm') hour24 += 12;

  const date = new Date();
  if (isTomorrow) {
    date.setDate(date.getDate() + 1);
  }
  if (!isToday && !isTomorrow) {
    // When time is present but day is omitted, treat as today.
  }

  date.setHours(hour24, minuteRaw, 0, 0);
  return {
    scheduledAt: date.toISOString(),
  };
}

function hasRoleAccessToTool(role, toolName) {
  const allowed = roleToolAccess[String(role || '').toUpperCase()];
  if (!allowed) return false;
  return allowed.has(toolName);
}

async function callInternalApi({ method, endpoint, token, body = null }) {
  const baseUrl = process.env.INTERNAL_API_BASE_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;
  const url = `${baseUrl}${endpoint}`;
  const normalizedMethod = String(method || '').toUpperCase();
  const config = {
    timeout: Number(process.env.AI_TOOL_TIMEOUT_MS || 12000),
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  if (normalizedMethod === 'GET') {
    const cached = getCachedResponse(normalizedMethod, endpoint);
    if (cached !== null) {
      return { data: cached };
    }
    const response = await axios.get(url, config);
    setCachedResponse(normalizedMethod, endpoint, response?.data ?? null);
    return response;
  }
  if (normalizedMethod === 'POST') {
    return axios.post(url, body || {}, config);
  }

  if (normalizedMethod === 'PATCH') {
    return axios.patch(url, body || {}, config);
  }

  throw new Error(`Unsupported internal method: ${method}`);
}

async function fetchTrustSummary(token) {
  try {
    const response = await callInternalApi({
      method: 'GET',
      endpoint: '/api/reviews/received',
      token,
    });

    const raw = response?.data;
    const reviews = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.reviews)
        ? raw.reviews
        : Array.isArray(raw?.data)
          ? raw.data
          : [];

    if (reviews.length === 0) {
      return { averageRating: null, reviewCount: 0 };
    }

    const ratings = reviews
      .map((review) => Number(review?.rating))
      .filter((value) => Number.isFinite(value) && value > 0);

    if (ratings.length === 0) {
      return { averageRating: null, reviewCount: reviews.length };
    }

    const total = ratings.reduce((sum, value) => sum + value, 0);
    return {
      averageRating: Math.round((total / ratings.length) * 10) / 10,
      reviewCount: reviews.length,
    };
  } catch {
    return { averageRating: null, reviewCount: 0 };
  }
}

async function fetchTopWorkersForService({ serviceId, token }) {
  const [workersResp, trustSummary] = await Promise.all([
    callInternalApi({ method: 'GET', endpoint: `/api/services/${serviceId}/workers`, token }),
    fetchTrustSummary(token),
  ]);

  const workers = pickWorkersFromResponse(workersResp?.data);
  const sorted = [...workers].sort((a, b) => {
    const ratingDiff = Number(b?.rating || 0) - Number(a?.rating || 0);
    if (ratingDiff !== 0) return ratingDiff;
    return Number(a?.price || a?.hourlyRate || Number.MAX_SAFE_INTEGER)
      - Number(b?.price || b?.hourlyRate || Number.MAX_SAFE_INTEGER);
  });

  const workerList = sorted.slice(0, 3).map((worker) => ({
    id: worker?.id,
    name: worker?.name || worker?.user?.name || 'Worker',
    rating: Number(worker?.rating || trustSummary.averageRating || 0),
    reviewCount: Number(worker?.reviewCount || trustSummary.reviewCount || 0),
    jobsCompleted: Number(worker?.jobsCompleted || worker?.completedJobs || worker?.totalJobs || 0),
    price: worker?.price || worker?.hourlyRate || null,
  }));

  // Identify best (highest rating) and cheapest (lowest price)
  let bestWorker = workerList[0] || null;
  let cheapestWorker = workerList[0] || null;
  
  for (const w of workerList) {
    if ((w?.rating || 0) > (bestWorker?.rating || 0)) {
      bestWorker = w;
    }
    const wPrice = w?.price || Number.MAX_SAFE_INTEGER;
    const cPrice = cheapestWorker?.price || Number.MAX_SAFE_INTEGER;
    if (wPrice < cPrice) {
      cheapestWorker = w;
    }
  }

  return {
    workers: workerList,
    bestWorkerId: bestWorker?.id || null,
    cheapestWorkerId: cheapestWorker?.id || null,
    bestWorkerName: bestWorker?.name || null,
    cheapestWorkerName: cheapestWorker?.name || null,
    bestWorkerRating: bestWorker?.rating || null,
    bestWorkerReviewCount: bestWorker?.reviewCount || 0,
    bestWorkerJobsCompleted: bestWorker?.jobsCompleted || 0,
    cheapestWorkerPrice: cheapestWorker?.price || null,
    cheapestWorkerReviewCount: cheapestWorker?.reviewCount || 0,
    cheapestWorkerJobsCompleted: cheapestWorker?.jobsCompleted || 0,
  };
}

async function resolveServiceId({ message, token }) {
  const detectedService = detectService(message);
  if (!detectedService) {
    return { serviceId: null, serviceName: null };
  }

  try {
    const response = await callInternalApi({
      method: 'GET',
      endpoint: '/api/services',
      token,
    });

    const raw = response?.data;
    const services = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.services)
        ? raw.services
        : Array.isArray(raw?.data)
          ? raw.data
          : [];

    const match = services.find((service) => {
      const name = String(service?.name || '').toLowerCase();
      return name.includes(detectedService.toLowerCase()) || detectedService.toLowerCase().includes(name);
    });

    return {
      serviceId: match?.id ?? null,
      serviceName: detectedService,
    };
  } catch {
    return {
      serviceId: null,
      serviceName: detectedService,
    };
  }
}

async function resolveCreateBookingParams({ message, token }) {
  const [serviceInfo, timeInfo] = await Promise.all([
    resolveServiceId({ message, token }),
    Promise.resolve(extractTime(message)),
  ]);

  return {
    serviceId: serviceInfo.serviceId,
    serviceName: serviceInfo.serviceName,
    scheduledAt: timeInfo?.scheduledAt || null,
  };
}

async function resolveCustomerAddressDetails(token) {
  try {
    const response = await callInternalApi({
      method: 'GET',
      endpoint: '/api/customers/profile',
      token,
    });

    const user = response?.data?.user || {};
    const addresses = Array.isArray(user?.addresses) ? user.addresses : [];
    const primary = addresses[0] || null;
    if (!primary) return null;

    const parts = [
      primary?.line1,
      primary?.line2,
      primary?.city,
      primary?.state,
      primary?.postalCode,
      primary?.country,
    ].map((item) => String(item || '').trim()).filter(Boolean);

    const joined = parts.join(', ').trim();
    return joined || null;
  } catch {
    return null;
  }
}

function getBypassResponseMeta(toolName) {
  if (toolName === 'getWallet') {
    return {
      title: 'Your Wallet',
      message: 'Here is your wallet summary.',
      suggestions: ['Add money', 'View transactions'],
      target: '/customer/wallet',
    };
  }

  if (toolName === 'getBookings') {
    return {
      title: 'Your Bookings',
      message: 'Here are your bookings.',
      suggestions: ['View details', 'Cancel booking'],
      target: '/bookings',
    };
  }

  return {
    title: 'Your Notifications',
    message: 'Here are your latest notifications.',
    suggestions: ['Mark all as read'],
    target: '/notifications',
  };
}

function getDynamicSuggestionsForData(toolName, data) {
  if (toolName === 'getWallet') {
    return ['Add money', 'View transactions'];
  }

  if (toolName === 'getNotifications') {
    return ['Mark all as read'];
  }

  if (toolName === 'getBookings') {
    const bookings = getBookingsListFromData(data);
    if (bookings.length > 0) {
      return ['Cancel latest booking', 'View booking details'];
    }
    return [];
  }

  return [];
}

function buildBypassDataResponse({ sessionId, toolName, data }) {
  const meta = getBypassResponseMeta(toolName);
  const suggestions = getDynamicSuggestionsForData(toolName, data);
  const conversationalMessage = formatConversationalResponse({
    type: toolName === 'getWallet' ? 'wallet' : 'data',
    toolName,
    data,
    fallbackMessage: meta.message,
  });
  return {
    type: 'data',
    title: meta.title,
    data,
    message: conversationalMessage,
    reply: conversationalMessage,
    suggestions,
    action: 'navigate',
    target: meta.target,
    sessionId,
  };
}

function isUserRateLimited(userId) {
  const now = Date.now();
  const userKey = String(userId);
  const existing = userRequestTracker.get(userKey) || [];
  const recent = existing.filter((timestamp) => now - timestamp <= 10_000);

  if (recent.length >= 5) {
    userRequestTracker.set(userKey, recent);
    return true;
  }

  recent.push(now);
  userRequestTracker.set(userKey, recent);
  return false;
}

function clampGroqTimeout(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 4000;
  return Math.max(2000, Math.min(5000, Math.trunc(numeric)));
}

function validateLlmEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object') return false;

  const type = String(envelope.type || '').trim();
  if (!type) return false;
  if (type !== 'text' && type !== 'tool_call') return false;

  if (type === 'text') {
    return typeof envelope.message === 'string' && envelope.message.trim().length > 0;
  }

  const toolName = String(envelope.tool || '').trim();
  if (!toolName) return false;
  if (!getTool(toolName)) return false;
  if (!envelope.params || typeof envelope.params !== 'object' || Array.isArray(envelope.params)) {
    return false;
  }

  return true;
}

function toTextResponse({ sessionId, message, intent = null }) {
  const msg = String(message || 'Done.');
  return {
    type: 'text',
    message: msg,
    reply: msg,
    sessionId,
    intent,
  };
}

function toConfirmationResponse({ sessionId, message, metadata = {} }) {
  const msg = String(message || 'Please confirm this action.');
  return {
    type: 'confirmation',
    message: msg,
    reply: msg,
    sessionId,
    metadata,
  };
}

function formatPrice(price) {
  if (price === null || price === undefined) return 'N/A';
  const num = Number(price);
  if (!Number.isFinite(num)) return 'N/A';
  return `₹${Math.round(num)}`;
}

function getWalletData(raw) {
  if (!raw || typeof raw !== 'object') return { balance: null, transactions: [] };
  const wallet = raw?.wallet || raw?.data?.wallet || raw;
  const balance = wallet?.balance ?? wallet?.walletBalance ?? wallet?.availableBalance ?? wallet?.amount ?? null;
  const transactions = Array.isArray(wallet?.transactions) ? wallet.transactions : [];
  return { balance, transactions };
}

function buildWalletTransactionsMessage(raw) {
  const { transactions } = getWalletData(raw);
  if (!transactions.length) {
    return 'You do not have any transactions yet. Want to add money to your wallet?';
  }

  const latest = transactions.slice(0, 3).map((txn, idx) => {
    const amount = Number(txn?.amount || 0);
    const sign = amount >= 0 ? '+' : '-';
    const description = String(txn?.description || txn?.type || 'Transaction').trim();
    return `${idx + 1}. ${description} (${sign}${formatPrice(Math.abs(amount))})`;
  });

  return `Here are your latest wallet transactions: ${latest.join(' | ')}`;
}

function isViewTransactionsRequest(message) {
  return /\b(view|show|see|check)\b.*\b(transaction|transactions|history|statement)\b/i.test(String(message || ''))
    || /\b(transaction|transactions|history|statement)\b/i.test(String(message || ''));
}

function isAddMoneyRequest(message) {
  return /\b(add|top\s?up|load|deposit)\b.*\b(money|wallet|balance|funds)\b/i.test(String(message || ''))
    || /^\s*add\s+money\s*$/i.test(String(message || ''));
}

function isProfileNavigationRequest(message) {
  return /\b(profile|my profile|open profile|show profile|edit profile)\b/i.test(String(message || ''));
}

function isWorkerProfileNavigationRequest(message) {
  return /\b(worker profile|open worker profile|show worker profile)\b/i.test(String(message || ''));
}

function isCustomerProfileNavigationRequest(message) {
  return /\b(customer profile|open customer profile|show customer profile)\b/i.test(String(message || ''));
}

function isVerificationNavigationRequest(message) {
  return /\b(verification|verify profile|verification flow|open verification)\b/i.test(String(message || ''));
}

function applyTone(message) {
  let msg = String(message || '').trim();
  if (!msg) return msg;

  const replacements = [
    [/\bYour request has been successfully processed\b/gi, "Done. You're all set."],
    [/\bAction completed successfully\.?\b/gi, "Done. You're all set."],
    [/\bUnable to process request right now\.?\b/gi, "I couldn't do that right now."],
    [/\bHere is\b/gi, "Here's"],
    [/\bHere are\b/gi, "Here are"],
  ];

  for (const [pattern, replacement] of replacements) {
    msg = msg.replace(pattern, replacement);
  }

  msg = msg.replace(/\s{2,}/g, ' ').trim();
  return msg;
}

function formatConversationalResponse(data = {}) {
  if (data.type === 'worker_recommendation') {
    const bestName = data?.bestWorkerName;
    const bestRating = Number(data?.bestWorkerRating || 0);
    const bestJobs = Number(data?.bestWorkerJobsCompleted || 0);
    const bestReviews = Number(data?.bestWorkerReviewCount || 0);
    const cheapName = data?.cheapestWorkerName;
    const cheapPrice = data?.cheapestWorkerPrice;

    const trust = bestJobs > 0
      ? `${bestJobs} jobs completed`
      : (bestReviews > 0 ? `${bestReviews} reviews` : 'strong reviews');

    if (bestName && cheapName && cheapPrice !== null && cheapPrice !== undefined) {
      return `I found a great option - ${bestName} has a ${bestRating.toFixed(1)}⭐ rating and ${trust}. If budget matters, ${cheapName} is the most affordable at ${formatPrice(cheapPrice)}.`;
    }

    return data.fallbackMessage || 'I found a few good options for you.';
  }

  if (data.type === 'booking_summary') {
    const parts = [];
    if (data.serviceName) parts.push(data.serviceName);
    if (data.scheduledAt) parts.push(`at ${data.scheduledAt}`);
    if (data.workerName) parts.push(`with ${data.workerName}`);
    if (data.price !== null && data.price !== undefined) parts.push(`for ${formatPrice(data.price)}`);
    const detail = parts.length > 0 ? `You're booking ${parts.join(' ')}.` : 'You are about to place this booking.';
    return `${detail}${data.trustSignal ? ` ${data.trustSignal}` : ''}`.trim();
  }

  if (data.type === 'wallet') {
    const raw = data?.data;
    const wallet = raw?.wallet || raw?.data?.wallet || raw || {};
    const balance = wallet?.balance ?? wallet?.walletBalance ?? wallet?.availableBalance ?? wallet?.amount ?? null;
    if (balance !== null && balance !== undefined && Number.isFinite(Number(balance))) {
      return `Your wallet balance is ${formatPrice(balance)}.`;
    }
    return data.fallbackMessage || "Here's your wallet summary.";
  }

  return data.fallbackMessage || 'Done.';
}

function getRuleBasedFollowUp(response = {}) {
  const title = String(response?.title || '').toLowerCase();
  const target = String(response?.target || '').toLowerCase();
  const message = String(response?.message || '').toLowerCase();
  const suggestions = Array.isArray(response?.suggestions) ? response.suggestions : [];

  if (response?.type === 'confirmation') {
    return 'Should I go ahead and confirm this?';
  }

  if (
    title.includes('available workers')
    || suggestions.some((item) => /book best worker|book cheapest worker/i.test(String(item)))
    || message.includes('worker')
  ) {
    return 'Want me to book the best option for you?';
  }

  if (target === '/wallet' || target === '/customer/wallet' || title.includes('wallet')) {
    return 'Do you want to add money or view transactions?';
  }

  if (message.includes('wallet') || message.includes('transaction')) {
    return 'Do you want to add money or view transactions?';
  }

  if (message.includes('booking') && response?.type !== 'confirmation') {
    return 'Need help with anything else in this booking?';
  }

  return 'What would you like to do next?';
}

function appendFollowUp(message, response = {}) {
  const base = String(message || '').trim();
  if (!base) return base;
  const followUp = getRuleBasedFollowUp(response);
  if (!followUp) return base;
  if (base.toLowerCase().includes(followUp.toLowerCase())) return base;
  return `${base} ${followUp}`.trim();
}

function mergeMultiResponses(responses = []) {
  const fragments = responses
    .map((item) => String(item?.message || item?.reply || '').trim())
    .filter(Boolean);

  if (fragments.length === 0) {
    return 'Done. I handled those steps.';
  }

  return fragments.join(' ');
}

function enhanceOutgoingResponse(response) {
  if (!response || typeof response !== 'object') return response;

  const out = { ...response };

  if (out.type === 'multi' && Array.isArray(out.responses)) {
    const combined = mergeMultiResponses(out.responses);
    out.message = combined;
    out.reply = combined;
  }

  if (typeof out.message === 'string' && out.message.trim().length > 0) {
    const toned = applyTone(out.message);
    const withFollowUp = appendFollowUp(toned, out);
    out.message = withFollowUp;
    out.reply = withFollowUp;
  }

  return out;
}

function getToolUsedFromResponse(response) {
  if (!response || typeof response !== 'object') return null;
  if (response?.metadata?.tool) return String(response.metadata.tool);
  if (response?.intent?.tool) return String(response.intent.tool);
  if (response?.toolResult && typeof response.toolResult === 'object' && response.toolResult.toolName) {
    return String(response.toolResult.toolName);
  }
  return null;
}

function inferResponseSuccess(response) {
  if (!response || typeof response !== 'object') return false;
  const msg = String(response.message || '').toLowerCase();
  if (msg.includes('something went wrong')) return false;
  if (msg.includes('failed')) return false;
  if (response.toolResult && response.toolResult.success === false) return false;
  return true;
}

function requiresConfirmationForTool(toolName) {
  const normalized = String(toolName || '').trim();
  if (!normalized) return false;
  return normalized === 'createBooking' || normalized === 'cancelBooking' || /payment|pay/i.test(normalized);
}

function buildWorkerRecommendationMessage(workerMetadata) {
  if (!workerMetadata) return '';

  return formatConversationalResponse({
    type: 'worker_recommendation',
    bestWorkerName: workerMetadata.bestWorkerName,
    bestWorkerRating: workerMetadata.bestWorkerRating,
    bestWorkerReviewCount: workerMetadata.bestWorkerReviewCount,
    bestWorkerJobsCompleted: workerMetadata.bestWorkerJobsCompleted,
    cheapestWorkerName: workerMetadata.cheapestWorkerName,
    cheapestWorkerPrice: workerMetadata.cheapestWorkerPrice,
    fallbackMessage: 'I found a few workers you can choose from.',
  });
}

function buildBookingTrustSignal({ selectedWorkerId, bestWorkerId, cheapestWorkerId, workerMetadata }) {
  if (!selectedWorkerId || !workerMetadata) return '';

  if (bestWorkerId && String(selectedWorkerId) === String(bestWorkerId)) {
    const stars = Number(workerMetadata.bestWorkerRating || 0).toFixed(1);
    return `You're booking with a highly rated worker (${stars}⭐).`;
  }

  if (cheapestWorkerId && String(selectedWorkerId) === String(cheapestWorkerId)) {
    return `You're booking the most affordable option (${formatPrice(workerMetadata.cheapestWorkerPrice)}).`;
  }

  return '';
}

function buildBookingSummary({ serviceName, scheduledAt, workerName, price, trustSignal = '' }) {
  const base = formatConversationalResponse({
    type: 'booking_summary',
    serviceName,
    scheduledAt,
    workerName,
    price,
    trustSignal,
  });
  return `${base} Confirm?`;
}

function toToolSchemaForPrompt(tool) {
  return {
    name: tool.name,
    description: tool.description,
    method: tool.method,
    endpoint: tool.endpoint,
    requiredParams: tool.requiredParams,
    allowedRoles: tool.allowedRoles,
  };
}

function buildSystemPrompt(tools, role) {
  return [
    'You are an AI agent that can call tools.',
    `Current authenticated role: ${role}`,
    'STRICT RULES (MUST FOLLOW):',
    '1) Always respond with valid JSON only.',
    '2) Only two response types are allowed: "text" or "tool_call".',
    '3) Never assume or invent userId.',
    '4) Only use the provided tools.',
    '5) Ask confirmation before destructive actions such as cancelBooking.',
    '6) Do not output markdown, code fences, or additional commentary.',
    'Available tools are below as JSON. Use only these tools.',
    JSON.stringify(tools, null, 2),
    'OUTPUT FORMAT:',
    'Text format:',
    '{"type":"text","message":"..."}',
    'Tool-call format:',
    '{"type":"tool_call","tool":"getWallet","params":{}}',
    'For cancel request with bookingId, return tool_call cancelBooking and params.bookingId.',
  ].join('\n');
}

async function callGroqChatOnce({ systemPrompt, userPrompt }) {
  const apiKey = String(process.env.GROQ_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured.');
  }

  const model = String(process.env.GROQ_MODEL || 'llama3-8b-8192').trim();
  const timeoutMs = clampGroqTimeout(process.env.GROQ_TIMEOUT_MS || 4000);

  const response = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    },
    {
      timeout: timeoutMs,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const content = String(response?.data?.choices?.[0]?.message?.content || '').trim();
  if (!content) {
    throw new Error('Invalid Groq response content.');
  }

  return content;
}

async function callGroqChatWithSingleRetry({ systemPrompt, userPrompt }) {
  try {
    const content = await callGroqChatOnce({ systemPrompt, userPrompt });
    return { ok: true, content, error: null };
  } catch (firstError) {
    console.log('[ai-groq] first attempt failed:', firstError?.message || firstError);
    try {
      const content = await callGroqChatOnce({ systemPrompt, userPrompt });
      return { ok: true, content, error: null };
    } catch (secondError) {
      console.log('[ai-groq] retry failed:', secondError?.message || secondError);
      return { ok: false, content: '', error: secondError };
    }
  }
}

async function runAgentLoop({ user, message, sessionId, token }) {
  const tools = listTools();
  const promptTools = tools.map(toToolSchemaForPrompt);

  const systemPrompt = buildSystemPrompt(promptTools, user.role);
  const llmCall = await callGroqChatWithSingleRetry({
    systemPrompt,
    userPrompt: `User message: ${message}`,
  });

  if (!llmCall.ok) {
    console.log(`[ai-chat] userId=${user.id} groq_error=${llmCall.error?.message || 'unknown'}`);
    return toTextResponse({ sessionId, message: GROQ_UNAVAILABLE_MESSAGE });
  }

  const llmRaw = llmCall.content;

  const llmOutput = parseJsonEnvelope(llmRaw);
  if (!validateLlmEnvelope(llmOutput)) {
    console.log(`[ai-chat] userId=${user.id} invalid_llm_output=true raw=${llmRaw.slice(0, 250)}`);
    return toTextResponse({
      sessionId,
      message: LLM_PARSE_FALLBACK_MESSAGE,
    });
  }

  if (llmOutput.type === 'text') {
    return toTextResponse({
      sessionId,
      message: llmOutput.message || 'I am here to help.',
      intent: { type: 'text' },
    });
  }

  const toolName = String(llmOutput.tool || '').trim();
  if (!hasRoleAccessToTool(user.role, toolName)) {
    return toTextResponse({
      sessionId,
      message: 'This action is not allowed for your role.',
    });
  }
  const params = llmOutput.params && typeof llmOutput.params === 'object' ? llmOutput.params : {};
  const context = getUserContext(user.id);
  const extractedParams = extractParams(message);
  const mergedParams = { ...params };
  if (!mergedParams.bookingId && extractedParams.bookingId) {
    mergedParams.bookingId = extractedParams.bookingId;
  }
  if (extractedParams.latestBooking) {
    mergedParams.latestBooking = true;
  }
  Object.assign(mergedParams, resolveParamsWithContext(message, mergedParams, context));

  if (!mergedParams.bookingId && mergedParams.latestBooking) {
    const latest = await resolveLatestBookingId({ user, token });
    if (latest.success && latest.bookingId) {
      mergedParams.bookingId = latest.bookingId;
    }
  }
  console.log(`[ai-chat] userId=${user.id} detected_tool=${toolName}`);

  if (requiresConfirmationForTool(toolName)) {
    if (toolName === 'cancelBooking') {
      const bookingId = mergedParams.bookingId;
      if (bookingId === undefined || bookingId === null || String(bookingId).trim() === '') {
        return toTextResponse({
          sessionId,
          message: 'Please provide a booking id to cancel. Example: Cancel booking 123',
        });
      }
      mergedParams.bookingId = String(bookingId).trim();
    }

    const sessionKey = getSessionKey(user.id, sessionId);
    pendingConfirmations.set(sessionKey, {
      toolName,
      params: { ...mergedParams },
      createdAt: Date.now(),
      intent: inferIntentFromTool(toolName),
    });

    const confirmationMessage = toolName === 'cancelBooking'
      ? `Are you sure you want to cancel booking #${mergedParams.bookingId}?`
      : `Please confirm before I proceed with ${toolName}.`;

    return toConfirmationResponse({
      sessionId,
      message: confirmationMessage,
      metadata: {
        tool: toolName,
        bookingId: mergedParams.bookingId || null,
      },
    });
  }

  const toolResult = await executeTool({
    toolName,
    params: mergedParams,
    userContext: {
      userId: user.id,
      role: user.role,
      token,
    },
  });
  updateUserContextAfterExecution(user.id, {
    intent: inferIntentFromTool(toolName),
    params: mergedParams,
    toolResult,
  });
  console.log(`[ai-chat] userId=${user.id} tool=${toolName} success=${Boolean(toolResult?.success)}`);

  const followUpPrompt = [
    'You are an AI assistant. Convert tool result into short user-facing response JSON only.',
    'Return format: {"type":"text","message":"..."}',
    `Tool called: ${toolName}`,
    `Tool result: ${JSON.stringify(toolResult)}`,
  ].join('\n');

  const finalSystemPrompt = [
    'You are an AI formatter.',
    'Always output valid JSON only.',
    'Allowed types: text, tool_call.',
    'Never include markdown or code fences.',
    'Prefer text response when tool result is already available.',
  ].join('\n');

  const finalLlmCall = await callGroqChatWithSingleRetry({
    systemPrompt: finalSystemPrompt,
    userPrompt: followUpPrompt,
  });

  if (!finalLlmCall.ok) {
    console.log(`[ai-chat] userId=${user.id} final_format_groq_error=${finalLlmCall.error?.message || 'unknown'}`);
    return toTextResponse({ sessionId, message: GROQ_UNAVAILABLE_MESSAGE });
  }

  const finalRaw = finalLlmCall.content;

  const finalJson = parseJsonEnvelope(finalRaw);
  if (validateLlmEnvelope(finalJson) && finalJson?.type === 'text' && finalJson?.message) {
    return {
      ...toTextResponse({
        sessionId,
        message: finalJson.message,
        intent: { type: 'tool_call', tool: toolName },
      }),
      toolResult,
    };
  }

  const fallbackMessage = toolResult.success
    ? `Action completed using ${toolName}.`
    : FAILSAFE_MESSAGE;

  return {
    ...toTextResponse({
      sessionId,
      message: fallbackMessage,
      intent: { type: 'tool_call', tool: toolName },
    }),
    toolResult,
  };
}

async function handleSingleCommand({ user, message, sessionId, token }) {
  let text = normalizeText(message);
  const authToken = getAuthTokenFromContext({ token });
  const context = getUserContext(user.id);
  const userRole = String(user.role || '').toUpperCase();

  if (isLikelyNonsenseInput(text)) {
    return toTextResponse({
      sessionId,
      message: 'I need a bit more detail - tell me what you want to do, like booking, wallet, or notifications.',
    });
  }

  if (userRole === 'CUSTOMER' && isPartialBookingHint(text) && !context?.pendingBooking?.serviceId) {
    return toTextResponse({
      sessionId,
      message: 'I can help with that. First, tell me which service you need.',
    });
  }

  // Context-aware short responses for vague follow-ups.
  if (userRole === 'CUSTOMER' && (context.lastIntent === 'bookings' || context.pendingBooking)) {
    const timeHint = extractTime(text);
    const isVagueTime = /^tomorrow$/i.test(text) || /\bwhat about\b/i.test(text);
    if (timeHint?.scheduledAt && isVagueTime && context.pendingBooking) {
      context.pendingBooking = {
        ...(context.pendingBooking || {}),
        scheduledAt: timeHint.scheduledAt,
      };
      context.lastIntent = 'bookings';
      updateUserJourney(user.id, {
        bookingStarted: true,
        bookingCompleted: false,
        lastStep: 'time_selected',
      });
      return toTextResponse({
        sessionId,
        message: `Got it - I updated the time to ${timeHint.scheduledAt}.`,
      });
    }

    if (/\bthat one\b/i.test(text) && context.pendingBooking && Array.isArray(context.availableWorkers) && context.availableWorkers.length > 0) {
      const pref = getUserPreference(user.id);
      const selectedId = pref.preference === 'cheap' ? context.cheapestWorkerId : context.bestWorkerId;
      const selectedWorker = context.availableWorkers.find((w) => String(w?.id) === String(selectedId));
      if (selectedId) {
        context.pendingBooking = {
          ...(context.pendingBooking || {}),
          workerId: selectedId,
        };
        updateUserJourney(user.id, {
          bookingStarted: true,
          bookingCompleted: false,
          lastStep: 'worker_selected',
        });
        return toTextResponse({
          sessionId,
          message: `Perfect, I'll use ${selectedWorker?.name || 'that worker'} for this booking.`,
        });
      }
    }
  }

  // Deterministic comparison without LLM.
  if (userRole === 'CUSTOMER' && isComparisonRequest(text) && Array.isArray(context.lastWorkerOptions) && context.lastWorkerOptions.length > 0) {
    return toTextResponse({
      sessionId,
      message: buildWorkerComparisonMessage(context),
    });
  }

  // Undo/correction for worker choice without leaving current booking flow.
  if (
    userRole === 'CUSTOMER'
    && isChangeWorkerRequest(text)
    && context?.pendingBooking?.workerId
    && Array.isArray(context.lastWorkerOptions)
    && context.lastWorkerOptions.length > 0
  ) {
    context.pendingBooking.workerId = null;
    const recommendationMsg = buildWorkerRecommendationMessage(context.workerMetadata);
    const msg = recommendationMsg
      ? `${recommendationMsg}. Choose a different worker.`
      : 'Choose a different worker.';
    return {
      type: 'data',
      title: 'Available Workers',
      data: context.lastWorkerOptions,
      message: msg,
      reply: msg,
      suggestions: ['Book best worker', 'Book cheapest worker'],
      sessionId,
    };
  }

  // If user says "best"/"cheapest" while booking context is active, apply selection directly.
  if (
    userRole === 'CUSTOMER'
    && context?.pendingBooking?.serviceId
    && context?.pendingBooking?.scheduledAt
    && !context?.pendingBooking?.workerId
    && Array.isArray(context.lastWorkerOptions)
    && context.lastWorkerOptions.length > 0
  ) {
    const workerChoice = getWorkerChoiceFromMessage(text);
    if (workerChoice === 'best' && context.bestWorkerId) {
      context.pendingBooking.workerId = context.bestWorkerId;
      setUserPreference(user.id, 'best');
      if (!isBookingRequest(text)) text = 'book best worker';
    } else if (workerChoice === 'cheap' && context.cheapestWorkerId) {
      context.pendingBooking.workerId = context.cheapestWorkerId;
      setUserPreference(user.id, 'cheap');
      if (!isBookingRequest(text)) text = 'book cheapest worker';
    }
  }

  const detected = detectIntent(text);
  const extracted = extractParams(text);
  const paramsWithContext = resolveParamsWithContext(text, extracted, context);

  if (userRole === 'CUSTOMER' && isViewTransactionsRequest(text)) {
    const walletResult = await executeTool({
      toolName: 'getWallet',
      params: {},
      userContext: {
        userId: user.id,
        role: user.role,
        token: authToken,
      },
    });

    if (!walletResult.success) {
      return toTextResponse({
        sessionId,
        message: FAILSAFE_MESSAGE,
      });
    }

    const msg = buildWalletTransactionsMessage(walletResult.data);
    return {
      type: 'data',
      title: 'Wallet Transactions',
      data: walletResult.data,
      message: msg,
      reply: msg,
      suggestions: ['Add money', 'Show my wallet balance'],
      action: 'navigate',
      target: '/customer/wallet',
      sessionId,
    };
  }

  if (userRole === 'CUSTOMER' && isAddMoneyRequest(text)) {
    return {
      type: 'action',
      message: 'Sure - opening your wallet. Use the Add Money section to top up.',
      reply: 'Sure - opening your wallet. Use the Add Money section to top up.',
      suggestions: ['View transactions', 'Show my wallet balance'],
      action: 'navigate',
      target: '/customer/wallet',
      sessionId,
    };
  }

  if (
    isVerificationNavigationRequest(text)
    || isWorkerProfileNavigationRequest(text)
    || isCustomerProfileNavigationRequest(text)
    || isProfileNavigationRequest(text)
  ) {
    if (isVerificationNavigationRequest(text)) {
      if (userRole === 'WORKER') {
        return {
          type: 'action',
          message: 'Opening your verification page.',
          reply: 'Opening your verification page.',
          action: 'navigate',
          target: '/worker/verification',
          suggestions: ['Open profile', 'Open services'],
          sessionId,
        };
      }

      return {
        type: 'action',
        message: 'Verification flow is available in worker account. Opening your profile instead.',
        reply: 'Verification flow is available in worker account. Opening your profile instead.',
        action: 'navigate',
        target: '/customer/profile',
        suggestions: ['Open wallet', 'Show my bookings'],
        sessionId,
      };
    }

    if (isWorkerProfileNavigationRequest(text) && userRole !== 'WORKER') {
      return {
        type: 'action',
        message: 'Worker profile page is only for worker accounts. Opening your customer profile.',
        reply: 'Worker profile page is only for worker accounts. Opening your customer profile.',
        action: 'navigate',
        target: '/customer/profile',
        suggestions: ['Open wallet', 'Show my bookings'],
        sessionId,
      };
    }

    if (isCustomerProfileNavigationRequest(text) && userRole === 'WORKER') {
      return {
        type: 'action',
        message: 'Opening your worker profile page.',
        reply: 'Opening your worker profile page.',
        action: 'navigate',
        target: '/worker/profile',
        suggestions: ['Open verification', 'Open services'],
        sessionId,
      };
    }

    const target = userRole === 'WORKER' ? '/worker/profile' : '/customer/profile';
    return {
      type: 'action',
      message: 'Opening your profile page.',
      reply: 'Opening your profile page.',
      action: 'navigate',
      target,
      suggestions: userRole === 'WORKER'
        ? ['Open verification', 'Open services']
        : ['Open wallet', 'Show my bookings'],
      sessionId,
    };
  }

  // Role-based assistance routes (non-LLM).
  if (userRole === 'WORKER') {
    try {
      if (/\bavailability\b/i.test(text)) {
        const response = await callInternalApi({ method: 'GET', endpoint: '/api/availability/me', token: authToken });
        return {
          type: 'data',
          title: 'Your Availability',
          data: response?.data ?? null,
          message: 'Here is your current availability.',
          reply: 'Here is your current availability.',
          suggestions: ['Update availability', 'View bookings'],
          action: 'navigate',
          target: '/worker/availability',
          sessionId,
        };
      }

      const bookingIdForWorker = paramsWithContext.bookingId;
      if (/\baccept\b/i.test(text) && bookingIdForWorker) {
        const response = await callInternalApi({ method: 'POST', endpoint: `/api/bookings/${bookingIdForWorker}/accept`, token: authToken });
        context.lastBookingId = Number.parseInt(String(bookingIdForWorker), 10);
        context.lastIntent = 'bookings';
        return {
          type: 'data',
          title: 'Booking Accepted',
          data: response?.data ?? null,
          message: 'Booking accepted successfully.',
          reply: 'Booking accepted successfully.',
          action: 'navigate',
          target: '/bookings',
          sessionId,
        };
      }
      if (/\baccept\b/i.test(text) && !bookingIdForWorker) {
        return toTextResponse({
          sessionId,
          message: 'Please share the booking id to accept.',
        });
      }

      if (/\bstart\b/i.test(text) && bookingIdForWorker) {
        const response = await callInternalApi({ method: 'POST', endpoint: `/api/bookings/${bookingIdForWorker}/start`, token: authToken });
        context.lastBookingId = Number.parseInt(String(bookingIdForWorker), 10);
        context.lastIntent = 'bookings';
        return {
          type: 'data',
          title: 'Booking Started',
          data: response?.data ?? null,
          message: 'Booking started successfully.',
          reply: 'Booking started successfully.',
          action: 'navigate',
          target: '/bookings',
          sessionId,
        };
      }
      if (/\bstart\b/i.test(text) && !bookingIdForWorker) {
        return toTextResponse({
          sessionId,
          message: 'Please share the booking id to start.',
        });
      }

      if (/\bcomplete\b/i.test(text) && bookingIdForWorker) {
        const response = await callInternalApi({ method: 'POST', endpoint: `/api/bookings/${bookingIdForWorker}/complete`, token: authToken });
        context.lastBookingId = Number.parseInt(String(bookingIdForWorker), 10);
        context.lastIntent = 'bookings';
        return {
          type: 'data',
          title: 'Booking Completed',
          data: response?.data ?? null,
          message: 'Booking completed successfully.',
          reply: 'Booking completed successfully.',
          action: 'navigate',
          target: '/bookings',
          sessionId,
        };
      }
      if (/\bcomplete\b/i.test(text) && !bookingIdForWorker) {
        return toTextResponse({
          sessionId,
          message: 'Please share the booking id to complete.',
        });
      }
    } catch (error) {
      return toTextResponse({
        sessionId,
        message: FAILSAFE_MESSAGE,
      });
    }
  }

  if (userRole === 'ADMIN') {
    try {
      if (/\bdashboard\b/i.test(text)) {
        const response = await callInternalApi({ method: 'GET', endpoint: '/api/admin/dashboard', token: authToken });
        return {
          type: 'data',
          title: 'Admin Dashboard',
          data: response?.data ?? null,
          message: 'Here is the admin dashboard summary.',
          reply: 'Here is the admin dashboard summary.',
          action: 'navigate',
          target: '/admin/dashboard',
          sessionId,
        };
      }

      if (/\busers\b/i.test(text)) {
        const response = await callInternalApi({ method: 'GET', endpoint: '/api/admin/users', token: authToken });
        return {
          type: 'data',
          title: 'User Management',
          data: response?.data ?? null,
          message: 'Here is the user management data.',
          reply: 'Here is the user management data.',
          action: 'navigate',
          target: '/admin/users',
          sessionId,
        };
      }

      if (/\banalytics\b/i.test(text)) {
        const response = await callInternalApi({ method: 'GET', endpoint: '/api/analytics/summary', token: authToken });
        return {
          type: 'data',
          title: 'Analytics Summary',
          data: response?.data ?? null,
          message: 'Here is the analytics summary.',
          reply: 'Here is the analytics summary.',
          action: 'navigate',
          target: '/admin/analytics',
          sessionId,
        };
      }
    } catch (error) {
      return toTextResponse({
        sessionId,
        message: FAILSAFE_MESSAGE,
      });
    }
  }

  // Smart booking creation flow for customers without LLM extraction.
  if (userRole === 'CUSTOMER' && isBookingRequest(text)) {
    if (!hasRoleAccessToTool(user.role, 'createBooking')) {
      return toTextResponse({
        sessionId,
        message: 'This action is not allowed for your role.',
      });
    }

    if (isBookingAttemptRateLimited(user.id)) {
      return toTextResponse({
        sessionId,
        message: 'Too many booking attempts in a short time. Please wait a moment and try again.',
      });
    }

    const existingSessionKey = getSessionKey(user.id, sessionId);
    const existingPending = pendingConfirmations.get(existingSessionKey);
    const hasAnyActiveCreateConfirmation = hasActiveCreateBookingConfirmationForUser(user.id);

    // If old booking context leaked from an earlier session and there is no active
    // createBooking confirmation, clear it so a new booking can start.
    const contextSession = String(context?.pendingBookingSessionId || '');
    const isDifferentSessionContext = Boolean(contextSession) && contextSession !== String(sessionId);
    if (isDifferentSessionContext && !hasAnyActiveCreateConfirmation) {
      clearPendingBooking(user.id);
    }

    const hasCompletePendingBooking = Boolean(
      context?.pendingBooking?.serviceId
      && context?.pendingBooking?.scheduledAt
      && context?.pendingBooking?.workerId
    );
    if ((existingPending && existingPending.toolName === 'createBooking') || (hasCompletePendingBooking && hasAnyActiveCreateConfirmation)) {
      return toTextResponse({
        sessionId,
        message: "You're already creating a booking. Please wait.",
      });
    }

    const bookingInput = await resolveCreateBookingParams({ message: text, token: authToken });
    const pendingBooking = {
      ...(context.pendingBooking || {}),
      ...(bookingInput.serviceId ? { serviceId: bookingInput.serviceId } : {}),
      ...(bookingInput.serviceName ? { serviceName: bookingInput.serviceName } : {}),
      ...(bookingInput.scheduledAt ? { scheduledAt: bookingInput.scheduledAt } : {}),
    };

    context.pendingBooking = pendingBooking;
    context.pendingBookingSessionId = sessionId;
    context.pendingBookingCreatedAt = Date.now();
    updateUserJourney(user.id, {
      bookingStarted: true,
      bookingCompleted: false,
      lastStep: 'service_selected',
    });

    if (!pendingBooking.serviceId) {
      return toTextResponse({
        sessionId,
        message: 'I need a bit more detail - what service do you want?',
      });
    }

    if (!pendingBooking.scheduledAt) {
      return toTextResponse({
        sessionId,
        message: 'Got it. What time should I schedule this for?',
      });
    }
    updateUserJourney(user.id, {
      bookingStarted: true,
      bookingCompleted: false,
      lastStep: 'time_selected',
    });

    // Discover workers when none selected yet.
    if (!pendingBooking.workerId) {
      if (!Array.isArray(context.availableWorkers) || context.availableWorkers.length === 0) {
        try {
          const workerData = await fetchTopWorkersForService({
            serviceId: pendingBooking.serviceId,
            token: authToken,
          });
          // Extract worker list and store metadata separately
          context.availableWorkers = workerData.workers || [];
          context.lastWorkerOptions = workerData.workers || [];
          context.bestWorkerId = workerData.bestWorkerId || null;
          context.cheapestWorkerId = workerData.cheapestWorkerId || null;
          context.workerMetadata = {
            bestWorkerName: workerData.bestWorkerName,
            bestWorkerRating: workerData.bestWorkerRating,
            bestWorkerReviewCount: workerData.bestWorkerReviewCount,
            bestWorkerJobsCompleted: workerData.bestWorkerJobsCompleted,
            cheapestWorkerName: workerData.cheapestWorkerName,
            cheapestWorkerPrice: workerData.cheapestWorkerPrice,
            cheapestWorkerReviewCount: workerData.cheapestWorkerReviewCount,
            cheapestWorkerJobsCompleted: workerData.cheapestWorkerJobsCompleted,
          };
        } catch (error) {
          console.log(`[ai-chat] worker_fetch_error=${error?.message || 'unknown'}`);
          context.availableWorkers = [];
          context.lastWorkerOptions = [];
        }
      }

      const selectedWorker = selectWorkerByPreference(text, context.availableWorkers);
      if (selectedWorker?.id) {
        pendingBooking.workerId = selectedWorker.id;
        context.pendingBooking = pendingBooking;
        updateUserJourney(user.id, {
          bookingStarted: true,
          bookingCompleted: false,
          lastStep: 'worker_selected',
        });
        const workerChoice = getWorkerChoiceFromMessage(text);
        if (workerChoice === 'best' || workerChoice === 'cheap') {
          setUserPreference(user.id, workerChoice);
        }
      } else if (context.availableWorkers.length > 0) {
        // Build recommendation message with best and cheapest info
        const recommendationMsg = buildWorkerRecommendationMessage(context.workerMetadata);
        const message = recommendationMsg
          ? `${recommendationMsg} Choose a worker to continue.`
          : 'I found a few workers. Choose one to continue booking.';
        
        return {
          type: 'data',
          title: 'Available Workers',
          data: context.availableWorkers,
          message,
          reply: message,
          suggestions: ['Book best worker', 'Book cheapest worker'],
          sessionId,
        };
      }
    }

    // Auto-fallback: If we have service + time but no worker preference, choose by stored preference.
    if (!pendingBooking.workerId && pendingBooking.serviceId && pendingBooking.scheduledAt) {
      const userPreference = getUserPreference(user.id);
      const preferredWorkerId = userPreference.preference === 'cheap'
        ? context.cheapestWorkerId
        : context.bestWorkerId;

      if (preferredWorkerId) {
        pendingBooking.workerId = preferredWorkerId;
        context.pendingBooking = pendingBooking;
        updateUserJourney(user.id, {
          bookingStarted: true,
          bookingCompleted: false,
          lastStep: 'worker_selected',
        });
        console.log(`[ai-chat] userId=${user.id} auto_selected_worker=${preferredWorkerId} strategy=${userPreference.preference || 'best'}`);
      }
    }

    if (!pendingBooking.workerId) {
      return toTextResponse({
        sessionId,
        message: 'Please choose a worker. You can say "Book best worker" or "Book cheapest worker".',
      });
    }

    // Preview price and ask for explicit confirmation before createBooking.
    let previewPrice = null;
    try {
      const previewResp = await callInternalApi({
        method: 'POST',
        endpoint: '/api/bookings/preview-price',
        token: authToken,
        body: {
          serviceId: pendingBooking.serviceId,
          scheduledAt: pendingBooking.scheduledAt,
          workerId: pendingBooking.workerId,
          workerProfileId: pendingBooking.workerId,
        },
      });

      const previewData = previewResp?.data || {};
      previewPrice = previewData?.price
        ?? previewData?.estimatedPrice
        ?? previewData?.totalPrice
        ?? previewData?.amount
        ?? null;
    } catch (error) {
      console.log(`[ai-chat] preview_price_error=${error?.message || 'unknown'}`);
      // Keep previewPrice as null
    }

    // Find selected worker name from availableWorkers
    let selectedWorkerName = 'a worker';
    if (Array.isArray(context.availableWorkers)) {
      const worker = context.availableWorkers.find((w) => w?.id === pendingBooking.workerId);
      if (worker?.name) selectedWorkerName = worker.name;
    }

    // Build rich booking summary
    const trustSignal = buildBookingTrustSignal({
      selectedWorkerId: pendingBooking.workerId,
      bestWorkerId: context.bestWorkerId,
      cheapestWorkerId: context.cheapestWorkerId,
      workerMetadata: context.workerMetadata,
    });

    const bookingSummary = buildBookingSummary({
      serviceName: pendingBooking.serviceName || detectService(text) || 'this service',
      scheduledAt: pendingBooking.scheduledAt || 'soon',
      workerName: selectedWorkerName,
      price: previewPrice,
      trustSignal,
    });

    const sessionKey = getSessionKey(user.id, sessionId);
    const idempotencyKey = createBookingIdempotencyKey(user.id, pendingBooking);
    const addressDetails = await resolveCustomerAddressDetails(authToken);
    if (!addressDetails) {
      return toTextResponse({
        sessionId,
        message: 'Please complete your customer profile address before booking.',
      });
    }

    pendingConfirmations.set(sessionKey, {
      toolName: 'createBooking',
      params: {
        serviceId: pendingBooking.serviceId,
        scheduledAt: pendingBooking.scheduledAt,
        scheduledDate: pendingBooking.scheduledAt,
        workerId: pendingBooking.workerId,
        workerProfileId: pendingBooking.workerId,
        addressDetails,
        idempotencyKey,
      },
      createdAt: Date.now(),
      intent: 'bookings',
    });
    updateUserJourney(user.id, {
      bookingStarted: true,
      bookingCompleted: false,
      lastStep: 'confirmed',
    });

    context.pendingBooking = {
      serviceId: pendingBooking.serviceId,
      serviceName: pendingBooking.serviceName || bookingInput.serviceName || null,
      scheduledAt: pendingBooking.scheduledAt,
      workerId: pendingBooking.workerId,
    };
    context.pendingBookingSessionId = sessionId;
    context.pendingBookingCreatedAt = Date.now();

    return toConfirmationResponse({
      sessionId,
      message: bookingSummary,
      metadata: {
        tool: 'createBooking',
        pendingBooking: context.pendingBooking,
        price: previewPrice,
        workerName: selectedWorkerName,
      },
    });
  }

  if (isRescheduleRequest(text)) {
    const newTime = extractTime(text);
    if (!newTime?.scheduledAt) {
      return toTextResponse({
        sessionId,
        message: 'What new time should I set?',
      });
    }

    const rescheduleParams = { ...paramsWithContext };
    if (!rescheduleParams.bookingId && rescheduleParams.latestBooking) {
      const latest = await resolveLatestBookingId({ user, token: authToken });
      if (latest.success && latest.bookingId) {
        rescheduleParams.bookingId = latest.bookingId;
      }
    }

    if (!rescheduleParams.bookingId) {
      return toTextResponse({
        sessionId,
        message: 'Please share the booking id to reschedule.',
      });
    }

    try {
      const response = await callInternalApi({
        method: 'PATCH',
        endpoint: `/api/bookings/${rescheduleParams.bookingId}/reschedule`,
        token: authToken,
        body: {
          scheduledAt: newTime.scheduledAt,
        },
      });

      updateUserContextAfterExecution(user.id, {
        intent: 'bookings',
        params: { bookingId: rescheduleParams.bookingId },
        toolResult: { success: true, data: response?.data || {} },
      });

      return {
        type: 'data',
        title: 'Booking Rescheduled',
        data: response?.data ?? null,
        message: `Booking #${rescheduleParams.bookingId} was rescheduled successfully.`,
        reply: `Booking #${rescheduleParams.bookingId} was rescheduled successfully.`,
        action: 'navigate',
        target: '/bookings',
        sessionId,
      };
    } catch (error) {
      return toTextResponse({
        sessionId,
        message: FAILSAFE_MESSAGE,
      });
    }
  }

  if (isCancelRequest(text)) {
    if (!hasRoleAccessToTool(user.role, 'cancelBooking')) {
      return toTextResponse({
        sessionId,
        message: 'This action is not allowed for your role.',
      });
    }

    const cancelParams = { ...paramsWithContext };
    if (!cancelParams.bookingId && cancelParams.latestBooking) {
      const latest = await resolveLatestBookingId({ user, token: authToken });
      if (latest.success && latest.bookingId) {
        cancelParams.bookingId = latest.bookingId;
      }
    }

    if (!cancelParams.bookingId) {
      return toTextResponse({
        sessionId,
        message: 'Please share the booking id to cancel, or say cancel latest booking.',
      });
    }

    const ownsBooking = await doesUserOwnBooking({
      user,
      token: authToken,
      bookingId: cancelParams.bookingId,
    });

    if (!ownsBooking) {
      return toTextResponse({
        sessionId,
        message: `I could not find booking #${cancelParams.bookingId} in your account. Please share a valid booking id or say cancel latest booking.`,
      });
    }

    const bookingId = String(cancelParams.bookingId).trim();
    const sessionKey = getSessionKey(user.id, sessionId);
    pendingConfirmations.set(sessionKey, {
      toolName: 'cancelBooking',
      params: { bookingId },
      createdAt: Date.now(),
      intent: 'bookings',
    });

    return toConfirmationResponse({
      sessionId,
      message: `Are you sure you want to cancel booking #${bookingId}?`,
      metadata: {
        tool: 'cancelBooking',
        bookingId,
      },
    });
  }

  if (detected.intent === 'bookings' && extracted.latestBooking) {
    if (!hasRoleAccessToTool(user.role, 'getBookings')) {
      return toTextResponse({
        sessionId,
        message: 'This action is not allowed for your role.',
      });
    }

    const bookingsResult = await executeTool({
      toolName: 'getBookings',
      params: {},
      userContext: {
        userId: user.id,
        role: user.role,
        token: authToken,
      },
    });

    if (!bookingsResult.success) {
      return toTextResponse({
        sessionId,
        message: FAILSAFE_MESSAGE,
      });
    }

    const latestBooking = pickMostRecentBooking(getBookingsListFromData(bookingsResult.data));
    const latestId = latestBooking?.id ?? null;
    if (latestId !== null && latestId !== undefined) {
      const numeric = Number.parseInt(String(latestId), 10);
      if (Number.isFinite(numeric)) {
        context.lastBookingId = numeric;
      }
    }
    context.lastIntent = 'bookings';

    return buildBypassDataResponse({
      sessionId,
      toolName: 'getBookings',
      data: bookingsResult.data,
    });
  }

  if ((detected.intent === 'wallet' && detected.score >= 1) || (detected.intent && detected.score >= 2)) {
    const toolName = intentToolMap[detected.intent];
    if (!hasRoleAccessToTool(user.role, toolName)) {
      return toTextResponse({
        sessionId,
        message: 'This action is not allowed for your role.',
      });
    }

    console.log(`[ai-chat] userId=${user.id} bypass_tool=${toolName}`);

    const bypassResult = await executeTool({
      toolName,
      params: paramsWithContext,
      userContext: {
        userId: user.id,
        role: user.role,
        token: authToken,
      },
    });

    console.log(`[ai-chat] userId=${user.id} bypass_tool=${toolName} success=${Boolean(bypassResult?.success)}`);

    if (!bypassResult.success) {
      return toTextResponse({
        sessionId,
        message: FAILSAFE_MESSAGE,
      });
    }

    updateUserContextAfterExecution(user.id, {
      intent: detected.intent,
      params: paramsWithContext,
      toolResult: bypassResult,
    });

    if (toolName === 'getBookings') {
      const latestBooking = pickMostRecentBooking(getBookingsListFromData(bypassResult.data));
      const latestId = latestBooking?.id ?? null;
      const numeric = Number.parseInt(String(latestId), 10);
      if (Number.isFinite(numeric)) {
        context.lastBookingId = numeric;
      }
    }

    return buildBypassDataResponse({
      sessionId,
      toolName,
      data: bypassResult.data,
    });
  }

  if (detected.intent && detected.score === 1) {
    console.log(`[ai-chat] userId=${user.id} weak_intent=${detected.intent} score=1 -> llm`);
  }

  return runAgentLoop({
    user,
    message: text,
    sessionId,
    token: authToken,
  });
}

async function processChatInput({ user, message, sessionId: rawSessionId, source = 'chat', token }) {
  try {
    const sessionId = normalizeText(rawSessionId) || createSessionId();
    const text = normalizeText(message);
    const preDetected = detectIntent(text);
    console.log(`[ai-chat] userId=${user?.id || 'unknown'} message=${text.slice(0, 300)}`);
    getUserContext(user.id);

    const finalizeResponse = (response, { toolUsed = null, success = undefined, error = null, fallbackUsed = false } = {}) => {
      const enhanced = enhanceOutgoingResponse(response);
      logAiAgent({
        userId: user?.id,
        message: text,
        detectedIntent: preDetected.intent,
        confidenceScore: preDetected.score,
        toolUsed: toolUsed || getToolUsedFromResponse(enhanced),
        success: success === undefined ? inferResponseSuccess(enhanced) : Boolean(success),
        error,
        fallbackUsed,
        timestamp: nowIso(),
      });
      return enhanced;
    };

    if (!text) {
      return finalizeResponse(toTextResponse({
        sessionId,
        message: 'I need a message to help you. Try something like "book cleaning tomorrow 5pm".',
      }), { success: false, error: 'empty_input' });
    }

    if (source !== 'chat') {
      return finalizeResponse(toTextResponse({
        sessionId,
        message: 'Voice command accepted. Please use chat for tool execution in this build.',
      }), { success: true });
    }

    if (isUserRateLimited(user.id)) {
      return finalizeResponse(toTextResponse({
        sessionId,
        message: RATE_LIMIT_MESSAGE,
      }), { success: false, error: 'rate_limited' });
    }

    const sessionKey = getSessionKey(user.id, sessionId);
    const pending = pendingConfirmations.get(sessionKey);
    if (pending) {
      if (isConfirmMessage(text)) {
        if (pending.toolName === 'createBooking') {
          const scheduledDate = pending?.params?.scheduledDate || pending?.params?.scheduledAt;
          if (!scheduledDate || Number.isNaN(new Date(scheduledDate).getTime())) {
            pendingConfirmations.delete(sessionKey);
            clearPendingBooking(user.id);
            return finalizeResponse(toTextResponse({
              sessionId,
              message: 'I need a valid booking time before confirming. Please share a time like "tomorrow 5pm".',
            }), { toolUsed: 'createBooking', success: false, error: 'missing_scheduled_date' });
          }
          pending.params.scheduledDate = scheduledDate;
          const idemKey = String(pending?.params?.idempotencyKey || createBookingIdempotencyKey(user.id, pending.params));
          pending.params.idempotencyKey = idemKey;
          if (!canStartBookingExecution(idemKey)) {
            return finalizeResponse(toTextResponse({
              sessionId,
              message: "You're already creating a booking. Please wait.",
            }), { toolUsed: 'createBooking', success: false, error: 'booking_in_progress' });
          }
        }

        pendingConfirmations.delete(sessionKey);
        const toolResult = await executeTool({
          toolName: pending.toolName,
          params: pending.params,
          userContext: {
            userId: user.id,
            role: user.role,
            token: getAuthTokenFromContext({ token }),
          },
        });
        updateUserContextAfterExecution(user.id, {
          intent: pending.intent || inferIntentFromTool(pending.toolName),
          params: pending.params,
          toolResult,
        });
        if (pending.toolName === 'createBooking') {
          completeBookingExecution(pending?.params?.idempotencyKey, Boolean(toolResult?.success));
          if (toolResult?.success) {
            updateUserJourney(user.id, {
              bookingStarted: true,
              bookingCompleted: true,
              lastStep: 'confirmed',
            });
          }
          clearPendingBooking(user.id);
        }
        console.log(`[ai-chat] userId=${user.id} confirmed_tool=${pending.toolName} success=${Boolean(toolResult?.success)}`);

        if (pending.toolName === 'createBooking' && toolResult.success) {
          const bookingId = toolResult?.data?.booking?.id || toolResult?.data?.id || null;
          const successMsg = bookingId
            ? `Booking #${bookingId} created successfully.`
            : 'Booking created successfully.';
          return finalizeResponse({
            ...toTextResponse({
              sessionId,
              message: successMsg,
            }),
            type: 'action',
            action: 'navigate',
            target: '/bookings',
            toolResult,
          }, { toolUsed: pending.toolName, success: true });
        }

        if (pending.toolName === 'cancelBooking' && toolResult.success) {
          return finalizeResponse({
            ...toTextResponse({
              sessionId,
              message: `Booking #${pending.params.bookingId} cancelled successfully.`,
            }),
            type: 'action',
            action: 'navigate',
            target: '/bookings',
            toolResult,
          }, { toolUsed: pending.toolName, success: true });
        }

        // Enhanced error recovery for createBooking failures
        if (pending.toolName === 'createBooking' && !toolResult.success) {
          const detailed = String(toolResult?.error || '').trim();
          const msg = detailed || 'Booking could not be completed right now. Please try again.';
          return finalizeResponse(toTextResponse({
            sessionId,
            message: msg,
          }), {
            toolUsed: pending.toolName,
            success: false,
            error: 'create_booking_failed',
            fallbackUsed: true,
          });
        }

        if (pending.toolName === 'cancelBooking' && !toolResult.success) {
          const detailed = String(toolResult?.error || '').trim();
          const msg = detailed || 'Cancellation could not be completed right now. Please verify booking id and try again.';
          return finalizeResponse(toTextResponse({
            sessionId,
            message: msg,
          }), {
            toolUsed: pending.toolName,
            success: false,
            error: 'cancel_booking_failed',
            fallbackUsed: true,
          });
        }

        return finalizeResponse({
          ...toTextResponse({
            sessionId,
            message: toolResult.success
              ? 'Action completed successfully.'
              : FAILSAFE_MESSAGE,
          }),
          toolResult,
        }, {
          toolUsed: pending.toolName,
          success: Boolean(toolResult?.success),
          error: toolResult?.success ? null : 'tool_execution_failed',
          fallbackUsed: !toolResult?.success,
        });
      }

      if (isDeclineMessage(text)) {
        pendingConfirmations.delete(sessionKey);
        if (pending.toolName === 'createBooking') {
          clearPendingBooking(user.id);
        }
        return finalizeResponse(toTextResponse({
          sessionId,
          message: 'Okay, I did not execute that action.',
        }), { toolUsed: pending.toolName, success: true });
      }

      return finalizeResponse(toConfirmationResponse({
        sessionId,
        message: 'Please confirm with yes or no before I proceed.',
        metadata: {
          tool: pending.toolName,
        },
      }), { toolUsed: pending.toolName, success: true });
    }

    const commands = splitCommands(text);
    if (commands.length > 1) {
      const responses = [];
      for (const command of commands) {
        const result = await handleSingleCommand({
          user,
          message: command,
          sessionId,
          token,
        });
        responses.push(result);
      }
      return finalizeResponse({
        type: 'multi',
        sessionId,
        responses,
      }, { success: true });
    }

    const single = await handleSingleCommand({
      user,
      message: commands[0] || text,
      sessionId,
      token,
    });

    return finalizeResponse(single, {
      success: inferResponseSuccess(single),
      fallbackUsed: String(single?.message || '').includes(FAILSAFE_MESSAGE),
    });
  } catch (error) {
    console.log('[ai-chat] processChatInput error:', error?.message || error);
    const sessionId = normalizeText(rawSessionId) || createSessionId();
    const safe = enhanceOutgoingResponse(toFailsafeTextResponse(sessionId));
    logAiAgent({
      userId: user?.id,
      message: normalizeText(message),
      detectedIntent: null,
      confidenceScore: 0,
      toolUsed: null,
      success: false,
      error: 'unexpected_exception',
      fallbackUsed: true,
      timestamp: nowIso(),
    });
    return safe;
  }
}

async function resetSession(userId, sessionId) {
  const key = getSessionKey(userId, sessionId);
  pendingConfirmations.delete(key);
  return true;
}

module.exports = {
  processChatInput,
  resetSession,
};
