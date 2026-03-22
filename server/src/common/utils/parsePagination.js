/**
 * Parse pagination query parameters from Express req.query.
 *
 * @param {object} query - Express req.query object
 * @returns {{ page: number, limit: number, skip: number }}
 */
function parsePagination(query = {}) {
  const parsePositiveInt = (value, fallback) => {
    const normalized = String(value ?? '').trim();
    if (!normalized) return fallback;
    if (!/^\d+$/.test(normalized)) return fallback;

    const parsed = Number(normalized);
    if (!Number.isSafeInteger(parsed) || parsed < 1) return fallback;
    return parsed;
  };

  const page = parsePositiveInt(query.page, 1);
  const limit = Math.min(100, parsePositiveInt(query.limit, 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

module.exports = parsePagination;
