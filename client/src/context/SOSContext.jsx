/* eslint-disable react-refresh/only-export-components */
/**
 * SOSContext — Global Safety Context
 *
 * Tracks whether the logged-in user has an active booking (CONFIRMED / IN_PROGRESS).
 * When they do, a floating SOS button is rendered globally (outside any specific page).
 *
 * Polling strategy:
 * - Polls every 60s when user is authenticated
 * - Stops polling when no active booking found (reduces load)
 * - Immediately re-checks after any booking status change via socket
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getActiveBooking } from '../api/safety';
import { useAuth } from '../hooks/useAuth';
import { useSocketEvent } from '../hooks/useSocket';

const SOSContext = createContext(null);

export function SOSProvider({ children }) {
    const { user, isAuthenticated } = useAuth();
    const [activeBooking, setActiveBooking] = useState(null); // { id, status, service }
    const [isLoading, setIsLoading] = useState(false);
    const intervalRef = useRef(null);
    const isSafetyRole = user?.role === 'CUSTOMER' || user?.role === 'WORKER';

    const fetchActiveBooking = useCallback(async () => {
        if (!isAuthenticated || !user || !isSafetyRole) {
            setActiveBooking(null);
            return;
        }
        try {
            setIsLoading(true);
            const data = await getActiveBooking();
            setActiveBooking(data.booking || null);
        } catch {
            // Fail silently — SOS is a safety net, not critical for UI flow
            setActiveBooking(null);
        } finally {
            setIsLoading(false);
        }
    }, [isAuthenticated, user, isSafetyRole]);

    // Poll when auth changes, pause when tab is hidden
    useEffect(() => {
        if (!isAuthenticated || !user || !isSafetyRole) {
            setActiveBooking(null);
            if (intervalRef.current) clearInterval(intervalRef.current);
            return;
        }

        fetchActiveBooking();

        const startPolling = () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = setInterval(fetchActiveBooking, 60_000);
        };

        const stopPolling = () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = null;
        };

        const handleVisibilityChange = () => {
            if (document.hidden) {
                stopPolling();
            } else {
                fetchActiveBooking();
                startPolling();
            }
        };

        startPolling();
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            stopPolling();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [isAuthenticated, user, isSafetyRole, fetchActiveBooking]);

    // Listen to socket events for instant updates (no need to wait for poll)
    useSocketEvent('booking:status_updated', fetchActiveBooking, [fetchActiveBooking]);
    useSocketEvent('booking:created', fetchActiveBooking, [fetchActiveBooking]);

    return (
        <SOSContext.Provider value={{ activeBooking, isLoading, refetch: fetchActiveBooking }}>
            {children}
        </SOSContext.Provider>
    );
}

export function useSOS() {
    const ctx = useContext(SOSContext);
    if (!ctx) throw new Error('useSOS must be used within SOSProvider');
    return ctx;
}
