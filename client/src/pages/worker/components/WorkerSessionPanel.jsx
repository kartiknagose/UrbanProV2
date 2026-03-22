import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, Play, Square, KeyRound, FileText } from 'lucide-react';
import { Card, Button, Input, Badge } from '../../../components/common';
import {
    getBookingSessions,
    createSession,
    startSession as startSessionApi,
    endSession as endSessionApi,
} from '../../../api/bookings';
import { queryKeys } from '../../../utils/queryKeys';
import { toast } from 'sonner';

const formatSessionTime = (value, locale) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
};

const formatSessionDate = (value, locale) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Date not set';
    return date.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' });
};

/**
 * Worker-only panel for managing multi-day booking sessions.
 * Allows: scheduling next visit, starting (OTP), and ending sessions.
 */
export function WorkerSessionPanel({ bookingId, bookingStatus }) {
    const { t, i18n } = useTranslation();
    const queryClient = useQueryClient();
    const [showSchedule, setShowSchedule] = useState(false);
    const [nextDate, setNextDate] = useState('');
    const [notes, setNotes] = useState('');
    const [otpInput, setOtpInput] = useState('');


    const { data } = useQuery({
        queryKey: queryKeys.bookings.sessions(bookingId),
        queryFn: () => getBookingSessions(bookingId),
        enabled: !!bookingId,
    });

    const sessions = data?.sessions || [];
    const activeSession = sessions.find(s => s.isActive);
    const pendingSession = sessions.find(s => !s.startTime && !s.isActive);

    const invalidateAll = () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.bookings.sessions(bookingId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.bookings.detail(bookingId) });
    };

    const createMutation = useMutation({
        mutationFn: (data) => createSession(bookingId, data),
        onSuccess: (res) => {
            toast.success(res.message || t('Next visit scheduled'));
            setShowSchedule(false);
            setNextDate('');
            setNotes('');
            invalidateAll();
        },
        onError: (err) => toast.error(err.response?.data?.error || t('Failed to schedule visit')),
    });

    const startMutation = useMutation({
        mutationFn: ({ sessionId, otp }) => startSessionApi(bookingId, sessionId, otp),
        onSuccess: () => {
            toast.success(t('Session started!'));
            setOtpInput('');
            invalidateAll();
        },
        onError: (err) => toast.error(err.response?.data?.error || t('Failed to start session')),
    });

    const endMutation = useMutation({
        mutationFn: ({ sessionId, data }) => endSessionApi(bookingId, sessionId, data),
        onSuccess: () => {
            toast.success(t('Session ended'));
            invalidateAll();
        },
        onError: (err) => toast.error(err.response?.data?.error || t('Failed to end session')),
    });

    // Only show for IN_PROGRESS bookings
    if (bookingStatus !== 'IN_PROGRESS') return null;

    return (
        <Card className="border-none ring-1 ring-black/5 dark:ring-white/10 shadow-sm overflow-hidden">
            <div className="p-4 md:p-5 border-b border-gray-100 dark:border-dark-700">
                <h3 className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <CalendarPlus size={14} className="text-brand-500" />
                    {t('Session Management')}
                </h3>
            </div>

            <div className="p-4 md:p-5 space-y-4">
                {/* Active Session Controls */}
                {activeSession && (
                    <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/20 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-xs font-black text-green-700 dark:text-green-400">
                                    {t('Session Active')}
                                </span>
                            </div>
                            <span className="text-2xs text-gray-500 font-bold">
                                {t('Since')} {formatSessionTime(activeSession.startTime, i18n.language)}
                            </span>
                        </div>
                        <Button
                            fullWidth
                            size="sm"
                            icon={Square}
                            onClick={() => endMutation.mutate({ sessionId: activeSession.id, data: {} })}
                            loading={endMutation.isPending}
                            className="bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold h-10"
                        >
                            {t('End Session')}
                        </Button>
                    </div>
                )}

                {/* Pending Session — needs OTP to start */}
                {!activeSession && pendingSession && (
                    <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-amber-700 dark:text-amber-400">
                                {t('Visit scheduled')} — {formatSessionDate(pendingSession.sessionDate, i18n.language)}
                            </span>
                        </div>
                        <p className="text-xs text-gray-500">{t('Enter the OTP from the customer to begin this session.')}</p>
                        <div className="space-y-2">
                            <Input
                                type="text"
                                inputMode="numeric"
                                maxLength={4}
                                placeholder={t("Enter 4-digit OTP")}
                                value={otpInput}
                                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                size="compact"
                                className="w-full"
                                inputClassName="text-center text-base font-black tracking-[0.22em]"
                            />
                            <Button
                                icon={Play}
                                onClick={() => startMutation.mutate({ sessionId: pendingSession.id, otp: otpInput })}
                                loading={startMutation.isPending}
                                disabled={otpInput.length !== 4}
                                fullWidth
                                className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold h-10"
                            >
                                {t('Start')}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Schedule next visit */}
                {!activeSession && !pendingSession && !showSchedule && (
                    <Button
                        fullWidth
                        variant="outline"
                        icon={CalendarPlus}
                        onClick={() => setShowSchedule(true)}
                        className="rounded-xl font-bold h-10"
                    >
                        {t('Schedule Next Visit')}
                    </Button>
                )}

                {showSchedule && (
                    <div className="space-y-3 p-3 rounded-xl border border-dashed border-brand-200 dark:border-brand-800/40 bg-brand-50/30 dark:bg-brand-900/5">
                        <label className="text-2xs font-black uppercase tracking-widest text-gray-400">
                            {t('Next Visit Date')}
                        </label>
                        <Input
                            type="date"
                            value={nextDate}
                            onChange={(e) => setNextDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                            className="font-bold"
                        />
                        <div>
                            <label className="text-2xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-1 mb-1">
                                <FileText size={10} /> {t('Notes (optional)')}
                            </label>
                            <Input
                                type="text"
                                placeholder={t("e.g., Bring additional materials")}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button
                                fullWidth
                                size="sm"
                                onClick={() => createMutation.mutate({ sessionDate: nextDate, notes: notes || undefined })}
                                loading={createMutation.isPending}
                                disabled={!nextDate}
                                className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold h-10"
                            >
                                {t('Schedule')}
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setShowSchedule(false); setNextDate(''); setNotes(''); }}
                                className="rounded-xl font-bold h-10 px-4"
                            >
                                {t('Cancel')}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Summary */}
                {sessions.length > 0 && (
                    <div className="flex items-center justify-between text-2xs text-gray-400 font-bold pt-1 border-t border-gray-100 dark:border-dark-700">
                        <span>{sessions.filter(s => s.endTime).length} {t('completed')}</span>
                        <span>{sessions.length} {sessions.length === 1 ? t('total session') : t('total sessions')}</span>
                    </div>
                )}
            </div>
        </Card>
    );
}
