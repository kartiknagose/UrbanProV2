/**
 * Parse a route parameter as an integer ID.
 * Returns the parsed integer or throws AppError(400) if the value is not a valid integer.
 *
 * Usage:  const bookingId = parseId(req.params.id, 'Booking ID');
 *
 * @param {string} value - The raw string from req.params
 * @param {string} [label='ID'] - Human-readable label for the error message
 * @returns {number} The parsed integer
 */
const AppError = require('../errors/AppError');

function parseId(value, label = 'ID') {
  const normalized = String(value || '').trim();
  if (!/^\d+$/.test(normalized)) {
    throw new AppError(400, `Invalid ${label}. Must be a positive integer.`);
  }

  const id = Number(normalized);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new AppError(400, `Invalid ${label}. Must be a positive integer.`);
  }
  return id;
}

module.exports = parseId;
