/**
 * AI Text Processing Module
 * Handles text normalization, sanitization, and extraction
 */

/**
 * Normalize text for processing
 */
function normalizeText(text) {
  return String(text || '').trim();
}

/**
 * Sanitize LLM input to prevent prompt injection and excessive content
 * @param {string} text - Raw user input
 * @returns {string} Sanitized text (max 2000 chars)
 */
function sanitizeLlmInput(text) {
  const value = String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')        // Remove code blocks
    .split('\0').join(' ')                   // Remove null bytes
    .replace(/\r\n/g, '\n')                  // Normalize line endings
    .replace(/[ \t]{2,}/g, ' ')              // Collapse whitespace
    .trim();

  return value
    // Remove prompt injection attempts
    .replace(/\b(ignore|disregard|override)\s+(all|previous|earlier)\s+(instructions?|prompts?)\b/gi, '[redacted]')
    .replace(/\b(system|developer|assistant)\s*:/gi, '[redacted]:')
    // Limit length
    .slice(0, 2000);
}

/**
 * Extract numeric value from text
 * e.g., extractNumber("I want to book for 3 days") => 3
 */
function extractNumber(text) {
  const match = String(text || '').match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

/**
 * Extract OTP from text
 * e.g., extractOtp("My OTP is 1234") => "1234"
 */
function extractOtp(text) {
  const match = String(text || '').match(/\b\d{4}\b/);
  return match ? match[0] : null;
}

/**
 * Extract time/date references
 * e.g., extractTime("tomorrow at 3pm") => relevant date object
 */
function extractTime(text) {
  const lowerText = String(text || '').toLowerCase();
  const timePatterns = {
    today: /\btoday\b/,
    tomorrow: /\btomorrow\b/,
    now: /\bnow\b|immediately|asap/,
    afternoon: /afternoon|3\s*pm|15:00/,
    evening: /evening|6\s*pm|18:00/,
    morning: /morning|9\s*am|09:00/,
  };

  for (const [timeRef, pattern] of Object.entries(timePatterns)) {
    if (pattern.test(lowerText)) return timeRef;
  }

  return null;
}

/**
 * Extract rating from text
 * e.g., extractRating("rate 5") => 5
 */
function extractRating(text) {
  const lowerText = String(text || '').toLowerCase();

  // Match "5 star" or "5 stars" or just "5"
  const match = lowerText.match(/(\d)\s*(?:star)?s?/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (num >= 1 && num <= 5) return num;
  }

  // Match words like "excellent", "good", "okay", "bad", "terrible"
  const ratings = {
    5: /excellent|awesome|great|perfect|outstanding/,
    4: /good|nice|satisfied|happy/,
    3: /okay|average|fine|decent/,
    2: /bad|poor|disappointed|unhappy/,
    1: /terrible|awful|horrible|waste/,
  };

  for (const [score, pattern] of Object.entries(ratings)) {
    if (pattern.test(lowerText)) return parseInt(score, 10);
  }

  return null;
}

module.exports = {
  normalizeText,
  sanitizeLlmInput,
  extractNumber,
  extractOtp,
  extractTime,
  extractRating,
};
