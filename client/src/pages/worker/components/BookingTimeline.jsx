import { useTranslation } from 'react-i18next';
import { CheckCircle, AlertCircle } from 'lucide-react';

const STATUSES = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'];

export function BookingTimeline({ booking }) {
    const { t } = useTranslation();
    return (
        <div className="rounded-2xl border bg-white p-4 shadow-sm border-gray-100 dark:bg-dark-800/40 dark:border-dark-700">
            <div className="flex flex-col gap-3">
                {booking.status === 'CANCELLED' && booking.cancellationReason && (
                    <div className="flex items-start gap-3 rounded-xl border bg-error-50 p-3 border-error-100 dark:bg-error-950/20 dark:border-error-900/40">
                        <AlertCircle size={20} className="text-error-500 shrink-0 mt-1" />
                        <div className="space-y-1">
                            <p className="text-2xs font-black uppercase tracking-widest text-error-600/70 dark:text-error-400/70">
                                {t('Cancellation Reason')}
                            </p>
                            <p className="text-sm font-bold leading-relaxed text-error-800 dark:text-error-300">
                                {booking.cancellationReason}
                            </p>
                        </div>
                    </div>
                )}
                <div className="relative mx-auto flex max-w-xl items-center justify-between px-1 sm:px-2">
                    <div className="absolute top-1/2 left-0 w-full h-[1px] -translate-y-1/2 z-0 bg-gray-100 dark:bg-dark-700"></div>

                    {STATUSES.map((s, i) => {
                        const isPassed = STATUSES.indexOf(booking.status) >= i;
                        const isActive = booking.status === s;

                        return (
                            <div key={s} className="flex flex-col items-center z-10">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-all duration-500 ${isPassed
                                    ? 'bg-brand-600 border-brand-400 text-white shadow-md shadow-brand-500/20'
                                    : 'bg-white border-gray-200 text-gray-300 dark:bg-dark-900 dark:border-dark-700 dark:text-dark-500'
                                    } ${isActive ? 'ring-4 ring-brand-500/10 scale-110' : ''}`}>
                                            {isPassed ? <CheckCircle size={14} /> : <div className="w-1 h-1 rounded-full bg-current" />}
                                </div>
                                        <span className={`mt-2 text-[10px] font-black uppercase tracking-tight ${isPassed ? 'text-brand-500' : 'text-gray-400'}`}>
                                    {t(s)}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
