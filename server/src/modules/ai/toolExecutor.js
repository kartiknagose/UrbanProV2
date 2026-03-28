const axios = require('axios');
const { PORT } = require('../../config/env');
const { getTool } = require('./toolRegistry');

const INTERNAL_API_BASE_URL = process.env.INTERNAL_API_BASE_URL || `http://127.0.0.1:${PORT}`;
const UNAUTHORIZED_ERROR_MESSAGE = 'Unauthorized or invalid request';

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

function buildEndpoint(tool, params) {
  if (tool.name === 'cancelBooking') {
    return tool.endpoint.replace(':id', encodeURIComponent(String(params.bookingId)));
  }
  return tool.endpoint;
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

    // Safety re-check right before execution.
    if (!isRoleAllowed(tool.allowedRoles, role)) {
      console.log(`[ai-tool] role_denied_recheck tool=${tool.name} role=${role}`);
      return unauthorizedResult();
    }
    if (validateRequiredParams(tool.requiredParams, params).length > 0) {
      console.log(`[ai-tool] missing_params_recheck tool=${tool.name}`);
      return unauthorizedResult();
    }

    const endpoint = buildEndpoint(tool, params);
    const url = `${INTERNAL_API_BASE_URL}${endpoint}`;

    const axiosConfig = {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-AI-Actor-User-Id': String(userId),
      },
      timeout: Number(process.env.AI_TOOL_TIMEOUT_MS || 12000),
    };

    if (tool.name === 'cancelBooking') {
      const ownership = await ensureBookingOwnership(params, userContext, axiosConfig);
      if (!ownership.success) {
        console.log(`[ai-tool] ownership_failed userId=${userId} bookingId=${params?.bookingId}`);
        return unauthorizedResult();
      }
    }

    let response;
    if (tool.method === 'GET') {
      response = await axios.get(url, axiosConfig);
    } else if (tool.method === 'POST') {
      const body = tool.name === 'createBooking' ? { ...params } : {};
      delete body.userId;
      delete body.role;
      response = await axios.post(url, body, axiosConfig);
    } else if (tool.method === 'PATCH') {
      const body = { ...params };
      delete body.userId;
      delete body.role;
      delete body.bookingId;
      response = await axios.patch(url, body, axiosConfig);
    } else {
      return { success: false, data: null, error: `Unsupported method: ${tool.method}` };
    }

    return {
      success: true,
      data: response?.data ?? null,
      error: null,
    };
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
