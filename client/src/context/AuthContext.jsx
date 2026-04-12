import { useReducer, useCallback, useEffect, useMemo } from 'react';
import useSocket from '../hooks/useSocket';
import { login as apiLogin, registerCustomer, registerWorker, logout as apiLogout, getCurrentUser } from '../api';
import { resolveProfilePhotoUrl } from '../utils/profilePhoto';
import { safeGetItem, safeSetItem, safeRemoveItem } from '../utils/storage';
import { AuthContext } from './AuthContextBase';

/**
 * Auth Context
 * 
 * Global authentication state management
 * Provides: user info, loading state, auth actions
 */

/**
 * Initial auth state
 * This is what auth looks like when app starts
 */
const initialState = {
  user: null, // Current logged-in user (or null if not logged in)
  isLoading: true, // Loading while checking if user is already logged in
  isAuthenticated: false, // Simple boolean: is user logged in?
  error: null, // Error message if login failed
};

/**
 * Action types for useReducer
 * These are all the ways auth state can change
 */
const ACTIONS = {
  SET_LOADING: 'SET_LOADING', // Change loading state
  LOGIN_SUCCESS: 'LOGIN_SUCCESS', // User logged in successfully
  LOGIN_ERROR: 'LOGIN_ERROR', // Login failed
  LOGOUT: 'LOGOUT', // User logged out
  SET_USER: 'SET_USER', // Set user data (from API response)
  CLEAR_ERROR: 'CLEAR_ERROR', // Clear error message
};

/**
 * Reducer function
 * Pure function that takes (state, action) and returns new state
 * 
 * Like a state machine - handles all state transitions
 */
function authReducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload, // true or false
      };

    case ACTIONS.LOGIN_SUCCESS:
      return {
        ...state,
        user: action.payload, // User object from API
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };

    case ACTIONS.LOGIN_ERROR:
      return {
        ...state,
        error: action.payload, // Error message
        isLoading: false,
      };

    case ACTIONS.SET_USER:
      return {
        ...state,
        user: action.payload, // User object
        isAuthenticated: action.payload !== null, // true if user exists
      };

    case ACTIONS.LOGOUT:
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
      };

    case ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null,
      };

    default:
      return state;
  }
}

const getApiErrorMessage = (error, fallback) => {
  if (error?.code === 'ECONNABORTED') {
    return 'Server is waking up or slow. Please try again in a few seconds.';
  }

  if (error?.request && !error?.response) {
    return 'Unable to reach server. Check your network and try again.';
  }

  return (
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    fallback
  );
};

const getStoredUser = () => {
  try {
    const raw = safeGetItem('user');
    if (!raw) return null;

    // Handle both string and object (safeGetItem might return either)
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    console.warn('Failed to retrieve stored user:', error.message);
    safeRemoveItem('user');
    return null;
  }
};

/**
 * AuthProvider Component
 * 
 * Wraps your app to provide auth context to all children
 * 
 * Usage:
 * <AuthProvider>
 *   <App />
 * </AuthProvider>
 */
export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  /**
   * On app mount, check if user is already logged in
   * This restores the session after page refresh
   */
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        // Session is cookie-based; /auth/me validates cookie
        const data = await getCurrentUser();

        // Prefer stored user details for UI if it matches current session
        const storedUser = getStoredUser();
        const sessionUser = data.user || null;
        const user = storedUser?.id === sessionUser?.id
          ? { ...storedUser, ...sessionUser }
          : sessionUser;

        if (user?.profilePhotoUrl) {
          user.profilePhotoUrl = resolveProfilePhotoUrl(user.profilePhotoUrl);
        }

        if (user) {
          safeSetItem('user', user);
        }

        // User is authenticated, restore their session
        dispatch({
          type: ACTIONS.LOGIN_SUCCESS,
          payload: user,
        });
      } catch (error) {
        // Session missing/expired or network error - clear auth state
        console.warn('Session check failed:', error.message);
        safeRemoveItem('user');
        dispatch({ type: ACTIONS.LOGOUT });
      } finally {
        // Stop loading regardless of result
        dispatch({ type: ACTIONS.SET_LOADING, payload: false });
      }
    };

    checkExistingSession();
  }, []);

  /**
   * Set user (after successful login)
   * Called from LoginPage after API returns user
   */
  const setUser = useCallback((user) => {
    dispatch({ type: ACTIONS.SET_USER, payload: user });
  }, []);

  /**
   * Logout user
   * Calls logout API and clears auth state
   */
  const logout = useCallback(async () => {
    try {
      // Call logout API to clear server cookie
      await apiLogout();
    } catch (error) {
      console.warn('Logout API error:', error.message);
    } finally {
      // Clear auth state and cached user (with fallback handling)
      safeRemoveItem('user');
      dispatch({ type: ACTIONS.LOGOUT });
      dispatch({ type: ACTIONS.CLEAR_ERROR });
    }
  }, []);

  /**
   * Login user with email and password
   * @param {Object} credentials - Login credentials
   * @param {string} credentials.email - User email
   * @param {string} credentials.password - User password
   * @returns {Promise} Success or error
   */
  const login = useCallback(async (credentials) => {
    try {
      // dispatch({ type: ACTIONS.SET_LOADING, payload: true });

      // Call login API
      const data = await apiLogin(credentials);

      // Fetch full user from session for consistent hydration
      let resolvedUser = data.user || null;
      try {
        const session = await getCurrentUser();
        resolvedUser = session.user || resolvedUser;
      } catch {
        // Keep login response if session check fails
      }

      if (resolvedUser?.profilePhotoUrl) {
        resolvedUser.profilePhotoUrl = resolveProfilePhotoUrl(resolvedUser.profilePhotoUrl);
      }

      // Store user for UI convenience (cookie handles auth)
      if (resolvedUser) {
        localStorage.setItem('user', JSON.stringify(resolvedUser));
      }

      // Update auth state
      dispatch({ type: ACTIONS.LOGIN_SUCCESS, payload: resolvedUser });

      return { success: true };
    } catch (error) {
      const errorMessage = getApiErrorMessage(error, 'Login failed');
      localStorage.removeItem('user');
      dispatch({ type: ACTIONS.LOGOUT });
      dispatch({ type: ACTIONS.LOGIN_ERROR, payload: errorMessage });
      return { success: false, error: errorMessage };
    }
  }, []);

  /**
   * Register new customer
   * @param {Object} data - Registration data
   * @returns {Promise} Success or error
   */
  const register = useCallback(async (data) => {
    try {
      // dispatch({ type: ACTIONS.SET_LOADING, payload: true });

      // Call register API
      await registerCustomer(data);
      // User must verify email before logging in.

      // dispatch({ type: ACTIONS.SET_LOADING, payload: false }); // Not needed as we didn't set it to true
      return { success: true };
    } catch (error) {
      const errorMessage = getApiErrorMessage(error, 'Registration failed');
      dispatch({ type: ACTIONS.LOGIN_ERROR, payload: errorMessage });
      return { success: false, error: errorMessage };
    }
  }, []);

  /**
   * Register new worker
   * @param {Object} data - Worker registration data
   * @returns {Promise} Success or error
   */
  const registerAsWorker = useCallback(async (data) => {
    try {
      // dispatch({ type: ACTIONS.SET_LOADING, payload: true });

      // Call worker register API
      await registerWorker(data);

      // dispatch({ type: ACTIONS.SET_LOADING, payload: false });
      return { success: true };
    } catch (error) {
      const errorMessage = getApiErrorMessage(error, 'Worker registration failed');
      dispatch({ type: ACTIONS.LOGIN_ERROR, payload: errorMessage });
      return { success: false, error: errorMessage };
    }
  }, []);

  /**
   * Clear error message
   * Called when user dismisses error
   */
  const clearError = useCallback(() => {
    dispatch({ type: ACTIONS.CLEAR_ERROR });
  }, []);

  /**
   * Value object passed to all children
   * This is what useAuth() hook returns
   * Memoized to prevent unnecessary re-renders of consumers
   */
  const value = useMemo(() => ({
    // State (read-only)
    user: state.user, // Current user object or null
    isAuthenticated: state.isAuthenticated, // Boolean
    isLoading: state.isLoading, // Boolean
    error: state.error, // Error string or null

    // Actions (functions to change state)
    login, // Login with email/password
    register, // Register new customer
    registerAsWorker, // Register new worker
    setUser, // Update user after login
    logout, // Clear user on logout
    clearError, // Clear error message
  }), [state.user, state.isAuthenticated, state.isLoading, state.error, login, register, registerAsWorker, setUser, logout, clearError]);

  // Initialize socket and auto-join rooms for the current user (if any)
  useSocket(state.user);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
