import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, Clock, Circle, Settings } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '../../../api';
import { queryKeys } from '../../../utils/queryKeys';
import { asArray } from '../../../utils/safeData';

export function NotificationDropdown() {
    const { isAuthenticated, user } = useAuth();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const queryClient = useQueryClient();

    const { data, refetch } = useQuery({
        queryKey: queryKeys.notifications.all(),
        queryFn: getNotifications,
        enabled: isAuthenticated,
        refetchInterval: 60000, // Poll every minute as fallback
        refetchIntervalInBackground: false,
    });

    const notifications = asArray(data?.notifications);
    const unreadCount = data?.unreadCount || 0;

    const readMutation = useMutation({
        mutationFn: markNotificationAsRead,
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.notifications.all() });
            const previous = queryClient.getQueryData(queryKeys.notifications.all());

            queryClient.setQueryData(queryKeys.notifications.all(), (current) => {
                if (!current) return current;

                const notifications = asArray(current.notifications).map((n) =>
                    n.id === id ? { ...n, read: true } : n
                );

                const unreadCount = notifications.filter((n) => !n.read).length;
                return { ...current, notifications, unreadCount };
            });

            return { previous };
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() }),
        onError: (_error, _id, context) => {
            if (context?.previous) {
                queryClient.setQueryData(queryKeys.notifications.all(), context.previous);
            }
        },
    });

    const readAllMutation = useMutation({
        mutationFn: markAllNotificationsAsRead,
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey: queryKeys.notifications.all() });
            const previous = queryClient.getQueryData(queryKeys.notifications.all());

            queryClient.setQueryData(queryKeys.notifications.all(), (current) => {
                if (!current) return current;
                const notifications = asArray(current.notifications).map((n) => ({ ...n, read: true }));
                return { ...current, notifications, unreadCount: 0 };
            });

            return { previous };
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() }),
        onError: (_error, _vars, context) => {
            if (context?.previous) {
                queryClient.setQueryData(queryKeys.notifications.all(), context.previous);
            }
        },
    });

    const handleNotificationClick = (n) => {
        if (!n.read) readMutation.mutate(n.id);
        setIsOpen(false);

        // Handle navigation based on type
        if (n.type === 'CHAT_MESSAGE' && n.data?.bookingId) {
            const path = user?.role === 'CUSTOMER'
                ? `/customer/bookings/${n.data.bookingId}`
                : `/worker/bookings/${n.data.bookingId}`;
            navigate(path);
        } else if (n.type === 'BOOKING_UPDATE' && n.data?.bookingId) {
            const path = user?.role === 'CUSTOMER'
                ? `/customer/bookings/${n.data.bookingId}`
                : `/worker/bookings/${n.data.bookingId}`;
            navigate(path);
        }
    };

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Socket listener for real-time notifications
    useEffect(() => {
        if (!isAuthenticated) return;

        const handleNewNotification = () => {
            refetch();
            // Optional: play sound
        };

        window.addEventListener('upro:notification-received', handleNewNotification);
        return () => window.removeEventListener('upro:notification-received', handleNewNotification);
    }, [isAuthenticated, refetch]);

    const formatNotificationTime = (value) => {
        if (!value) return 'N/A';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    if (!isAuthenticated) return null;

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 rounded-lg transition-all relative text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-dark-800"
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-error-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-inherit">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <Motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-80 md:w-96 rounded-2xl shadow-2xl z-50 overflow-hidden border bg-white border-gray-200 dark:bg-dark-900 dark:border-dark-700"
                    >
                        {/* Header */}
                        <div className="px-5 py-4 border-b flex items-center justify-between bg-gray-50 border-gray-100 dark:bg-dark-800/10 dark:border-dark-700">
                            <h3 className="font-bold text-sm">Notifications</h3>
                            {unreadCount > 0 && (
                                <button
                                    onClick={() => readAllMutation.mutate()}
                                    className="text-xs font-bold text-brand-500 hover:underline flex items-center gap-1"
                                >
                                    <Check size={14} /> Mark all as read
                                </button>
                            )}
                        </div>

                        {/* List */}
                        <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                            {notifications.length === 0 ? (
                                <div className="p-10 text-center">
                                    <Bell size={32} className="mx-auto text-gray-300 mb-3 opacity-20" />
                                    <p className="text-gray-400 text-sm italic">No new notifications</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-inherit">
                                    {notifications.map((n) => (
                                        <div
                                            key={n.id}
                                            onClick={() => handleNotificationClick(n)}
                                            className={`p-4 transition-colors cursor-pointer group relative ${!n.read
                                                ? 'bg-brand-50 hover:bg-brand-100/50 dark:bg-brand-500/5 dark:hover:bg-brand-500/10'
                                                : 'hover:bg-gray-50 dark:hover:bg-dark-800'
                                                }`}
                                        >
                                            {!n.read && (
                                                <div className="absolute left-2 top-1/2 -translate-y-1/2">
                                                    <Circle size={8} className="fill-brand-500 text-brand-500" />
                                                </div>
                                            )}
                                            <div className="pl-3">
                                                <p className="text-sm font-bold text-gray-900 dark:text-white">{n.title}</p>
                                                <p className="text-xs mt-1 leading-relaxed text-gray-600 dark:text-gray-400">{n.message}</p>
                                                <div className="flex items-center gap-2 mt-2 text-[10px] uppercase font-black tracking-wider text-gray-400">
                                                    <Clock size={10} />
                                                    {formatNotificationTime(n.createdAt)}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-5 py-3 border-t border-gray-100 dark:border-dark-700 bg-gray-50 dark:bg-dark-800/10">
                            <button
                                onClick={() => { setIsOpen(false); navigate('/notifications/preferences'); }}
                                className="flex items-center gap-2 text-xs font-medium text-gray-500 hover:text-brand-500 dark:text-gray-400 dark:hover:text-brand-400 transition-colors w-full"
                            >
                                <Settings size={14} />
                                Notification Preferences
                            </button>
                        </div>
                    </Motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
