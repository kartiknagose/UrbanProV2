/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback } from 'react';
import { toast } from 'sonner';

/**
 * Notification Context
 * Global error, success, warning messages across the app
 * Now integrated with `sonner` for visible toast notifications
 */
export const NotificationContext = createContext();

/**
 * Notification Provider Component
 * Wraps your app to provide global notifications via sonner
 */
export function NotificationProvider({ children }) {
  /**
   * Add a notification using sonner toast
   */
  const addNotification = useCallback((message, type = 'info', duration = 4000) => {
    const text = typeof message === 'string' ? message : String(message || '');
    const id = `${type}:${text.trim().toLowerCase()}`;

    switch (type) {
      case 'error':
        toast.error(message, { id, duration, dedupeWindowMs: 3000 });
        break;
      case 'success':
        toast.success(message, { id, duration, dedupeWindowMs: 3000 });
        break;
      case 'warning':
        toast.warning(message, { id, duration, dedupeWindowMs: 3000 });
        break;
      case 'info':
      default:
        toast.info(message, { id, duration, dedupeWindowMs: 3000 });
        break;
    }

    return id;
  }, []);

  /**
   * Remove a notification
   */
  const removeNotification = useCallback((id) => {
    toast.dismiss(id);
  }, []);

  /**
   * Shortcuts for different notification types
   */
  const showError = useCallback((message) => addNotification(message, 'error', 5000), [addNotification]);
  const showSuccess = useCallback((message) => addNotification(message, 'success', 3000), [addNotification]);
  const showWarning = useCallback((message) => addNotification(message, 'warning', 4000), [addNotification]);
  const showInfo = useCallback((message) => addNotification(message, 'info', 3000), [addNotification]);

  const value = {
    notifications: [], // kept for backward compatibility
    addNotification,
    removeNotification,
    showError,
    showSuccess,
    showWarning,
    showInfo,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

