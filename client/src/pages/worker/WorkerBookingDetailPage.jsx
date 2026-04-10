import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
    Briefcase,
    ArrowLeft,
    CheckCircle,
    XCircle,
    PlayCircle,
    ShieldCheck,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../components/layout/MainLayout';
import {
    Button,
    AsyncState,
    Card,
    Badge,
    Breadcrumbs,
} from '../../components/common';
import { BookingStatusBadge } from '../../components/common';
import { getBookingById, updateBookingStatus, payBooking } from '../../api/bookings';
import { OtpVerificationModal } from '../../components/features/bookings/OtpVerificationModal';
import { CancellationModal } from '../../components/features/bookings/CancellationModal';
import { queryKeys } from '../../utils/queryKeys';
import { toast } from 'sonner';
import { useAuth } from '../../hooks/useAuth';
import { createReview } from '../../api/reviews';
import { getPageLayout } from '../../constants/layout';
import { useWorkerLocation } from '../../hooks/useWorkerLocation';
import { useSocketEvent } from '../../hooks/useSocket';

import { BookingTimeline } from './components/BookingTimeline';
import { BookingReviewSection } from './components/BookingReviewSection';
import { BookingAssignmentDetails } from './components/BookingAssignmentDetails';
import { WorkerContactSidebar } from './components/WorkerContactSidebar';
import { WorkerDesktopActions, WorkerMobileActions } from './components/BookingActionButtons';
import { WorkerSessionPanel } from './components/WorkerSessionPanel';
import { BookingSessionsTimeline } from '../../components/features/bookings/BookingSessionsTimeline';
import { usePageTitle } from '../../hooks/usePageTitle';

export function WorkerBookingDetailPage() {
    const { t } = useTranslation();
    usePageTitle(t('Job Details'));
    const { id } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // Ensure worker tracking continues while on this page
    const { isOnline, toggleOnline, isUpdating } = useWorkerLocation(true);

    const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
    const [otpAction, setOtpAction] = useState(null); // 'start' or 'complete'
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

    // Review State
    const [activeReview, setActiveReview] = useState({ rating: 0, comment: '' });

    const { data, isLoading, isError, error, refetch } = useQuery({
        queryKey: queryKeys.bookings.detail(id),
        queryFn: () => getBookingById(id),
    });

    const booking = data?.booking;

    const statusMutation = useMutation({
        mutationFn: ({ status }) => updateBookingStatus(id, { status }),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.bookings.detail(id) });
            const action = variables.status === 'CONFIRMED' ? t('accepted') : t('updated');
            toast.success(t('Job {{action}} successfully!', { action }));
        },
        onError: () => {
            toast.error(t('Failed to update status'));
        }
    });

    const verifyCashMutation = useMutation({
        mutationFn: () => payBooking(id, { paymentReference: 'CASH' }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.bookings.detail(id) });
            queryClient.invalidateQueries({ queryKey: queryKeys.bookings.worker() });
            toast.success(t('Cash payment verified! Platform fee was deducted from your wallet.'));
        },
        onError: (err) => {
            toast.error(err?.response?.data?.message || err?.response?.data?.error || t('Failed to verify cash payment'));
        }
    });

    const handleVerifyCash = () => {
        if (window.confirm(t('Confirm you received the exact amount in cash? The platform commission will be deducted from your digital wallet balance.'))) {
            verifyCashMutation.mutate();
        }
    };

    const reviewMutation = useMutation({
        mutationFn: (payload) => createReview(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.bookings.detail(id) });
            toast.success(t('Thank you for your feedback!'));
            setActiveReview({ rating: 0, comment: '' });
        },
        onError: (err) => {
            toast.error(err?.response?.data?.error || t('Failed to submit review'));
        }
    });

    const handleReviewSubmit = () => {
        if (!activeReview.rating) return toast.error(t('Please provide a star rating'));
        reviewMutation.mutate({
            bookingId: parseInt(id, 10),
            rating: activeReview.rating,
            comment: activeReview.comment,
            type: 'CUSTOMER' // Explicitly stating this is a review for the customer
        });
    };

    const openCancelModal = (e) => {
        if (e) e.stopPropagation();
        setIsCancelModalOpen(true);
    };

    const openOtpModal = (action) => {
        setOtpAction(action);
        setIsOtpModalOpen(true);
    };

    const handleOpenMaps = () => {
        if (!booking) return;
        const lat = booking.latitude;
        const lng = booking.longitude;
        const address = booking.address || booking.addressDetails;

        if (Number.isFinite(lat) && Number.isFinite(lng)) {
            window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank', 'noopener,noreferrer');
        } else if (address) {
            window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank', 'noopener,noreferrer');
        }
    };

    const formatCompactDate = (value) => {
        if (!value) return 'N/A';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'N/A';
        return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    };

    const formatCompactTime = (value) => {
        if (!value) return 'N/A';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'N/A';
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    useSocketEvent('booking:status_updated', (payload) => {
        if (!user?.id || !id) return;

        const eventBookingId = payload?.id || payload?.bookingId;
        const workerUserId = payload?.workerUserId || payload?.workerProfile?.userId || payload?.workerProfile?.user?.id;
        const workerProfileId = payload?.workerProfileId || payload?.workerId || payload?.workerProfile?.id;
        const isForMe =
            String(eventBookingId) === String(id) &&
            (String(workerUserId) === String(user.id) || String(workerProfileId) === String(booking?.workerProfileId));
        if (!isForMe) return;

        const statusMessage = (status) => {
            switch (status) {
                case 'CONFIRMED': return t('Booking confirmed');
                case 'IN_PROGRESS': return t('Job started');
                case 'COMPLETED': return t('Job completed');
                case 'CANCELLED': return t('Booking cancelled');
                default: return t('Booking status updated');
            }
        };

        queryClient.invalidateQueries({ queryKey: queryKeys.bookings.detail(id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.bookings.worker() });
        queryClient.invalidateQueries({ queryKey: queryKeys.bookings.open() });
        toast.info(statusMessage(payload?.status));
    }, [id, user?.id, booking?.workerProfileId, t]);

    return (
        <MainLayout>
            <div className={`${getPageLayout('full')} pb-32 lg:pb-10`}>
                <Breadcrumbs items={[
                    { label: t('Dashboard'), to: '/worker/dashboard' },
                    { label: t('Bookings'), to: '/worker/bookings' },
                    { label: t('Booking #{{id}}', { id }) },
                ]} />

                <AsyncState
                    isLoading={isLoading}
                    isError={isError}
                    error={error}
                    onRetry={refetch}
                >
                    {booking &&
                        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.55fr)_380px] gap-5 xl:gap-6 items-start">
                            <div className="space-y-5 min-w-0">
                                <Card className="overflow-hidden border-none ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
                                    <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-dark-700/70 bg-white/70 dark:bg-dark-900/40">
                                        {booking.status === 'COMPLETED' && booking.paymentStatus !== 'PAID' && (
                                            <div className="mb-4 flex flex-col gap-3 rounded-xl border border-yellow-200 bg-yellow-50 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-yellow-700/30 dark:bg-yellow-900/10">
                                                <div className="flex items-start gap-3">
                                                    <div className="mt-0.5 rounded-lg bg-yellow-100 p-2 text-yellow-600 dark:bg-yellow-900/40 dark:text-yellow-500">
                                                        <Briefcase size={18} />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-sm font-black text-yellow-800 dark:text-yellow-400">{t('Payment Pending')}</h3>
                                                        <p className="mt-0.5 max-w-2xl text-xs font-medium leading-relaxed text-yellow-700/80 dark:text-yellow-500/80">
                                                            {t("The customer hasn't paid online yet. If you collected cash in person, verify it here.")}
                                                        </p>
                                                    </div>
                                                </div>
                                                <Button
                                                    onClick={handleVerifyCash}
                                                    loading={verifyCashMutation.isPending}
                                                    className="h-10 rounded-xl bg-yellow-500 px-4 text-xs font-black text-white shadow-lg shadow-yellow-500/20 hover:bg-yellow-600"
                                                >
                                                    {t('Verify Cash Collected')}
                                                </Button>
                                            </div>
                                        )}

                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                            <div className="space-y-3">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white sm:text-3xl">
                                                        {t('Job')} #{booking.id}
                                                    </h1>
                                                    <BookingStatusBadge status={booking.status} className="px-2 py-0.5 text-2xs font-black uppercase" />
                                                </div>
                                                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                                                    <div className="flex items-center gap-2">
                                                        <Briefcase size={15} className="text-brand-500" />
                                                        <span className="font-bold">{booking.service?.name}</span>
                                                    </div>
                                                    <span className="hidden h-4 w-px bg-gray-200 dark:bg-dark-700 lg:block" />
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-black uppercase tracking-widest text-gray-400">{t('Customer')}</span>
                                                        <span className="font-semibold text-gray-800 dark:text-gray-200">{booking.customer?.name || t('Customer')}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-3 gap-2 sm:max-w-xl">
                                                <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-left dark:border-dark-700 dark:bg-dark-900/60">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{t('Date')}</p>
                                                    <p className="mt-1 text-xs font-bold text-gray-900 dark:text-white">{formatCompactDate(booking.scheduledAt || booking.scheduledDate)}</p>
                                                </div>
                                                <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-left dark:border-dark-700 dark:bg-dark-900/60">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{t('Time')}</p>
                                                    <p className="mt-1 text-xs font-bold text-gray-900 dark:text-white">{formatCompactTime(booking.scheduledAt || booking.scheduledDate)}</p>
                                                </div>
                                                <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-left dark:border-dark-700 dark:bg-dark-900/60">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{t('Payment')}</p>
                                                    <p className="mt-1 text-xs font-bold text-gray-900 dark:text-white">{booking.paymentStatus || t('Pending')}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-4 flex flex-wrap gap-2 lg:hidden">
                                            <WorkerDesktopActions
                                                booking={booking}
                                                statusMutation={statusMutation}
                                                openOtpModal={openOtpModal}
                                                openCancelModal={openCancelModal}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-5 p-4 sm:p-5">
                                        <BookingTimeline booking={booking} />

                                        <BookingAssignmentDetails booking={booking} onOpenMaps={handleOpenMaps} />

                                        {booking.status === 'COMPLETED' && (
                                            <BookingReviewSection
                                                booking={booking}
                                                user={user}
                                                activeReview={activeReview}
                                                setActiveReview={setActiveReview}
                                                reviewMutation={reviewMutation}
                                                onSubmit={handleReviewSubmit}
                                            />
                                        )}
                                    </div>
                                </Card>
                            </div>

                            <div className="space-y-4 lg:sticky lg:top-6 min-w-0">
                                <Card className="border-none ring-1 ring-black/5 dark:ring-white/10 shadow-sm overflow-hidden">
                                    <div className="p-4 border-b border-gray-100 dark:border-dark-700/70 bg-gray-50/70 dark:bg-dark-900/40">
                                        <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                            <ShieldCheck size={14} className="text-brand-500" />
                                            {t('Actions')}
                                        </h3>
                                    </div>
                                    <div className="p-4 space-y-3">
                                        <WorkerDesktopActions
                                            booking={booking}
                                            statusMutation={statusMutation}
                                            openOtpModal={openOtpModal}
                                            openCancelModal={openCancelModal}
                                        />
                                    </div>
                                </Card>

                                <WorkerSessionPanel bookingId={booking.id} bookingStatus={booking.status} />

                                {booking.status === 'IN_PROGRESS' && (
                                    <BookingSessionsTimeline bookingId={booking.id} />
                                )}

                                <WorkerContactSidebar
                                    booking={booking}
                                    isOnline={isOnline}
                                    toggleOnline={toggleOnline}
                                    isUpdating={isUpdating}
                                />
                            </div>
                        </div>
                    }
                </AsyncState>
            </div>

            {/* Mobile Sticky Action Bar */}
            {booking && !isLoading && !isError && (
                <WorkerMobileActions 
                    booking={booking} 
                    statusMutation={statusMutation} 
                    openOtpModal={openOtpModal} 
                    openCancelModal={openCancelModal} 
                    onBack={() => navigate('/worker/dashboard')} 
                />
            )}

            {/* Verification Modal */}
            <OtpVerificationModal
                isOpen={isOtpModalOpen}
                onClose={() => setIsOtpModalOpen(false)}
                otpAction={otpAction}
                bookingId={id}
                invalidateKeys={[queryKeys.bookings.detail(id), queryKeys.bookings.worker(), queryKeys.bookings.open()]}
            />

            {/* Cancellation Modal */}
            <CancellationModal
                isOpen={isCancelModalOpen}
                onClose={() => setIsCancelModalOpen(false)}
                bookingId={parseInt(id, 10)}
                role="WORKER"
                invalidateKeys={[queryKeys.bookings.detail(id), queryKeys.bookings.worker(), queryKeys.bookings.open()]}
            />
        </MainLayout>
    );
}
