/**
 * useAsync Hook
 * Reusable hook for managing async operations (loading, error, success states)
 * 
 * Consolidates async state logic that was previously scattered across pages.
 * Provides consistent loading/error/success/data state management.
 * 
 * Usage:
 * const { data, loading, error, execute } = useAsync(fetchFunction);
 * const { loading, error } = useAsync(async () => { ... });
 */

import { useState, useCallback, useEffect } from 'react';

/**
 * @typedef {Object} AsyncState
 * @property {*} data - The resolved data
 * @property {boolean} loading - Is the operation in progress
 * @property {Error | null} error - Error if operation failed
 * @property {boolean} success - Did the operation succeed
 * @property {Function} execute - Function to execute the async operation
 * @property {Function} reset - Function to reset the state
 */

/**
 * useAsync Hook
 * @param {Function} asyncFunction - Async function to execute
 * @param {boolean} immediate - Execute immediately on mount
 * @param {*} initialData - Initial data value (default: null)
 * @returns {AsyncState}
 */
export function useAsync(asyncFunction, immediate = false, initialData = null) {
  const [state, setState] = useState({
    data: initialData,
    loading: immediate,
    error: null,
    success: false,
  });

  // Execute the async function
  const execute = useCallback(
    async (...args) => {
      // Start loading
      setState(prev => ({
        ...prev,
        loading: true,
        error: null,
        success: false,
      }));

      try {
        // Execute the async function
        const response = await asyncFunction(...args);

        // Success state
        setState({
          data: response,
          loading: false,
          error: null,
          success: true,
        });

        return response;
      } catch (err) {
        // Error state
        const error = err instanceof Error ? err : new Error(String(err));

        setState({
          data: null,
          loading: false,
          error,
          success: false,
        });

        throw error; // Re-throw for caller to handle
      }
    },
    [asyncFunction]
  );

  // Reset to initial state
  const reset = useCallback(() => {
    setState({
      data: initialData,
      loading: false,
      error: null,
      success: false,
    });
  }, [initialData]);

  // Execute immediately if requested
  const executeIfImmediate = useCallback(() => {
    if (immediate) {
      execute();
    }
  }, [immediate, execute]);

  useEffect(() => {
    executeIfImmediate();
  }, [executeIfImmediate]);

  return {
    ...state,
    execute,
    reset,
  };
}

/**
 * useAsyncMutation Hook
 * Similar to useAsync but for mutations (POST, PUT, DELETE)
 * More explicit about what's being executed
 * 
 * Usage:
 * const { data, loading, error, execute: updateProfile } = useAsyncMutation(updateProfileApi);
 * await updateProfile(newData);
 */
export function useAsyncMutation(mutateFn) {
  return useAsync(mutateFn, false, null);
}

/**
 * useAsyncQuery Hook
 * Similar to useAsync but for queries (GET)
 * Automatically fetches on mount
 * 
 * Usage:
 * const { data: profile, loading, error } = useAsyncQuery(getProfileApi);
 */
export function useAsyncQuery(queryFn, dependencies = []) {
  const { data, loading, error, reset, execute } = useAsync(queryFn, true, null);

  useEffect(() => {
    reset();
    execute();
  }, dependencies); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error, refetch: execute };
}

/**
 * useAsyncEffect Hook
 * Execute async function as a side effect
 * Similar to useEffect but for async operations
 * 
 * Usage:
 * useAsyncEffect(async () => {
 *   const data = await fetchData();
 *   setData(data);
 * }, [dependency]);
 */
export function useAsyncEffect(asyncEffect, dependencies = []) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        await asyncEffect();
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      mounted = false;
    };
  }, dependencies); // eslint-disable-line react-hooks/exhaustive-deps

  return { loading, error };
}
