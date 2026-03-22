import { useQuery } from '@tanstack/react-query';
import { Calendar, Clock, Play, Square, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, Badge } from '../../common';
import { getBookingSessions } from '../../../api/bookings';
import { queryKeys } from '../../../utils/queryKeys';

/**
 * Displays a timeline of all sessions for a multi-day booking.
 * Used on both customer and worker booking detail pages.
 */
export function BookingSessionsTimeline({ bookingId }) {
    const { data, isLoading } = useQuery({
        queryKey: queryKeys.bookings.sessions(bookingId),
        queryFn: () => getBookingSessions(bookingId),
        enabled: !!bookingId,
    });

    const sessions = data?.sessions;

    const toValidDate = (value) => {
        if (!value) return null;
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    };

    const formatSessionDate = (value) => {
        const date = toValidDate(value);
        return date ? date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : 'N/A';
    };

    const formatSessionTime = (value) => {
        const date = toValidDate(value);
        return date ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A';
    };

    const formatDurationMins = (start, end) => {
        const startDate = toValidDate(start);
        const endDate = toValidDate(end);
        if (!startDate || !endDate) return null;
        const durationMins = Math.round((endDate - startDate) / 60000);
        return Number.isFinite(durationMins) && durationMins >= 0 ? durationMins : null;
    };

    if (isLoading) {
        return (
            <Card className="p-5 border-none ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
                <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-gray-200 dark:bg-dark-700 rounded w-1/3" />
                    <div className="h-16 bg-gray-100 dark:bg-dark-800 rounded" />
                </div>
            </Card>
        );
    }

    if (!sessions || sessions.length === 0) return null;

    const activeSession = sessions.find(s => s.isActive);

    return (
        <Card className="border-none ring-1 ring-black/5 dark:ring-white/10 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-brand-50 dark:bg-brand-900/20 text-brand-500">
                        <Calendar size={16} />
                    </div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
                        Session History
                    </h3>
                </div>
                <Badge variant="outline" className="text-2xs font-black">
                    {sessions.length} session{sessions.length !== 1 ? 's' : ''}
                </Badge>
            </div>

            {activeSession && (
                <div className="px-4 py-3 bg-green-50 dark:bg-green-900/10 border-b border-green-100 dark:border-green-900/20 flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs font-black text-green-700 dark:text-green-400">
                        Session in progress since {formatSessionTime(activeSession.startTime)}
                    </span>
                </div>
            )}

            <div className="p-4 space-y-3">
                {sessions.map((session, idx) => (
                    <div
                        key={session.id}
                        className={`relative pl-8 pb-3 ${idx < sessions.length - 1 ? 'border-b border-gray-100 dark:border-dark-700/50' : ''}`}
                    >
                        {/* Timeline dot */}
                        <div className="absolute left-0 top-1">
                            {session.isActive ? (
                                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white shadow-md shadow-green-500/30">
                                    <Play size={12} fill="currentColor" />
                                </div>
                            ) : session.endTime ? (
                                <div className="w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center text-white">
                                    <CheckCircle size={12} />
                                </div>
                            ) : session.startTime ? (
                                <div className="w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center text-white">
                                    <AlertCircle size={12} />
                                </div>
                            ) : (
                                <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-dark-600 flex items-center justify-center text-gray-400">
                                    <Clock size={12} />
                                </div>
                            )}
                        </div>

                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-black text-gray-800 dark:text-gray-200">
                                    Visit {idx + 1}
                                </span>
                                <span className="text-2xs font-bold text-gray-400">
                                    {formatSessionDate(session.sessionDate)}
                                </span>
                                {session.isActive && (
                                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-2xs font-black">
                                        Active
                                    </Badge>
                                )}
                                {!session.isActive && session.endTime && (
                                    <Badge variant="outline" className="text-2xs font-black text-gray-400">
                                        Done
                                    </Badge>
                                )}
                            </div>

                            <div className="flex items-center gap-3 text-2xs text-gray-500 font-medium">
                                {session.startTime && (
                                    <span className="flex items-center gap-1">
                                        <Play size={10} /> {formatSessionTime(session.startTime)}
                                    </span>
                                )}
                                {session.endTime && (
                                    <span className="flex items-center gap-1">
                                        <Square size={10} /> {formatSessionTime(session.endTime)}
                                    </span>
                                )}
                                {session.startTime && session.endTime && formatDurationMins(session.startTime, session.endTime) !== null && (
                                    <span className="text-brand-500 font-bold">
                                        {formatDurationMins(session.startTime, session.endTime)} min
                                    </span>
                                )}
                            </div>

                            {session.notes && (
                                <p className="text-2xs text-gray-400 italic mt-1">{session.notes}</p>
                            )}

                            {!session.isActive && !session.startTime && session.startOtp && (
                                <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-2xs font-black">
                                    OTP: {session.startOtp}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    );
}
