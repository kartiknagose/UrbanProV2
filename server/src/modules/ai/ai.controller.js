const asyncHandler = require('../../common/utils/asyncHandler');
const AppError = require('../../common/errors/AppError');
const { processChatInput, resetSession } = require('./service');

function extractAuthToken(req) {
  const cookieToken = String(req.cookies?.token || '').trim();
  if (cookieToken) return cookieToken;

  const authHeader = String(req.get('authorization') || '').trim();
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  return bearerMatch?.[1]?.trim() || '';
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
    locale: req.locale,
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

  const result = await processChatInput({
    user: req.user,
    message: transcript || '[voice_input]'
    ,
    sessionId,
    locale: req.locale,
    source: 'voice',
    token: extractAuthToken(req),
  });

  res.json({
    ...result,
    transcript: transcript || null,
    sttUsed: false,
    sttProvider: 'disabled',
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

module.exports = {
  chat,
  voice,
  clearSession,
};
