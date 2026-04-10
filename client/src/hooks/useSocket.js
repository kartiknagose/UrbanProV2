import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_BASE_URL } from '../config/runtime';

// Lightweight hook to connect to Socket.IO server and return socket instance.
// If `user` is provided, the hook will automatically join user-specific rooms
// so the server can emit targeted messages (e.g., `worker:<id>`, `customer:<id>`).
//
// Example usage:
// const socketRef = useSocket(user);
// useEffect(() => { if (!socketRef.current) return; socketRef.current.on('booking:created', handler); }, [socketRef]);

export default function useSocket(user = null) {
  const socketRef = useRef(null);

  useEffect(() => {
    if (!user?.id) {
      if (socketRef.current) {
        try { socketRef.current.disconnect(); } catch { /* ignore */ }
        socketRef.current = null;
      }
      try { delete window.__UPRO_SOCKET; } catch { /* ignore */ }
      return;
    }

    const baseUrl = SOCKET_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');

    const socketOptions = {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      upgrade: true,
      timeout: 10000,
      reconnectionAttempts: 10,
      reconnectionDelay: 800,
    };

    const socket = io(baseUrl, socketOptions);
    socketRef.current = socket;
    try { window.__UPRO_SOCKET = socketRef; } catch { /* ignore */ }

    if (import.meta.env.DEV) {
      socket.on('connect', () => {
        console.log('Socket connected', socket.id);
        try { window.dispatchEvent(new Event('upro:socket-ready')); } catch { /* ignore */ }
      });
      socket.on('disconnect', (reason) => console.log('Socket disconnected', reason));
      socket.on('connect_error', (err) => console.warn('Socket connect_error', err?.message || err));
      socket.on('error', (err) => console.warn('Socket error', err?.message || err));
    } else {
      socket.on('connect', () => {
        try { window.dispatchEvent(new Event('upro:socket-ready')); } catch { /* ignore */ }
      });
    }

    socket.on('notification:new', (notification) => {
      try {
        window.dispatchEvent(new CustomEvent('upro:notification-received', { detail: notification }));
      } catch { /* ignore */ }
    });

    socket.on('worker:location_updated', (data) => {
      try {
        window.dispatchEvent(new CustomEvent('upro:worker-location-updated', { detail: data }));
      } catch { /* ignore */ }
    });

    socket.on('chat:message', (message) => {
      try {
        window.dispatchEvent(new CustomEvent('upro:chat-message', { detail: message }));
      } catch { /* ignore */ }
    });

    if (socket.connected) {
      try { window.dispatchEvent(new Event('upro:socket-ready')); } catch { /* ignore */ }
    }

    return () => {
      if (socketRef.current) {
        try { socketRef.current.disconnect(); } catch { /* ignore */ }
        socketRef.current = null;
      }
      try { delete window.__UPRO_SOCKET; } catch { /* ignore */ }
    };
  }, [user?.id, user?.role]);

  return socketRef;
}

/**
 * useSocketEvent Hook
 *
 * A robust hook to manage WebSocket event listeners.
 * Automatically handles the 'upro:socket-ready' event and cleanup.
 */
export function useSocketEvent(event, callback, deps = []) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback, deps]);

  useEffect(() => {
    let activeSocket = null;

    const listener = (...args) => {
      try {
        callbackRef.current?.(...args);
      } catch {
        // Ignore callback runtime errors to keep socket listener alive.
      }
    };

    const attach = (socket) => {
      if (!socket || !socket.on) return;
      if (activeSocket === socket) return;
      if (activeSocket) activeSocket.off(event, listener);
      activeSocket = socket;
      socket.on(event, listener);
    };

    const handleReady = () => {
      const socketRefGlobal = typeof window !== 'undefined' ? window.__UPRO_SOCKET : null;
      if (socketRefGlobal?.current) {
        attach(socketRefGlobal.current);
      }
    };

    handleReady();
    if (typeof window !== 'undefined') {
      window.addEventListener('upro:socket-ready', handleReady);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('upro:socket-ready', handleReady);
      }
      if (activeSocket) {
        activeSocket.off(event, listener);
      }
    };
  }, [event]);
}

/**
 * useSocketEmit Hook
 *
 * Helper to emit events to the global socket safely.
 */
export function useSocketEmit() {
  const emit = (event, payload) => {
    const socketRefGlobal = typeof window !== 'undefined' ? window.__UPRO_SOCKET : null;
    if (socketRefGlobal?.current) {
      socketRefGlobal.current.emit(event, payload);
      return true;
    }
    return false;
  };

  return emit;
}
