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
  const userRef = useRef(null);
  useEffect(() => {
    userRef.current = user;
  }, [user]);
  // NOTE: Only connect when we have an authenticated user. The server now
  // rejects unauthenticated socket connections, so connecting without a
  // valid cookie is pointless and would just produce console errors.
  useEffect(() => {
    // Skip connection if no user is logged in
    if (!user?.id) {
      // Clean up any existing socket from a previous session (logout)
      if (socketRef.current) {
        try { socketRef.current.disconnect(); } catch { /* ignore */ }
        socketRef.current = null;
      }
      try { delete window.__UPRO_SOCKET; } catch { /* ignore */ }
      return;
    }

    const socketOptions = {
      withCredentials: true,
      // Force polling in dev to avoid websocket upgrade failures on refresh.
      transports: ['polling'],
      upgrade: false,
    };

    function joinRooms() {
      // Role-based rooms (user:X, worker:X, customer:X, admin) are auto-joined
      // server-side on connection — no need to request them here.
    }

    function attachDebugHandlers(socket, label) {
      if (import.meta.env.DEV) {
        socket.on('connect', () => {
          console.log(`Socket connected (${label})`, socket.id);
          joinRooms(socket);
          try { window.dispatchEvent(new Event('upro:socket-ready')); } catch { /* ignore */ }
        });
        socket.on('disconnect', (reason) => console.log(`Socket disconnected (${label})`, reason));
        socket.on('connect_error', (err) => console.warn(`Socket connect_error (${label})`, err?.message || err));
        socket.on('error', (err) => console.warn(`Socket error (${label})`, err?.message || err));
      } else {
        socket.on('connect', () => {
          joinRooms(socket);
          try { window.dispatchEvent(new Event('upro:socket-ready')); } catch { /* ignore */ }
        });
      }

      // Global notification event
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
    }

    // Attempt to connect to a list of candidate server URLs and pick the first
    // successful connection. This helps when server runs on 3000 or 3001 or
    // when `VITE_API_URL` is not set.
    const candidates = [];
    if (SOCKET_BASE_URL) candidates.push(SOCKET_BASE_URL);

    try {
      const host = window.location.hostname || 'localhost';
      candidates.push(`http://${host}:3000`);
      candidates.push(`http://${host}:3001`);
    } catch {
      candidates.push('http://localhost:3000', 'http://localhost:3001');
    }

    let mounted = true;

    async function tryConnect() {
      for (const base of candidates) {
        if (!mounted) return;
        try {
          // Create socket with autoConnect: false so we can control connection
          const socket = io(base, { ...socketOptions, autoConnect: false });
          attachDebugHandlers(socket, base);

          const connected = await new Promise((resolve) => {
            const timeout = setTimeout(() => {
              // timeout - treat as failed
              socket.off('connect', onConnect);
              socket.off('connect_error', onError);
              try { socket.close(); } catch { /* ignore */ }
              resolve(false);
            }, 1500);

            const onConnect = () => {
              clearTimeout(timeout);
              socket.off('connect_error', onError);
              resolve(true);
            };
            const onError = () => {
              clearTimeout(timeout);
              socket.off('connect', onConnect);
              try { socket.close(); } catch { /* ignore */ }
              resolve(false);
            };

            socket.once('connect', onConnect);
            socket.once('connect_error', onError);
            // Start connection attempt
            try { socket.connect(); } catch { onError(); }
          });

          if (connected && mounted) {
            socketRef.current = socket;
            try { window.__UPRO_SOCKET = socketRef; } catch { /* ignore */ }
            return;
          }
        } catch {
          // try next
        }
      }

      // If none connected, create a default socket to the first candidate
      const fallback = io(candidates[0] || 'http://localhost:3000', socketOptions);
      socketRef.current = fallback;
      try { window.__UPRO_SOCKET = socketRef; } catch { /* ignore */ }
      attachDebugHandlers(fallback, 'fallback');
    }

    tryConnect();

    return () => {
      mounted = false;
      if (socketRef.current) {
        try { socketRef.current.disconnect(); } catch { /* ignore */ }
        socketRef.current = null;
      }
      try { delete window.__UPRO_SOCKET; } catch { /* ignore */ }
    };
  }, [user?.id]); // Re-run on login (user appears) or logout (user becomes null)

  // Join user-specific rooms when `user` becomes available
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !user?.id) return;

    socket.emit('joinRoom', `user:${user.id}`);
    if (user.role === 'WORKER') socket.emit('joinRoom', `worker:${user.id}`);
    if (user.role === 'CUSTOMER') socket.emit('joinRoom', `customer:${user.id}`);
    if (user.role === 'ADMIN') socket.emit('joinRoom', 'admin');
  }, [user]);

  return socketRef;
}

/**
 * useSocketEvent Hook
 * 
 * A robust hook to manage WebSocket event listeners.
 * Automatically handles the 'upro:socket-ready' event and cleanup.
 */
export function useSocketEvent(event, callback, deps = []) {
  useEffect(() => {
    let activeSocket = null;

    const attach = (socket) => {
      if (!socket || !socket.on) return;
      if (activeSocket === socket) return;
      if (activeSocket) activeSocket.off(event, callback);
      activeSocket = socket;
      socket.on(event, callback);
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
        activeSocket.off(event, callback);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, ...deps]);
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
