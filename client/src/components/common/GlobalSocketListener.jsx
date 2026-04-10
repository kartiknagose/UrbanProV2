import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { toast } from 'sonner';
import { Activity, Zap, ShieldAlert } from 'lucide-react';
import { queryKeys } from '../../utils/queryKeys';
import { useSocketEvent } from '../../hooks/useSocket';

/**
 * GlobalSocketListener
 * 
 * A headless component that listens for global system events via Socket.io
 * and triggers UI actions (like forced logout on suspension).
 */
export const GlobalSocketListener = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const suspensionHandledRef = useRef(false);
    const suspensionTimerRef = useRef(null);

    useEffect(() => () => {
        if (suspensionTimerRef.current) {
            clearTimeout(suspensionTimerRef.current);
        }
    }, []);

    useSocketEvent('user:status_changed', (payload) => {
        if (!user?.id) return;
        if (payload?.userId && payload.userId !== user.id) return;

        if (payload.isActive === false) {
            if (suspensionHandledRef.current) return;
            suspensionHandledRef.current = true;

            toast.error('Your account has been suspended. Logging out...', {
                id: `account-suspended:${user.id}`,
                duration: 10000,
            });

            suspensionTimerRef.current = setTimeout(() => {
                logout();
                navigate('/login', { replace: true });
            }, 3000);
        }
    }, [user?.id, logout, navigate]);

    useSocketEvent('booking:status_updated', (booking) => {
        if (!user?.id) return;

        const bookingId = booking?.id || booking?.bookingId;
        const customerId = booking?.customerId || booking?.customer?.id;
        const workerUserId = booking?.workerUserId || booking?.workerProfile?.userId || booking?.workerProfile?.user?.id;
        const isCustomerEvent = user?.role === 'CUSTOMER' && String(customerId) === String(user.id);
        const isWorkerEvent = user?.role === 'WORKER' && String(workerUserId) === String(user.id);
        const isAdminEvent = user?.role === 'ADMIN';

        if (!isCustomerEvent && !isWorkerEvent && !isAdminEvent) return;

        if (isCustomerEvent) {
            queryClient.invalidateQueries({ queryKey: queryKeys.bookings.customer() });
            if (bookingId != null) {
                queryClient.invalidateQueries({ queryKey: queryKeys.bookings.detail(bookingId) });
            }
        }

        if (isWorkerEvent) {
            queryClient.invalidateQueries({ queryKey: queryKeys.bookings.worker() });
            queryClient.invalidateQueries({ queryKey: queryKeys.bookings.open() });
            if (bookingId != null) {
                queryClient.invalidateQueries({ queryKey: queryKeys.bookings.detail(bookingId) });
            }
        }

        if (isAdminEvent) {
            queryClient.invalidateQueries({ queryKey: queryKeys.bookings.admin() });
            queryClient.invalidateQueries({ queryKey: queryKeys.admin.dashboard() });
            queryClient.invalidateQueries({ queryKey: queryKeys.admin.bookingsPreview() });
        }

        if (isCustomerEvent) {
            const statusMessages = {
                CONFIRMED: `Professional ${booking.workerProfile?.user?.name || ''} has accepted your booking!`,
                IN_PROGRESS: 'Your service has started. Please share the completion OTP once finished.',
                COMPLETED: 'Your service is complete! Please rate your experience.',
                CANCELLED: 'Your booking was cancelled.'
            };
            if (statusMessages[booking.status]) {
                toast.info(statusMessages[booking.status], {
                    id: `booking-status:${bookingId}:${booking.status}`,
                    icon: <Activity className="text-brand-500" size={16} />,
                    action: {
                        label: 'Details',
                        onClick: () => navigate(`/customer/bookings/${bookingId}`)
                    }
                });
            }
        } else if (isWorkerEvent) {
            if (booking.status === 'CANCELLED') {
                toast.error('A customer cancelled their booking.', {
                    action: { label: 'View', onClick: () => navigate('/worker/dashboard') }
                });
            }
        }
    }, [user?.id, user?.role, navigate, queryClient]);

    useSocketEvent('booking:available', (payload) => {
        if (!user?.id || user.role !== 'WORKER') return;
        toast.info('New Job Opportunity!', {
            id: `booking-available:${payload?.bookingId || payload?.id || payload?.serviceName || 'new'}`,
            description: `${payload.serviceName} needed at ${payload.address}`,
            icon: <Zap className="text-orange-500" size={16} />,
            action: {
                label: 'View Job',
                onClick: () => navigate('/worker/dashboard')
            },
            duration: 10000
        });
        queryClient.invalidateQueries({ queryKey: queryKeys.bookings.open() });
    }, [user?.id, user?.role, navigate, queryClient]);

    useSocketEvent('sos:alert', (payload) => {
        if (!user?.id) return;
        toast.error('🚨 EMERGENCY SOS ALERT', {
            id: `sos-alert:${payload?.alertId || payload?.bookingId || 'unknown'}`,
            description: payload.message || `A safety alert has been triggered for Booking #${payload.bookingId}.`,
            duration: 30000,
            icon: <ShieldAlert className="text-white" size={20} />,
            style: { backgroundColor: '#be123c', color: 'white' },
            action: {
                label: 'View Details',
                onClick: () => navigate(
                    user.role === 'ADMIN'
                        ? '/admin/sos-alerts'
                        : `/customer/bookings/${payload.bookingId}`
                )
            }
        });
    }, [user?.id, user?.role, navigate]);

    useSocketEvent('notification:new', (notification) => {
        if (!user?.id) return;
        if (notification.priority === 'HIGH' || notification.type === 'BOOKING_UPDATE') {
            toast.info(notification.title, {
                id: `notif:${notification.id || `${notification.type}:${notification.title}`}`,
                description: notification.message,
                icon: <Activity className="text-brand-500" size={16} />,
                action: {
                    label: 'View',
                    onClick: () => {
                        if (notification.data?.bookingId) {
                            navigate(user?.role === 'CUSTOMER' ? `/customer/bookings/${notification.data.bookingId}` : `/worker/bookings/${notification.data.bookingId}`);
                        }
                    }
                }
            });
        }
    }, [user?.id, user?.role, navigate]);

    return null;
};
