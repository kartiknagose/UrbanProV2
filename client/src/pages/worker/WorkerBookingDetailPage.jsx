import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
    Briefcase,
    ArrowLeft,
    CheckCircle,
    XCircle,
    PlayCircle,
    Phone,
    MessageCircle,
    Mail,
    Star,
    AlertCircle,
    MessageSquare,
    Calendar,
    Clock,
    MapPin,
    ExternalLink,
    User,
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
import { MiniMap } from '../../components/features/location/MiniMap';
import { ChatToggle } from '../../components/features/chat/ChatWindow';
import { StarRating } from '../../components/features/reviews/StarRating';

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
            <div className={`${getPageLayout('default')} pb-32 lg:pb-10`}>
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
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8">
                            {/* Main Content Area */}
                            <div className="lg:col-span-8 xl:col-span-9 space-y-6">
                                {/* Header Card */}
                                <div className="space-y-4">

                                    {booking.status === 'COMPLETED' && booking.paymentStatus !== 'PAID' && (
                                        <div className="p-5 rounded-2xl border bg-yellow-50 border-yellow-200 dark:bg-yellow-900/10 dark:border-yellow-700/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm animate-in fade-in slide-in-from-top-4">
                                            <div className="flex gap-4 items-start">
                                                <div className="p-2 rounded-xl bg-yellow-100 dark:bg-yellow-900/40 text-yellow-600 dark:text-yellow-500 mt-0.5">
                                                    <Briefcase size={20} />
                                                </div>
                                                <div>
                                                    <h3 className="font-black text-yellow-800 dark:text-yellow-400">{t('Payment Pending')}</h3>
                                                    <p className="text-sm font-medium text-yellow-700/80 dark:text-yellow-500/80 leading-snug max-w-lg mt-0.5">{t("The customer hasn't paid online yet. If you collected cash in person, verify it here.")}</p>
                                                </div>
                                            </div>
                                            <Button 
                                                onClick={handleVerifyCash} 
                                                loading={verifyCashMutation.isPending}
                                                className="bg-yellow-500 hover:bg-yellow-600 text-white font-black whitespace-nowrap shadow-lg shadow-yellow-500/20 rounded-xl px-6 h-12 w-full sm:w-auto"
                                            >
                                                {t('Verify Cash Collected')}
                                            </Button>
                                        </div>
                                    )}
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div>
                                            <div className="flex items-center gap-3 mb-1">
                                                <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white">
                                                    {t('Job')} #{booking.id}
                                                </h1>
                                                <BookingStatusBadge status={booking.status} className="px-2 py-0.5 text-2xs font-black uppercase" />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Briefcase size={16} className="text-brand-500" />
                                                <p className="text-lg font-bold text-gray-600 dark:text-gray-300">
                                                    {booking.service?.name}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="hidden lg:flex items-center gap-2">
                                            <WorkerDesktopActions 
                                                booking={booking} 
                                                statusMutation={statusMutation} 
                                                openOtpModal={openOtpModal} 
                                                openCancelModal={openCancelModal} 
                                            />
                                        </div>
                                    </div>

                                    {/* Service Lifecycle Timeline */}
                                    <BookingTimeline booking={booking} />

                                    {/* Rating/Review Section for COMPLETED Bookings */}
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

                                    {/* Assignment Details Card */}
                                    <BookingAssignmentDetails booking={booking} onOpenMaps={handleOpenMaps} />
                                </div>
                            </div>

                            {/* Sidebar Area */}
                            <div className="lg:col-span-4 xl:col-span-3 space-y-6">
                                {/* Session Management Panel (IN_PROGRESS only) */}
                                <WorkerSessionPanel bookingId={booking.id} bookingStatus={booking.status} />

                                {/* Session Timeline (IN_PROGRESS only) */}
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
