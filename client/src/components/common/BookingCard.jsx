import { useMemo, memo } from 'react';
import {
    Calendar, MapPin, CheckCircle,
    XCircle, PlayCircle, Phone, Mail,
    ArrowRight, User, IndianRupee, CreditCard, MessageSquare, Download,
    RotateCcw, Repeat
} from 'lucide-react';
import { Button } from '../ui/Button';
import { BookingStatusBadge, WorkerTierBadge } from './StatusBadges';
import { Card } from '../ui/Card';
import { useNavigate } from 'react-router-dom';
import { QuickReview } from './QuickReview';
import { useAuth } from '../../hooks/useAuth';
import { ChatToggle } from '../features/chat/ChatWindow';
import { useTranslation } from 'react-i18next';

/**
 * BookingCard Component
 *
 * A unified, compact card for all booking states across
 * Customer and Worker roles.
 * Supports interactive status changes, OTP deep-links,
 * inline contact actions, and reviews.
 */
export const BookingCard = memo(function BookingCard({
    booking,
    role = 'CUSTOMER',
    onAction = () => { },
    isActionLoading = false,
    activeActionId = null
}) {
    const { t, i18n } = useTranslation();
    const { user } = useAuth();
    const navigate = useNavigate();

    const handleAction = (e, type, data = {}) => {
        e.stopPropagation();
        onAction(type, { id: booking.id, ...data });
    };

    const formattedDate = useMemo(() => {
        const d = new Date(booking.scheduledAt || booking.scheduledDate);
        if (Number.isNaN(d.getTime())) return { date: 'N/A', time: 'N/A' };
        const locale = i18n.language === 'en' ? 'en-IN' : i18n.language;
        return {
            date: d.toLocaleDateString(locale, { day: '2-digit', month: 'short' }),
            time: d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
        };
    }, [booking.scheduledAt, booking.scheduledDate, i18n.language]);

    const price = booking.totalPrice || booking.estimatedPrice || booking.service?.basePrice || 0;
    const isPaid = booking.paymentStatus === 'PAID' || Boolean(booking.paidAt);

    // Compute review status from booking.reviews array
    const hasUserReviewed = useMemo(() => {
        if (!user?.id || !booking.reviews) return true; // default to hide review if no data
        return booking.reviews.some(r => r.reviewerId === user.id);
    }, [booking.reviews, user]);

    // Contact info for the other party
    const otherParty = role === 'CUSTOMER'
        ? booking.workerProfile?.user
        : booking.customer;

    return (
        <Card
            className={`
                relative overflow-hidden group transition-all duration-300 cursor-pointer
                hover:shadow-2xl hover:-translate-y-0.5 active:scale-[0.99]
                hover:border-brand-500/20 dark:hover:border-brand-500/50
                ${booking.status === 'IN_PROGRESS' ? 'ring-2 ring-accent-500 ring-offset-2 ring-offset-transparent' : ''}
            `}
            onClick={() => {
                if (role === 'CUSTOMER') {
                    navigate(`/customer/bookings/${booking.id}`);
                } else if (role === 'WORKER') {
                    navigate(`/worker/bookings/${booking.id}`);
                }
            }}
        >
            <div className="p-5">
                {/* Top Row: Service + Status */}
                <div className="flex justify-between items-start mb-3">
                    <div className="flex gap-3 items-center min-w-0">
                        <div className={`
                            w-11 h-11 rounded-xl flex items-center justify-center shrink-0
                            bg-brand-50 dark:bg-brand-900/30
                            border border-brand-500/10
                        `}>
                            {booking.service?.icon ? (
                                <booking.service.icon size={22} className="text-brand-500" />
                            ) : (
                                <Calendar size={22} className="text-brand-500" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-black text-lg tracking-tight leading-tight truncate text-gray-900 dark:text-white">
                                {booking.service?.name}
                            </h3>
                            <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                                <User size={12} className="opacity-50 shrink-0" />
                                <span className="truncate">
                                    {role === 'CUSTOMER'
                                        ? (booking.workerProfile?.user?.name || t('Finding provider...'))
                                        : (booking.customer?.name || t('Customer'))}
                                </span>
                                {role === 'CUSTOMER' && booking.workerProfile && (
                                    <WorkerTierBadge totalJobs={booking.workerProfile.totalReviews || 0} size="sm" />
                                )}
                            </div>
                        </div>
                    </div>
                    <BookingStatusBadge status={booking.status} />
                </div>

                {/* Info Row: Date + Location + Price */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-3 text-xs">
                    <div className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-brand-500 shrink-0" />
                        <span className="font-bold text-gray-600 dark:text-gray-300">
                            {formattedDate.date}, {formattedDate.time}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                        <MapPin size={13} className="text-success-500 shrink-0" />
                        <span className="font-bold truncate max-w-[180px] text-gray-600 dark:text-gray-300">
                            {booking.address || booking.addressDetails || t('Service location')}
                        </span>
                    </div>
                    {booking.frequency && booking.frequency !== 'ONE_TIME' && (
                        <div className="flex items-center gap-1 bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 px-2 py-0.5 rounded flex-shrink-0">
                            <Repeat size={10} />
                            <span className="font-bold text-[10px] tracking-widest uppercase">
                                {t(booking.frequency.replace('_', ' '))}
                            </span>
                        </div>
                    )}
                    {price > 0 && (
                        <div className="flex items-center gap-1">
                            <IndianRupee size={12} className="text-brand-500 shrink-0" />
                            <span className="font-black text-gray-900 dark:text-white">
                                {Number(price).toLocaleString()}
                            </span>
                        </div>
                    )}
                </div>

                {/* Quick Contact — inline for confirmed/in-progress */}
                {['CONFIRMED', 'IN_PROGRESS'].includes(booking.status) && (
                    <div className="flex items-center gap-2 mb-3" onClick={(e) => e.stopPropagation()}>
                        <ChatToggle
                            bookingId={booking.id}
                            label={role === 'CUSTOMER' ? t('Chat with Provider') : t('Chat with Customer')}
                        />
                        {otherParty?.mobile && (
                            <a
                                href={`tel:${otherParty.mobile}`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors
                                    bg-green-50 dark:bg-dark-800 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30"
                            >
                                <Phone size={12} /> {t('Call')}
                            </a>
                        )}
                        {otherParty?.email && (
                            <a
                                href={`mailto:${otherParty.email}`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors
                                    bg-blue-50 dark:bg-dark-800 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                            >
                                <Mail size={12} /> {t('Email')}
                            </a>
                        )}
                    </div>
                )}

                {/* Action Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100 dark:border-dark-700" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap gap-2">

                        {/* Customer Specific Actions */}
                        {role === 'CUSTOMER' && (
                            <>
                                {['PENDING', 'CONFIRMED'].includes(booking.status) && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="rounded-xl border-dashed h-9 border-2 border-error-500/30 text-error-500 hover:bg-error-50 text-xs"
                                        onClick={(e) => handleAction(e, 'CANCEL')}
                                        loading={isActionLoading && activeActionId === booking.id}
                                    >
                                        {t('Cancel Booking')}
                                    </Button>
                                )}

                                {/* Pay Now — shows for completed but unpaid bookings */}
                                {booking.status === 'COMPLETED' && !isPaid && (
                                    <Button
                                        size="sm"
                                        variant="primary"
                                        className="rounded-xl px-6 h-9 shadow-brand-500/20 shadow-lg text-xs"
                                        onClick={(e) => handleAction(e, 'PAY')}
                                        loading={isActionLoading && activeActionId === booking.id}
                                        icon={CreditCard}
                                    >
                                        {t('Pay Now')}
                                    </Button>
                                )}

                                {/* Download Invoice Box */}
                                {booking.status === 'COMPLETED' && isPaid && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="rounded-xl px-5 h-9 text-xs border-brand-200 text-brand-700 hover:bg-brand-50 dark:border-brand-500/20 dark:text-brand-400 dark:hover:bg-brand-500/10"
                                        onClick={(e) => handleAction(e, 'DOWNLOAD_INVOICE')}
                                        icon={Download}
                                    >
                                        {t('Invoice')}
                                    </Button>
                                )}

                                {/* Book Again — one-click rebook with same worker (Sprint 17 #77) */}
                                {booking.status === 'COMPLETED' && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="rounded-xl px-5 h-9 text-xs border-success-200 text-success-700 hover:bg-success-50 dark:border-success-500/20 dark:text-success-400 dark:hover:bg-success-500/10"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const params = new URLSearchParams();
                                            if (booking.workerProfile?.id) params.set('worker', booking.workerProfile.id);
                                            if (booking.address) params.set('address', booking.address);
                                            const qs = params.toString();
                                            navigate(`/services/${booking.serviceId}${qs ? `?${qs}` : ''}`);
                                        }}
                                        icon={RotateCcw}
                                    >
                                        {t('Book Again')}
                                    </Button>
                                )}

                                {/* Review — shows after payment is done */}
                                {booking.status === 'COMPLETED' && isPaid && !hasUserReviewed && (
                                    <QuickReview
                                        bookingId={booking.id}
                                        role="CUSTOMER"
                                        className="p-0 border-0 shadow-none bg-transparent"
                                        onReviewSubmit={(data) => onAction('REVIEW', data)}
                                        isSubmitting={isActionLoading && activeActionId === booking.id}
                                    />
                                )}
                            </>
                        )}

                        {/* Worker Specific Actions */}
                        {role === 'WORKER' && (
                            <>
                                {booking.status === 'PENDING' && (
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="primary"
                                            className="rounded-xl px-6 h-9 shadow-brand-500/20 shadow-lg text-xs"
                                            onClick={(e) => handleAction(e, 'CONFIRM')}
                                            loading={isActionLoading && activeActionId === booking.id}
                                            icon={CheckCircle}
                                        >
                                            {t('Accept')}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="rounded-xl border-error-500/30 text-error-500 hover:bg-error-50 h-9 text-xs"
                                            onClick={(e) => handleAction(e, 'CANCEL')}
                                        >
                                            {t('Decline')}
                                        </Button>
                                    </div>
                                )}

                                {booking.status === 'CONFIRMED' && (
                                    <Button
                                        size="sm"
                                        variant="primary"
                                        className="rounded-xl px-8 h-9 shadow-brand-500/20 shadow-lg text-xs"
                                        onClick={(e) => handleAction(e, 'START_OTP')}
                                        icon={PlayCircle}
                                    >
                                        {t('Start Job')}
                                    </Button>
                                )}

                                {booking.status === 'IN_PROGRESS' && (
                                    <Button
                                        size="sm"
                                        className="bg-success-500 text-white hover:bg-success-600 rounded-xl px-8 h-9 shadow-lg text-xs"
                                        onClick={(e) => handleAction(e, 'COMPLETE_OTP')}
                                        icon={CheckCircle}
                                    >
                                        {t('Finish Job')}
                                    </Button>
                                )}

                                {booking.status === 'COMPLETED' && (
                                    <div className="flex gap-2">
                                        {!isPaid && (
                                            <Button
                                                size="sm"
                                                variant="warning"
                                                className="rounded-xl px-4 h-9 text-xs"
                                                onClick={(e) => handleAction(e, 'VERIFY_CASH')}
                                            >
                                                {t('Verify Cash Collected')}
                                            </Button>
                                        )}
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="rounded-xl px-5 h-9 text-xs border-brand-200 text-brand-700 hover:bg-brand-50 dark:border-brand-500/20 dark:text-brand-400 dark:hover:bg-brand-500/10"
                                            onClick={(e) => handleAction(e, 'DOWNLOAD_INVOICE')}
                                            icon={Download}
                                        >
                                            {t('Invoice')}
                                        </Button>
                                    </div>
                                )}

                                {booking.status === 'COMPLETED' && !hasUserReviewed && (
                                    <QuickReview
                                        bookingId={booking.id}
                                        role="WORKER"
                                        className="p-0 border-0 shadow-none bg-transparent"
                                        onReviewSubmit={(data) => onAction('REVIEW', data)}
                                        isSubmitting={isActionLoading && activeActionId === booking.id}
                                    />
                                )}
                            </>
                        )}
                    </div>

                    <div className={`
                        p-2 rounded-lg border transition-all shrink-0
                        border-gray-100 dark:border-dark-700 text-gray-300 dark:text-gray-500 group-hover:border-brand-500 group-hover:text-brand-500
                    `}>
                        <ArrowRight size={16} />
                    </div>
                </div>
            </div>

            {/* Visual Indicator for Active Jobs */}
            {booking.status === 'IN_PROGRESS' && (
                <div className="absolute top-0 right-0 p-1 px-2.5 bg-accent-500 text-white font-black text-[7px] uppercase tracking-widest rounded-bl-lg shadow-lg animate-pulse">
                    {t('Live')}
                </div>
            )}
        </Card>
    );
});
