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
 * - staleTime: 5 min - cache is fresh for 5 minutes
 * - gcTime: 10 min - cache is garbage collected after 10 minutes
 * - retry: 1 - retry failed requests once
 * - refetchOnWindowFocus: false - don't refetch when window gains focus
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
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

