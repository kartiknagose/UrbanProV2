import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react';
import { Card } from '../../../components/common';
import { BookingReportCard } from '../../../components/features/safety/BookingReportCard';

export function WorkerContactSidebar({ booking }) {
    const { t } = useTranslation();

    return (
        <Card className="border-none ring-1 ring-black/5 dark:ring-white/10 shadow-sm overflow-hidden sticky top-8">
            <div className="p-4 border-b bg-gray-50 border-gray-100 dark:bg-dark-900/50 dark:border-dark-700">
                <h3 className="text-xs font-black uppercase tracking-wider text-gray-500 text-center flex items-center justify-center gap-2">
                    <ShieldCheck size={12} /> {t('Trust & Safety')}
                </h3>
            </div>
            <div className="p-4">
                <BookingReportCard
                    booking={booking}
                    reporterRole="WORKER"
                    className="p-0"
                />
            </div>
        </Card>
    );
}
