/**
 * Network detection and monitoring utilities
 * 
 * Detects whether user is online/offline and provides hooks
 * to prevent mutations when offline
 */

/**
 * Get current network status
 * @returns {boolean} true if online, false if offline
 */
export const isNetworkOnline = () => {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
};

/**
 * Subscribe to network status changes
 * 
 * @param {Function} callback - Called with (isOnline) when status changes
 * @returns {Function} Unsubscribe function
 */
export const onNetworkStatusChange = (callback) => {
  if (typeof window === 'undefined') return () => {};

  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
};

/**
 * Wait until network is online (with timeout)
 * 
 * @param {number} timeoutMs - Max time to wait (default: 30s)
 * @returns {Promise} Resolves when online, rejects on timeout
 */
export const waitForNetworkOnline = (timeoutMs = 30000) => {
  return new Promise((resolve, reject) => {
    // Check if already online
    if (isNetworkOnline()) {
      resolve();
      return;
    }

    // Set up timeout
    let timeout;
    const handleOnline = () => {
      clearTimeout(timeout);
      window.removeEventListener('online', handleOnline);
      resolve();
    };

    timeout = setTimeout(() => {
      window.removeEventListener('online', handleOnline);
      reject(new Error('Network did not come online within timeout'));
    }, timeoutMs);

    window.addEventListener('online', handleOnline);
  });
};

/**
 * Get network information (if available)
 * Modern browsers provide connection info through Navigator.connection
 * 
 * @returns {object} Connection info or null
 */
export const getNetworkInfo = () => {
  if (typeof navigator === 'undefined') return null;

  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!connection) return null;

  return {
    online: navigator.onLine,
    effectiveType: connection.effectiveType, // '4g', '3g', '2g', 'slow-2g'
    downlink: connection.downlink, // Mbps
    rtt: connection.rtt, // Round trip time in ms
    saveData: connection.saveData, // User enabled data saver
  };
};

/**
 * Check if connection is slow (2G, 3G, or high RTT)
 */
export const isSlowConnection = () => {
  const info = getNetworkInfo();
  if (!info) return false;

  if (['2g', 'slow-2g', '3g'].includes(info.effectiveType)) return true;
  if (info.rtt && info.rtt > 500) return true; // >500ms round trip is slow

  return false;
};
