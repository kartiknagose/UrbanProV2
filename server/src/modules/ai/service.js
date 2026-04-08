const coreService = require('./serviceCore');

async function processChatInput(payload) {
  return coreService.processChatInput(payload);
}

async function resetSession(userId, sessionId) {
  return coreService.resetSession(userId, sessionId);
}

async function getAiUsageAnalytics(options) {
  return coreService.getAiUsageAnalytics(options);
}

module.exports = {
  processChatInput,
  resetSession,
  getAiUsageAnalytics,
};
