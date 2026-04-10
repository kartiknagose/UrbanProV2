const isObject = (value) => value != null && typeof value === 'object' && !Array.isArray(value);

const REACT_QUERY_KEYS = new Set(['queryKey', 'signal', 'meta', 'client', 'pageParam']);

function looksLikeReactQueryContext(value) {
  if (!isObject(value)) return false;
  return Object.keys(value).some((key) => REACT_QUERY_KEYS.has(key));
}

/**
 * Normalizes queryFn arguments so API helpers can be used either as:
 *   - queryFn: getSomething
 *   - queryFn: () => getSomething({ page: 1 })
 */
export function normalizeQueryInput(input, fallbackParams = undefined) {
  if (looksLikeReactQueryContext(input)) {
    const signal = input.signal;
    return {
      params: fallbackParams,
      signal,
    };
  }

  if (isObject(input)) {
    return {
      params: input,
      signal: undefined,
    };
  }

  return {
    params: fallbackParams,
    signal: undefined,
  };
}
