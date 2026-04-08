const coreService = require('./serviceCore');

async function processChatInput(payload) {
  return coreService.processChatInput(payload);
}

async function resetSession(userId, sessionId) {
  return coreService.resetSession(userId, sessionId);
}

module.exports = {
  processChatInput,
  resetSession,
};
