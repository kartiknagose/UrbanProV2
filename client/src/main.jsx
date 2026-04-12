import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import App from './App.jsx';
import GlobalErrorBoundary from './components/common/GlobalErrorBoundary.jsx';
import { ToastProvider } from './components/common/ToastProvider.jsx';
import { initClientMonitoring } from './config/sentry';
import './index.css';
import './config/i18n';
import { installToastDeduper } from './utils/toastDeduper';

initClientMonitoring();
installToastDeduper();

/**
 * React Query Client Setup
 *
 * Manages server state (API responses, caching, refetching)
 * Configuration:
 * - staleTime: 30 sec - cache is fresh for 30 seconds (more real-time)
 * - gcTime: 5 min - cache is garbage collected after 5 minutes
 * - retry: 3 with exponential backoff - more resilient to network blips
 * - retryDelay: exponential backoff (100ms, 200ms, 400ms)
 * - refetchOnWindowFocus: false - don't refetch when window gains focus
 * - retryOnMount: true - retry failed queries when component remounts
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds - shorter for more real-time updates
      gcTime: 5 * 60 * 1000, // 5 minutes garbage collection time
      retry: 3, // Retry up to 3 times
      retryDelay: (attemptIndex) => {
        // Exponential backoff: 100ms, 200ms, 400ms
        return Math.min(1000 * 2 ** attemptIndex, 30000);
      },
      refetchOnWindowFocus: false,
      retryOnMount: true, // Retry if query failed and component remounts
    },
    mutations: {
      retry: 2, // Retry mutations twice (less aggressive than queries)
      retryDelay: (attemptIndex) => {
        return Math.min(1000 * 2 ** attemptIndex, 30000);
      },
    },
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* QueryClientProvider - gives React Query to entire app */}
    <QueryClientProvider client={queryClient}>
      {/* NotificationProvider - gives global notifications to entire app */}
      <NotificationProvider>
        {/* AuthProvider - gives authentication context to entire app */}
        <AuthProvider>
          <GlobalErrorBoundary>
            <App />
          </GlobalErrorBoundary>
          <ToastProvider />
        </AuthProvider>
      </NotificationProvider>
    </QueryClientProvider>
  </StrictMode>
);

