import { useEffect } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { toast } from 'sonner';

/**
 * PWAReloadPrompt
 *
 * Handles service worker lifecycle events:
 * 1. Shows a toast when app is ready for offline use (first install)
 * 2. Shows a persistent toast with "Update Now" button when a new SW version is available
 * 3. Periodically checks for updates (every hour)
 */
export function PWAReloadPrompt() {
  useEffect(() => {
    if ((import.meta.env.MODE || 'development') !== 'production') {
      return undefined;
    }

    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return undefined;
    }

    const updateServiceWorker = registerSW({
      onNeedRefresh() {
        toast('Updating ExpertsHub to the latest version...', {
          id: 'pwa-update-available',
          duration: 2500,
        });

        // Auto-apply updates so users are never stuck on stale API configs.
        updateServiceWorker(true);
      },
      onOfflineReady() {
        toast.success('ExpertsHub is ready to work offline!', {
          id: 'pwa-offline-ready',
          duration: 5000,
        });
      },
      onRegisterError(error) {
        console.error('Service worker registration error:', error);
      },
    });

    const interval = setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
        navigator.serviceWorker.getRegistration().then((registration) => {
          if (registration) {
            registration.update();
          }
        }).catch(() => {
          // noop
        });
      }
    }, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return null;
}
