import { useTranslation } from 'react-i18next';
import { Calendar, MapPin, Clock, ExternalLink } from 'lucide-react';
import { Card, Button, Badge } from '../../../components/common';
import { MiniMap } from '../../../components/features/location/MiniMap';

const formatInrAmount = (value) => {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return '0';
    return amount.toLocaleString('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    });
};

export function BookingAssignmentDetails({ booking, onOpenMaps }) {
    const { t, i18n } = useTranslation();
    const latitude = Number(booking.latitude);
    const longitude = Number(booking.longitude);
    const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);

    const formatScheduledDate = (value) => {
        if (!value) return 'N/A';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString(i18n.language, { weekday: 'short', month: 'short', day: 'numeric' });
    };

    const formatScheduledTime = (value) => {
        if (!value) return 'N/A';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' });
    };
    return (
        <Card className="overflow-hidden border-none ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
            <div className="p-4 sm:p-5 space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1.1fr]">
                    <div className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/70 p-3 dark:border-dark-700 dark:bg-dark-900/40">
                        <div className="p-2 rounded-lg shrink-0 bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400">
                            <Calendar size={18} />
                        </div>
                        <div>
                            <span className="block text-2xs font-black text-gray-400 uppercase tracking-widest mb-0.5">{t('Appointment')}</span>
                            <div className="text-sm font-bold text-gray-900 dark:text-white">
                                {formatScheduledDate(booking.scheduledAt || booking.scheduledDate)}
                            </div>
                            <div className="flex items-center gap-1 text-2xs font-bold text-blue-500">
                                <Clock size={12} />
                                {formatScheduledTime(booking.scheduledAt || booking.scheduledDate)}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/70 p-3 dark:border-dark-700 dark:bg-dark-900/40">
                        <div className="p-2 rounded-lg shrink-0 bg-success-50 text-success-600 dark:bg-success-900/20 dark:text-success-400">
                            <MapPin size={18} />
                        </div>
                        <div className="min-w-0">
                            <span className="block text-2xs font-black text-gray-400 uppercase tracking-widest mb-0.5">{t('Location')}</span>
                            <span className="text-sm font-bold block truncate text-gray-900 dark:text-gray-100">
                                {booking.address || booking.addressDetails}
                            </span>
                            <Button
                                variant="link"
                                size="sm"
                                className="p-0 h-auto text-2xs text-brand-500 font-bold flex items-center gap-1"
                                onClick={onOpenMaps}
                            >
                                {t('Open Maps')} <ExternalLink size={10} />
                            </Button>
                        </div>
                    </div>
                    <div className="md:col-span-2 xl:col-span-1 rounded-xl border border-gray-100 bg-gray-50/70 p-3 dark:border-dark-700 dark:bg-dark-900/40">
                        <span className="block text-2xs font-black text-gray-400 uppercase tracking-widest mb-0.5">{t('Estimated Payout')}</span>
                        <div className="text-2xl font-black text-gray-900 dark:text-white">
                            ₹{formatInrAmount(booking.totalPrice ?? booking.estimatedPrice ?? booking.service?.basePrice ?? 0)}
                        </div>
                        <Badge variant="outline" className="mt-2 text-micro font-black uppercase bg-success-50 text-success-700 border-success-200">{t('Guaranteed')}</Badge>
                    </div>
                    {hasCoordinates && (
                        <div className="md:col-span-2 xl:col-span-3">
                            <MiniMap lat={latitude} lng={longitude} height="180px" />
                        </div>
                    )}
                </div>

                {booking.notes && (
                    <div className="p-3.5 rounded-xl border-l-4 border-l-brand-500 bg-gray-50 border-gray-100 dark:bg-dark-900/50 dark:border-dark-700">
                        <span className="block text-2xs font-black text-gray-400 uppercase tracking-widest mb-1 pointer-events-none opacity-50">{t('Customer Notes')}</span>
                        <p className="text-sm font-medium italic text-gray-600 dark:text-gray-300">
                            &ldquo;{booking.notes}&rdquo;
                        </p>
                    </div>
                )}
            </div>
        </Card>
    );
}
