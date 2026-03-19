export const toFiniteNumber = (value, fallback = null) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const toFixedSafe = (value, digits = 1, fallback = null) => {
  const n = toFiniteNumber(value, null);
  if (n === null) return fallback;
  return n.toFixed(digits);
};
