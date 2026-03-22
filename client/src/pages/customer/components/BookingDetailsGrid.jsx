import { Calendar, MapPin, Clock, Info, ExternalLink } from 'lucide-react';
import { Card, Button } from '../../../components/common';
import { MiniMap } from '../../../components/features/location/MiniMap';

export function BookingDetailsGrid({ booking, onOpenMaps }) {
    const latitude = Number(booking.latitude);
    const longitude = Number(booking.longitude);
    const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);

    const formatScheduledDate = (value) => {
        if (!value) return 'N/A';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString([], { dateStyle: 'full' });
    };

    const formatScheduledTime = (value) => {
        if (!value) return 'N/A';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-4 border-none ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-lg">
                            <Calendar size={18} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-gray-400 tracking-[0.1em] mb-1">Scheduled Date</p>
                            <p className="text-sm font-black">{formatScheduledDate(booking.scheduledAt || booking.scheduledDate)}</p>
                            <p className="text-[11px] text-gray-500 font-medium">Professional will arrive in this window.</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-5 border-none ring-1 ring-black/5 dark:ring-white/10 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-4">
                        <div className="p-2.5 bg-purple-50 dark:bg-purple-900/20 text-purple-500 rounded-xl">
                            <Clock size={20} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-gray-400 tracking-[0.1em] mb-1">Arrival Time</p>
                            <p className="text-sm font-black">{formatScheduledTime(booking.scheduledAt || booking.scheduledDate)}</p>
                            <p className="text-[11px] text-gray-500 font-medium">Approximate start time.</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-5 border-none ring-1 ring-black/5 dark:ring-white/10 shadow-sm md:col-span-2">
                    <div className="flex items-start gap-4">
                        <div className="p-2.5 bg-green-50 dark:bg-green-900/20 text-green-500 rounded-xl">
                            <MapPin size={20} />
                        </div>
                        <div className="flex-1">
                            <p className="text-[10px] font-black uppercase text-gray-400 tracking-[0.1em] mb-1">Service Destination</p>
                            <p className="text-sm font-black leading-snug">{booking.addressDetails || booking.address}</p>
                            {booking.landmark && (
                                <div className="flex items-center gap-1.5 mt-1">
                                    <div className="w-1 h-1 rounded-full bg-gray-300" />
                                    <p className="text-[11px] text-gray-500 font-medium">Near {booking.landmark}</p>
                                </div>
                            )}
                            <Button
                                variant="link"
                                size="sm"
                                className="p-0 h-auto text-2xs text-brand-500 font-bold flex items-center gap-1 mt-1"
                                onClick={onOpenMaps}
                            >
                                Open in Google Maps <ExternalLink size={10} />
                            </Button>
                        </div>
                    </div>
                    {hasCoordinates && (
                        <div className="mt-4">
                            <MiniMap lat={latitude} lng={longitude} height="180px" />
                        </div>
                    )}
                </Card>
            </div>

            {booking.notes && (
                <div className="p-5 rounded-2xl border-l-4 border-brand-500 bg-brand-50/50 dark:bg-brand-500/5">
                    <div className="flex items-center gap-2 mb-2">
                        <Info size={16} className="text-brand-500" />
                        <p className="text-2xs font-black uppercase tracking-widest text-brand-600">Your Instructions</p>
                    </div>
                    <p className="text-sm italic font-medium leading-relaxed text-gray-600 dark:text-gray-400">"{booking.notes}"</p>
                </div>
            )}
        </>
    );
}
