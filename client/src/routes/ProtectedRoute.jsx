import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, useAuthStatus } from '../hooks/useAuth';
import { FullPageSpinner } from '../components/ui/Spinner';

/**
 * ProtectedRoute Component
 * 
 * Wrapper for pages that require authentication
 * Redirects to login if user is not authenticated
 * Shows loading while checking auth status
 * 
 * Usage in App.jsx:
 * <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Page component to protect
 * @returns {React.ReactNode} Page or redirect to login
 */
export function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuthStatus();
  const { user } = useAuth();
  const location = useLocation();

  // Step 1: Still checking if user is logged in
  if (isLoading) return <FullPageSpinner />;

  if (isAuthenticated && (!user || !user.role)) {
    return <FullPageSpinner />;
  }

  // Step 2: User is not logged in → redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  // Step 3: User is logged in → show the page
  return children;
}

/**
 * AdminRoute Component
 *
 * Wrapper for pages that require ADMIN role
 * Redirects to admin login if not authenticated
 * Redirects to user dashboard if authenticated but not admin
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Page component to protect
 * @returns {React.ReactNode} Page or redirect
 */
export function AdminRoute({ children }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullPageSpinner />;

  if (isAuthenticated && (!user || !user.role)) return <FullPageSpinner />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  if (user?.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  return children;
}

/**
 * PublicRoute Component
 * 
 * Wrapper for pages that should NOT be accessed by logged-in users
 * (Login, Register pages)
 * Redirects to dashboard if user is already logged in
 * 
 * Usage in App.jsx:
 * <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Page component to show
 * @returns {React.ReactNode} Page or redirect to dashboard
 */
export function PublicRoute({ children }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();
  const allowPublic =
    (import.meta.env.MODE || 'development') !== 'production'
    && new URLSearchParams(location.search).get('force') === 'true';

  // Step 1: Still checking
  if (isLoading) return <FullPageSpinner />;

  if (allowPublic) {
    return children;
  }

  if (isAuthenticated && (!user || !user.role)) {
    return <FullPageSpinner />;
  }

  // Step 2: User is already logged in → redirect based on role
  if (isAuthenticated) {
    // Redirect to appropriate dashboard based on user role
    if (user?.role === 'ADMIN') {
      return <Navigate to="/admin/dashboard" replace />;
    }
    if (user?.role === 'WORKER') {
      return <Navigate to="/worker/dashboard" replace />;
    }
    // Default for CUSTOMER
    return <Navigate to="/customer/dashboard" replace />;
  }

  // Step 3: User is not logged in → show the page (login/register)
  return children;
}

/**
 * WorkerRoute Component
 *
 * Wrapper for pages that require WORKER role
 * Redirects to login if not authenticated
 * Redirects to appropriate dashboard if authenticated but not worker
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Page component to protect
 * @returns {React.ReactNode} Page or redirect
 */
export function WorkerRoute({ children }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullPageSpinner />;

  if (isAuthenticated && (!user || !user.role)) return <FullPageSpinner />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  if (user?.role !== 'WORKER') {
    // Redirect to appropriate dashboard based on role
    if (user?.role === 'ADMIN') {
      return <Navigate to="/admin/dashboard" replace />;
    }
    return <Navigate to="/customer/dashboard" replace />;
  }

  return children;
}

/**
 * CustomerRoute Component
 *
 * Wrapper for pages that require CUSTOMER role
 * Redirects to login if not authenticated
 * Redirects to appropriate dashboard if authenticated but not customer
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Page component to protect
 * @returns {React.ReactNode} Page or redirect
 */
export function CustomerRoute({ children }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullPageSpinner />;

  if (isAuthenticated && (!user || !user.role)) return <FullPageSpinner />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  if (user?.role !== 'CUSTOMER') {
    // Redirect to appropriate dashboard based on role
    if (user?.role === 'WORKER') {
      return <Navigate to="/worker/dashboard" replace />;
    }
    if (user?.role === 'ADMIN') {
      return <Navigate to="/admin/dashboard" replace />;
    }
    // If not matching any above (and somehow we are here), default safe fallback
    return <Navigate to="/login" replace />;
  }

  return children;
}
