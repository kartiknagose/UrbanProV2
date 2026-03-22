/**
 * AdminSOSAlertsPage — Real-time Admin SOS Alert Dashboard
 *
 * Admins see all active SOS alerts here in real-time via Socket.IO.
 * They can acknowledge and resolve alerts.
 * Route: /admin/sos-alerts
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    ShieldAlert, MapPin, Phone, CheckCircle, Clock, XCircle,
    User, ExternalLink, Siren, RefreshCw, AlertTriangle
} from 'lucide-react';
import { MainLayout } from '../../components/layout/MainLayout';
import { Card, CardHeader, CardTitle, Button, Badge, PageHeader, AsyncState } from '../../components/common';
import { useSocketEvent } from '../../hooks/useSocket';
import { getActiveSosAlerts, updateSosAlertStatus } from '../../api/safety';
import { getPageLayout } from '../../constants/layout';
import { queryKeys } from '../../utils/queryKeys';
import { toast } from 'sonner';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { usePageTitle } from '../../hooks/usePageTitle';

const STATUS_COLORS = {
    ACTIVE: { badge: 'error', icon: AlertTriangle, label: 'Active Emergency', pulse: true },
    ACKNOWLEDGED: { badge: 'warning', icon: Clock, label: 'Acknowledged', pulse: false },
    RESOLVED: { badge: 'success', icon: CheckCircle, label: 'Resolved', pulse: false },
};

function AlertCard({ alert, onAcknowledge, onResolve, isUpdating }) {
    const cfg = STATUS_COLORS[alert.status] || STATUS_COLORS.ACTIVE;
    const StatusIcon = cfg.icon;

    const formatAlertTime = (value) => {
        if (!value) return 'N/A';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleString();
    };

    const triggeredUser = alert.booking?.customer?.id === alert.triggeredBy
        ? alert.booking?.customer
        : alert.booking?.workerProfile?.user;

    const role = alert.booking?.customer?.id === alert.triggeredBy ? 'Customer' : 'Worker';

    const latitude = Number(alert.latitude);
    const longitude = Number(alert.longitude);
    const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);
    const mapsUrl = hasCoordinates ? `https://maps.google.com/?q=${latitude},${longitude}` : null;

    return (
        <Motion.div
            layout
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`relative rounded-2xl border overflow-hidden transition-all
                        ${alert.status === 'ACTIVE'
                    ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20'
                    : alert.status === 'ACKNOWLEDGED'
                        ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/20'
                        : 'border-gray-200 bg-white dark:border-dark-700 dark:bg-dark-800'
                }`}
        >
            {/* Left accent stripe */}
            <div className={`absolute left-0 top-0 bottom-0 w-1
                            ${alert.status === 'ACTIVE' ? 'bg-red-500' : alert.status === 'ACKNOWLEDGED' ? 'bg-yellow-400' : 'bg-green-500'}`}
            />

            <div className="p-5 pl-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex items-start gap-4">
                        {/* Icon */}
                        <div className={`relative w-12 h-12 rounded-xl flex items-center justify-center shrink-0
                                        ${alert.status === 'ACTIVE'
                                ? 'bg-red-600'
                                : alert.status === 'ACKNOWLEDGED'
                                    ? 'bg-yellow-500'
                                    : 'bg-gray-200 dark:bg-dark-700'
                            }`}>
                            {cfg.pulse && (
                                <span className="absolute inset-0 rounded-xl bg-red-500 animate-ping opacity-40" />
                            )}
                            <StatusIcon size={22} className="text-white relative z-10" />
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                <h3 className="font-black text-lg text-gray-900 dark:text-white">
                                    SOS Alert #{alert.id}
                                </h3>
                                <Badge variant={cfg.badge} className="uppercase text-2xs font-black">
                                    {cfg.label}
                                </Badge>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mt-2">
                                <div className="flex items-center gap-2 text-sm">
                                    <User size={13} className="text-gray-400 dark:text-gray-500" />
                                    <span className="font-medium text-gray-700 dark:text-gray-300">
                                        {triggeredUser?.name || 'Unknown'} ({role})
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <ShieldAlert size={13} className="text-gray-400 dark:text-gray-500" />
                                    <span className="text-gray-600 dark:text-gray-400">
                                        Booking #{alert.bookingId} — {alert.booking?.service?.name || 'Unknown Service'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <Clock size={13} className="text-gray-400 dark:text-gray-500" />
                                    <span className="text-gray-600 dark:text-gray-400">
                                        {formatAlertTime(alert.createdAt)}
                                    </span>
                                </div>
                                {mapsUrl && (
                                    <a
                                        href={mapsUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 text-sm text-brand-500 hover:text-brand-400 font-medium group"
                                    >
                                        <MapPin size={13} />
                                        View on Google Maps
                                        <ExternalLink size={10} className="group-hover:translate-x-0.5 transition-transform" />
                                    </a>
                                )}
                                {!mapsUrl && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <MapPin size={13} className="text-gray-400" />
                                        <span className="text-gray-400 italic">Location not shared</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 shrink-0">
                        {alert.status === 'ACTIVE' && (
                            <Button
                                size="sm"
                                icon={Clock}
                                loading={isUpdating}
                                onClick={() => onAcknowledge(alert.id)}
                                className="bg-yellow-500 text-white hover:bg-yellow-600"
                            >
                                Acknowledge
                            </Button>
                        )}
                        {(alert.status === 'ACTIVE' || alert.status === 'ACKNOWLEDGED') && (
                            <Button
                                size="sm"
                                icon={CheckCircle}
                                loading={isUpdating}
                                onClick={() => onResolve(alert.id)}
                                className="bg-green-600 text-white hover:bg-green-700"
                            >
                                Resolve
                            </Button>
                        )}
                        {alert.status === 'RESOLVED' && (
                            <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-500 dark:bg-dark-700 dark:text-gray-400">
                                Resolved ✓
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </Motion.div>
    );
}

export function AdminSOSAlertsPage() {
    usePageTitle('SOS Alerts');
    const queryClient = useQueryClient();
    const [filter, setFilter] = useState('ACTIVE');

    const { data, isLoading, isError, error, refetch } = useQuery({
        queryKey: queryKeys.safety.sosAlerts(),
        queryFn: getActiveSosAlerts,
        refetchInterval: 30_000, // Fallback polling; socket handles real-time
        refetchIntervalInBackground: false,
    });

    const updateMutation = useMutation({
        mutationFn: ({ alertId, status }) => updateSosAlertStatus(alertId, status),
        onSuccess: (_, { alertId, status }) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.safety.sosAlerts() });
            toast.success(`Alert ${status === 'ACKNOWLEDGED' ? 'acknowledged' : 'resolved'}`, {
                id: `sos-alert-status:${alertId}:${status}`,
            });
        },
        onError: (err) => toast.error(err?.response?.data?.message || err?.response?.data?.error || 'Failed to update alert status'),
    });

    const handleSOSAlert = useCallback((payload) => {
        queryClient.invalidateQueries({ queryKey: queryKeys.safety.sosAlerts() });
        const alertId = payload?.alertId || payload?.id || payload?.bookingId || 'unknown';
        const triggeredBy = payload?.triggeredBy?.name || 'Unknown user';
        toast.error(`🚨 NEW SOS ALERT — Booking #${payload.bookingId} (${triggeredBy})`, {
            id: `sos-alert:${alertId}`,
            duration: 10000,
        });
    }, [queryClient]);

    const handleSOSUpdate = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.safety.sosAlerts() });
    }, [queryClient]);

    useSocketEvent('sos:alert', handleSOSAlert);
    useSocketEvent('sos:alert_updated', handleSOSUpdate);

    const allAlerts = data?.alerts || [];
    const filtered = filter === 'ALL' ? allAlerts : allAlerts.filter(a => a.status === filter);
    const activeCount = allAlerts.filter(a => a.status === 'ACTIVE').length;

    return (
        <MainLayout>
            <div className={getPageLayout('default')}>
                <PageHeader
                    title={
                        <span className="flex items-center gap-3">
                            SOS Alert Dashboard
                            {activeCount > 0 && (
                                <span className="relative flex h-4 w-4">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-4 w-4 bg-red-600 text-white text-[10px] items-center justify-center font-black">
                                        {activeCount}
                                    </span>
                                </span>
                            )}
                        </span>
                    }
                    subtitle="Real-time emergency alerts from active bookings. Respond immediately."
                    action={
                        <Button variant="outline" size="sm" icon={RefreshCw} onClick={() => refetch()}>
                            Refresh
                        </Button>
                    }
                />

                {/* Active emergency banner */}
                {activeCount > 0 && (
                    <Motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-6 flex items-center gap-4 p-4 rounded-2xl bg-red-600 text-white shadow-lg shadow-red-500/30"
                    >
                        <Siren size={24} className="animate-pulse shrink-0" />
                        <div>
                            <p className="font-black text-sm">
                                {activeCount} ACTIVE EMERGENCY {activeCount === 1 ? 'ALERT' : 'ALERTS'}
                            </p>
                            <p className="text-red-100 text-xs">
                                Immediate action required. Contact the user and coordinate assistance.
                            </p>
                        </div>
                    </Motion.div>
                )}

                {/* Filters */}
                <div className="flex gap-2 mb-6 flex-wrap">
                    {['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'ALL'].map((f) => (
                        <Button
                            key={f}
                            size="sm"
                            variant={filter === f ? 'primary' : 'outline'}
                            onClick={() => setFilter(f)}
                        >
                            {f}
                            {f === 'ACTIVE' && activeCount > 0 && (
                                <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 font-black">
                                    {activeCount}
                                </span>
                            )}
                        </Button>
                    ))}
                </div>

                <AsyncState
                    isLoading={isLoading}
                    isError={isError}
                    error={error}
                    isEmpty={!isLoading && !isError && filtered.length === 0}
                    emptyTitle={filter === 'ACTIVE' ? 'No active emergencies' : 'No alerts for this filter'}
                    emptyMessage={filter === 'ACTIVE'
                        ? '✅ All clear! No active SOS alerts at the moment.'
                        : 'Try a different filter to see more alerts.'}
                >
                    <AnimatePresence mode="popLayout">
                        <div className="space-y-4">
                            {filtered.map((alert) => (
                                <AlertCard
                                    key={alert.id}
                                    alert={alert}
                                    isUpdating={updateMutation.isPending && updateMutation.variables?.alertId === alert.id}
                                    onAcknowledge={(id) => updateMutation.mutate({ alertId: id, status: 'ACKNOWLEDGED' })}
                                    onResolve={(id) => updateMutation.mutate({ alertId: id, status: 'RESOLVED' })}
                                />
                            ))}
                        </div>
                    </AnimatePresence>
                </AsyncState>
            </div>
        </MainLayout>
    );
}
