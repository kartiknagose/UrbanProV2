import { useState, useEffect, useCallback, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { updateWorkerLocation } from '../api/location';
import { toast } from 'sonner';
import { io } from 'socket.io-client';
import { SOCKET_BASE_URL } from '../config/runtime';

const ONLINE_STATE_KEY = 'upro.worker.online';
const LAST_LOCATION_KEY = 'upro.worker.last_location';
const MIN_DIST_METERS = 20; // Only update if moved > 20m
const MAX_IDLE_TIME = 60000; // Force update every 1 minute even if idle
const GEOLOCATION_OPTIONS = {
    high: { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    low: { enableHighAccuracy: false, timeout: 20000, maximumAge: 10000 }
};

// Simple distance helper (Euclidean is enough for tiny distances)
const getDistance = (l1, l2) => {
    if (!l1 || !l2) return Infinity;
    const R = 6371e3; // metres
    const φ1 = l1.latitude * Math.PI / 180;
    const φ2 = l2.latitude * Math.PI / 180;
    const Δφ = (l2.latitude - l1.latitude) * Math.PI / 180;
    const Δλ = (l2.longitude - l1.longitude) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
};

/**
 * Standard live location hook for workers
 * Adaptive, robust, and performs like industrial systems (Uber/Ola)
 */
export function useWorkerLocation(isWorker = false) {
    const [isOnline, setIsOnline] = useState(() => {
        if (typeof window === 'undefined') return true;
        const stored = window.localStorage.getItem(ONLINE_STATE_KEY);
        return stored === null ? true : stored === '1';
    });

    const [currentLocation, setCurrentLocation] = useState(() => {
        if (typeof window === 'undefined') return null;
        const stored = window.localStorage.getItem(LAST_LOCATION_KEY);
        try {
            return stored ? JSON.parse(stored) : null;
        } catch {
            return null;
        }
    });

    const [hasPermission, setHasPermission] = useState(true);
    const [accuracyLevel, setAccuracyLevel] = useState('high'); // 'high' or 'low'

    const watchIdRef = useRef(null);
    const lastUpdateTimeRef = useRef(0);
    const lastReportedLocRef = useRef(null);
    const hasInitializedRef = useRef(false);
    const isOnlineRef = useRef(isOnline);

    const mutation = useMutation({
        mutationFn: (data) => updateWorkerLocation(data),
        onError: (err) => {
            console.warn('Silent location update failure:', err.message);
        }
    });

    // Sync ref for callback stability
    useEffect(() => {
        isOnlineRef.current = isOnline;
    }, [isOnline]);

    // Persistence
    useEffect(() => {
        if (!isWorker || typeof window === 'undefined') return;
        window.localStorage.setItem(ONLINE_STATE_KEY, isOnline ? '1' : '0');
    }, [isOnline, isWorker]);

    useEffect(() => {
        if (currentLocation) {
            window.localStorage.setItem(LAST_LOCATION_KEY, JSON.stringify(currentLocation));
        }
    }, [currentLocation]);

    const reportLocation = useCallback((coords, force = false) => {
        const now = Date.now();
        const online = isOnlineRef.current;

        const distMoved = getDistance(lastReportedLocRef.current, coords);
        const timeSinceLast = now - lastUpdateTimeRef.current;

        if (force || distMoved > MIN_DIST_METERS || timeSinceLast > MAX_IDLE_TIME) {
            mutation.mutate({
                latitude: coords.latitude,
                longitude: coords.longitude,
                isOnline: online
            });
            lastUpdateTimeRef.current = now;
            lastReportedLocRef.current = { ...coords };
        }
    }, [mutation]);

    const stopWatching = useCallback(() => {
        if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
    }, []);

    const startWatching = useCallback(function watcher(preferHighAccuracy = true) {
        if (typeof window === 'undefined' || !navigator.geolocation) return;

        stopWatching();

        const options = preferHighAccuracy ? GEOLOCATION_OPTIONS.high : GEOLOCATION_OPTIONS.low;

        watchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => {
                setHasPermission(true);
                const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
                setCurrentLocation(loc);

                if (isOnlineRef.current) {
                    reportLocation(loc);
                }
            },
            (error) => {
                console.warn(`Geolocation (${preferHighAccuracy ? 'High' : 'Low'} Accuracy) Error:`, error.message);

                if (error.code === error.PERMISSION_DENIED) {
                    setHasPermission(false);
                    toast.error('Permission Denied: Please enable location to stay online.');
                }
                else if (error.code === error.TIMEOUT && preferHighAccuracy) {
                    console.log('High accuracy timed out, falling back to lower accuracy system...');
                    setAccuracyLevel('low');
                    watcher(false);
                }
                else if (error.code === error.POSITION_UNAVAILABLE) {
                    console.log('Position unavailable, system will retry automatically.');
                }
            },
            options
        );
    }, [reportLocation, stopWatching]);

    const toggleOnline = useCallback(() => {
        setIsOnline(prev => {
            const nextState = !prev;
            if (nextState) {
                toast.success("You're now ONLINE and visible for jobs");
                startWatching(true);
                if (currentLocation) {
                    reportLocation(currentLocation, true);
                }
            } else {
                toast.info("You're now OFFLINE");
                if (currentLocation) {
                    reportLocation(currentLocation, true);
                }
                stopWatching();
            }
            return nextState;
        });
    }, [currentLocation, reportLocation, startWatching, stopWatching]);

    // Initialize tracking
    useEffect(() => {
        if (isWorker && !hasInitializedRef.current) {
            hasInitializedRef.current = true;
            startWatching(true);
        }

        return () => {
            stopWatching();
            hasInitializedRef.current = false;
        };
    }, [isWorker, startWatching, stopWatching]);

    return {
        isOnline,
        setIsOnline,
        currentLocation,
        hasPermission,
        toggleOnline,
        accuracyLevel,
        retryLocation: () => startWatching(true),
        isUpdating: mutation.isPending
    };
}

export function useLiveWorkerLocation(workerProfileId) {
    const [location, setLocation] = useState(null);

    useEffect(() => {
        if (!workerProfileId) return;
        const socket = io(SOCKET_BASE_URL, {
            withCredentials: true,
        });
        socket.emit('joinRoom', `worker_tracking:${workerProfileId}`);
        socket.on('worker:location_updated', (data) => {
            if (data.workerProfileId === workerProfileId) {
                setLocation({
                    latitude: data.latitude,
                    longitude: data.longitude,
                    isOnline: data.isOnline,
                    lastUpdated: data.lastUpdated,
                });
            }
        });
        return () => {
            socket.disconnect();
        };
    }, [workerProfileId]);

    return location;
}
