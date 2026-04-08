import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { AppRoutes } from './routes/AppRoutes';
import { ThemeProvider } from './context/ThemeContext';
import { SOSProvider } from './context/SOSContext';
import { CityProvider } from './context/CityContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { OfflineBanner } from './components/common/OfflineBanner';
import { useAuth } from './hooks/useAuth';

const GlobalSOSButton = lazy(() => import('./components/features/safety/GlobalSOSButton').then(m => ({ default: m.GlobalSOSButton })));
const GlobalSocketListener = lazy(() => import('./components/common/GlobalSocketListener').then(m => ({ default: m.GlobalSocketListener })));
const PWAReloadPrompt = lazy(() => import('./components/features/pwa/PWAReloadPrompt').then(m => ({ default: m.PWAReloadPrompt })));
const PWAInstallPrompt = lazy(() => import('./components/features/pwa/PWAInstallPrompt').then(m => ({ default: m.PWAInstallPrompt })));
const AICommandWidget = lazy(() => import('./components/features/chat/AICommandWidget'));

/**
 * SessionExpiredHandler
 *
 * Listens for the custom 'auth:session-expired' event dispatched by the Axios
 * interceptor and triggers logout + navigation via React Router (no page reload).
 */
function SessionExpiredHandler() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handler = () => {
      logout();
      navigate('/login', { replace: true });
    };

    window.addEventListener('auth:session-expired', handler);
    return () => window.removeEventListener('auth:session-expired', handler);
  }, [logout, navigate]);

  return null;
}

/**
 * Root App Component
 *
 * Wraps entire application with:
 * 1. ErrorBoundary - catches runtime errors
 * 2. ThemeProvider - dark/light mode
 * 3. BrowserRouter - enables client-side routing
 * 4. SOSProvider - global active booking tracker for SOS button
 * 5. GlobalSOSButton - floating SOS button (visible on all pages during active bookings)
 * 6. SessionExpiredHandler - handles auth session expiry via React Router
 * 7. AppRoutes - all route definitions
 */
function App() {
  const { isAuthenticated } = useAuth();

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <BrowserRouter>
          <CityProvider>
            <SOSProvider>
              <OfflineBanner />
              <SessionExpiredHandler />
              <AppRoutes />
              <Suspense fallback={null}>
                {isAuthenticated && <GlobalSocketListener />}
                {isAuthenticated && <GlobalSOSButton />}
                {isAuthenticated && <AICommandWidget />}
                <PWAReloadPrompt />
                <PWAInstallPrompt />
              </Suspense>
            </SOSProvider>
          </CityProvider>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
