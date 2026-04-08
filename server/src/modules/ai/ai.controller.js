const asyncHandler = require('../../common/utils/asyncHandler');
const AppError = require('../../common/errors/AppError');
const { processChatInput, resetSession, getAiUsageAnalytics } = require('./service');

function extractAuthToken(req) {
  const cookieToken = String(req.cookies?.token || '').trim();
  if (cookieToken) return cookieToken;

  const authHeader = String(req.get('authorization') || '').trim();
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  return bearerMatch?.[1]?.trim() || '';
}

function resolveLocale(req) {
  const explicit = String(req.body?.locale || req.query?.locale || req.locale || '').trim().toLowerCase();
  if (explicit) return explicit;

  const acceptLanguage = String(req.get('accept-language') || '').trim();
  const first = acceptLanguage.split(',')[0]?.trim().toLowerCase() || '';
  return first || 'en';
}

const chat = asyncHandler(async (req, res) => {
  const message = String(req.body?.message || '').trim();
  const sessionId = req.body?.sessionId;

  if (!message) {
    throw new AppError(400, 'message is required.');
  }

  const result = await processChatInput({
    user: req.user,
    message,
    sessionId,
    locale: resolveLocale(req),
    source: 'chat',
    token: extractAuthToken(req),
  });

  res.json(result);
});

const voice = asyncHandler(async (req, res) => {
  const transcript = String(req.body?.transcript || req.body?.text || '').trim();
  const sessionId = req.body?.sessionId;

  if (!transcript && !req.file) {
    throw new AppError(400, 'audio file or transcript is required.');
  }

  if (!transcript && req.file) {
    throw new AppError(400, 'Voice transcription is required. Please use a browser with speech recognition support or send a transcript.');
  }

  const result = await processChatInput({
    user: req.user,
    message: transcript,
    sessionId,
    locale: resolveLocale(req),
    source: 'voice',
    token: extractAuthToken(req),
  });

  res.json({
    ...result,
    transcript: transcript || null,
    sttUsed: Boolean(transcript),
    sttProvider: transcript ? 'browser-speech-recognition' : 'disabled',
  });
});

const clearSession = asyncHandler(async (req, res) => {
  const sessionId = String(req.body?.sessionId || '').trim();
  if (!sessionId) {
    throw new AppError(400, 'sessionId is required.');
  }

  await resetSession(req.user.id, sessionId);
  res.json({ success: true, rebuildMode: true });
});

const usageAnalytics = asyncHandler(async (req, res) => {
  const requestedDays = Number.parseInt(String(req.query?.days || '7'), 10);
  const days = Number.isFinite(requestedDays) ? Math.min(Math.max(requestedDays, 1), 30) : 7;
  const analytics = await getAiUsageAnalytics({ days });
  res.json({ days, ...analytics });
});

module.exports = {
  chat,
  voice,
  clearSession,
  usageAnalytics,
};
