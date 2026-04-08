const axios = require('axios');
const { PORT } = require('../../config/env');
const { getTool } = require('./toolRegistry');

const INTERNAL_API_BASE_URL = process.env.INTERNAL_API_BASE_URL || `http://127.0.0.1:${PORT}`;
const UNAUTHORIZED_ERROR_MESSAGE = 'Unauthorized or invalid request';
const READ_TOOL_CACHE_TTL_MS = Number(process.env.AI_READ_TOOL_CACHE_TTL_MS || 30 * 1000);
const READ_TOOL_CACHEABLE_TOOLS = new Set([
  'getWallet',
  'getBookings',
  'getNotifications',
  'getEmergencyContacts',
  'getVerificationStatus',
]);
const readToolCache = new Map();

function getReadToolCacheKey(toolName, userId, params) {
  const sortedEntries = Object.entries(params || {}).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify({ toolName, userId, params: sortedEntries });
}

function getCachedReadToolResult(toolName, userId, params) {
  if (!READ_TOOL_CACHEABLE_TOOLS.has(toolName) || READ_TOOL_CACHE_TTL_MS <= 0) {
    return null;
  }

  const key = getReadToolCacheKey(toolName, userId, params);
  const cached = readToolCache.get(key);
  if (!cached) return null;

  if (cached.expiresAt <= Date.now()) {
    readToolCache.delete(key);
    return null;
  }

  return cached.result;
}

function setCachedReadToolResult(toolName, userId, params, result) {
  if (!READ_TOOL_CACHEABLE_TOOLS.has(toolName) || READ_TOOL_CACHE_TTL_MS <= 0 || !result?.success) {
    return;
  }

  const key = getReadToolCacheKey(toolName, userId, params);
  readToolCache.set(key, {
    result,
    expiresAt: Date.now() + READ_TOOL_CACHE_TTL_MS,
  });
}

function clearUserReadToolCache(userId) {
  if (!userId) return;
  const userToken = `"userId":${JSON.stringify(userId)}`;
  for (const key of readToolCache.keys()) {
    if (key.includes(userToken)) {
      readToolCache.delete(key);
    }
  }
}

function unauthorizedResult() {
  return {
    success: false,
    data: null,
    error: UNAUTHORIZED_ERROR_MESSAGE,
  };
}

function isRoleAllowed(allowedRoles = [], userRole) {
  if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) return false;
  if (allowedRoles.includes('AUTHENTICATED')) return true;
  return allowedRoles.includes(userRole);
}

function validateRequiredParams(requiredParams = [], params = {}) {
  const missing = [];
  for (const key of requiredParams) {
    const value = params[key];
    if (value === undefined || value === null || String(value).trim() === '') {
      missing.push(key);
    }
  }
  return missing;
}

function resolvePathParamValue(key, params) {
  if (params[key] !== undefined && params[key] !== null && String(params[key]).trim() !== '') {
    return params[key];
  }

  const aliases = {
    id: ['bookingId', 'availabilityId', 'applicationId', 'workerProfileId', 'contactId'],
    workerId: ['workerProfileId'],
    serviceId: ['serviceId'],
  };

  const fallbackKeys = aliases[key] || [];
  for (const fallbackKey of fallbackKeys) {
    if (params[fallbackKey] !== undefined && params[fallbackKey] !== null && String(params[fallbackKey]).trim() !== '') {
      return params[fallbackKey];
    }
  }

  return undefined;
}

function buildEndpoint(tool, params) {
  const pathParams = [];
  const endpoint = String(tool.endpoint || '').replace(/:([A-Za-z0-9_]+)/g, (_match, key) => {
    const value = resolvePathParamValue(key, params);
    if (value === undefined || value === null || String(value).trim() === '') {
      throw new Error(`Missing path param: ${key}`);
    }
    pathParams.push(key);
    return encodeURIComponent(String(value));
  });

  return { endpoint, pathParams };
}

function buildRequestBody(params, pathParams = []) {
  const body = { ...params };
  delete body.userId;
  delete body.role;
  delete body.token;

  for (const key of pathParams) {
    delete body[key];
  }

  // Normalize common alias fields that should never be sent back to the API.
  delete body.bookingId;
  delete body.availabilityId;
  delete body.applicationId;
  delete body.workerProfileId;

  return body;
}

async function ensureBookingOwnership(params, userContext, axiosConfig) {
  if (params.bookingId === undefined || params.bookingId === null) {
    return { success: false, error: UNAUTHORIZED_ERROR_MESSAGE };
  }

  const bookingId = String(params.bookingId);
  const bookingsResp = await axios.get(`${INTERNAL_API_BASE_URL}/api/bookings`, axiosConfig);
  const raw = bookingsResp?.data;
  const bookings = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.bookings)
      ? raw.bookings
      : Array.isArray(raw?.data)
        ? raw.data
        : [];

  const ownsBooking = bookings.some((booking) => String(booking?.id) === bookingId);
  if (!ownsBooking) {
    return { success: false, error: UNAUTHORIZED_ERROR_MESSAGE };
  }

  return { success: true };
}

async function executeTool({ toolName, params = {}, userContext = {} }) {
  try {
    console.log(`[ai-tool] start tool=${toolName} userId=${userContext?.userId || 'unknown'}`);
    const tool = getTool(toolName);
    if (!tool) {
      console.log(`[ai-tool] invalid_tool tool=${toolName}`);
      return unauthorizedResult();
    }

    const role = String(userContext.role || '').toUpperCase();
    const userId = userContext.userId;
    const token = String(userContext.token || '').trim();

    if (!userId || !role || !token) {
      console.log('[ai-tool] invalid_user_context');
      return unauthorizedResult();
    }

    if (!isRoleAllowed(tool.allowedRoles, role)) {
      console.log(`[ai-tool] role_denied tool=${tool.name} role=${role}`);
      return unauthorizedResult();
    }

    const missingParams = validateRequiredParams(tool.requiredParams, params);
    if (missingParams.length > 0) {
      console.log(`[ai-tool] missing_params tool=${tool.name} params=${missingParams.join(',')}`);
      return unauthorizedResult();
    }

    const { endpoint, pathParams } = buildEndpoint(tool, params);
    const url = `${INTERNAL_API_BASE_URL}${endpoint}`;

    const axiosConfig = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: Number(process.env.AI_TOOL_TIMEOUT_MS || 12000),
    };

    if (['cancelBooking', 'payBooking', 'rescheduleBooking', 'getBookingById'].includes(tool.name)) {
      const ownership = await ensureBookingOwnership(params, userContext, axiosConfig);
      if (!ownership.success) {
        console.log(`[ai-tool] ownership_failed userId=${userId} bookingId=${params?.bookingId}`);
        return unauthorizedResult();
      }
    }

    if (tool.method === 'GET') {
      const cachedResult = getCachedReadToolResult(tool.name, userId, params);
      if (cachedResult) {
        return cachedResult;
      }
    }

    let response;
    if (tool.method === 'GET') {
      response = await axios.get(url, axiosConfig);
    } else if (tool.method === 'POST') {
      const body = buildRequestBody(params, pathParams);
      response = await axios.post(url, body, axiosConfig);
    } else if (tool.method === 'PATCH') {
      const body = buildRequestBody(params, pathParams);
      response = await axios.patch(url, body, axiosConfig);
    } else if (tool.method === 'DELETE') {
      response = await axios.delete(url, axiosConfig);
    } else {
      return { success: false, data: null, error: `Unsupported method: ${tool.method}` };
    }

    const result = {
      success: true,
      data: response?.data ?? null,
      error: null,
    };

    if (tool.method === 'GET') {
      setCachedReadToolResult(tool.name, userId, params, result);
    } else {
      clearUserReadToolCache(userId);
    }

    return result;
  } catch (error) {
    console.log(`[ai-tool] error tool=${toolName} userId=${userContext?.userId || 'unknown'} message=${error?.message || error}`);
    const message = error?.response?.data?.error
      || error?.response?.data?.message
      || error?.message
      || 'Tool execution failed.';

    return {
      success: false,
      data: null,
      error: String(message),
    };
  }
}

module.exports = {
  executeTool,
};
