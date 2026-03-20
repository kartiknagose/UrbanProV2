import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
    Briefcase,
    ArrowLeft,
    XCircle,
    ShieldAlert,
    CreditCard,
    Compass,
    Download,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { MainLayout } from '../../components/layout/MainLayout';
import { Card, Button, AsyncState, Breadcrumbs } from '../../components/common';
import { BookingStatusBadge } from '../../components/common';
import { getBookingById, payBooking, downloadInvoice } from '../../api/bookings';
import { getWorkerLocation } from '../../api/location';
import { queryKeys } from '../../utils/queryKeys';
import { getPaymentDisplayText } from '../../utils/statusHelpers';
import { CancellationModal } from '../../components/features/bookings/CancellationModal';
import { BookingSessionsTimeline } from '../../components/features/bookings/BookingSessionsTimeline';
import { LiveTrackingMap } from '../../components/features/location/LiveTrackingMap';
import { createReview } from '../../api/reviews';
import { toast } from 'sonner';
import { useAuth } from '../../hooks/useAuth';
import { useSocketEvent } from '../../hooks/useSocket';
import { getPageLayout } from '../../constants/layout';
import { BookingDetailsGrid } from './components/BookingDetailsGrid';
import { CustomerWorkerSection } from './components/CustomerWorkerSection';
import { CustomerOTPSection } from './components/CustomerOTPSection';
import { CustomerMobileActions } from './components/CustomerMobileActions';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useRazorpay } from '../../hooks/useRazorpay';
import { getRazorpayKeyId, ensureRazorpayLoaded } from '../../utils/razorpay';

const formatInrAmount = (value) => {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return '0';
    return amount.toLocaleString('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    });
};

export function CustomerBookingDetailPage() {
    const { t } = useTranslation();
    usePageTitle(t('Booking Details'));
    const { id: bookingId } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [workerLocation, setWorkerLocation] = useState(null);
    const [activeReview, setActiveReview] = useState({ rating: 0, comment: '' });
    const [photoModal, setPhotoModal] = useState(null);
    const razorpayKeyId = getRazorpayKeyId();

    useRazorpay({
        onError: () => {
            toast.error(t('Payment system failed to load. Please refresh and try again.'));
        },
    });

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: queryKeys.bookings.detail(bookingId),
        queryFn: () => getBookingById(bookingId),
        refetchInterval: (query) => {
            // Polling keeps OTP/status in sync even if realtime socket events are delayed.
            const bookingData = query.state.data;
            if (['PENDING', 'CONFIRMED', 'IN_PROGRESS'].includes(bookingData?.booking?.status)) return 10000;
            return false;
        },
        refetchIntervalInBackground: false,
    });

    const booking = data?.booking;
    const workerProfileId = booking?.workerProfile?.id;

    // Razorpay checkout handler
    function launchRazorpayCheckout(order, booking, user, onSuccess, onFailure) {
        if (!window?.Razorpay) {
            toast.error(t('Payment system unavailable. Please try again in a moment.'));
            onFailure?.();
            return;
        }

        if (!razorpayKeyId) {
            toast.error(t('Payment is not configured. Please contact support.'));
            onFailure?.();
            return;
        }

        const options = {
            key: razorpayKeyId,
            amount: order.amount,
            currency: order.currency,
            name: 'UrbanPro V2',
            description: `Booking #${booking.id}`,
            order_id: order.id,
            prefill: {
                name: user.name,
                email: user.email,
                contact: user.mobile,
            },
            handler: function (response) {
                onSuccess(response);
            },
            modal: {
                ondismiss: onFailure,
            },
        };

        try {
            const rzp = new window.Razorpay(options);
            rzp.open();
        } catch (_error) {
            toast.error(t('Unable to open payment window. Please try again.'));
            onFailure?.();
        }
    }

    const payMutation = useMutation({
        mutationFn: async (paymentMode = 'ONLINE') => {
            if (paymentMode === 'WALLET') {
                await payBooking(bookingId, { payWithWallet: true });
                queryClient.setQueryData(queryKeys.bookings.detail(bookingId), (prev) => {
                    if (!prev?.booking) return prev;
                    return {
                        ...prev,
                        booking: {
                            ...prev.booking,
                            paymentStatus: 'PAID',
                        },
                    };
                });
                queryClient.setQueryData(queryKeys.bookings.customer(), (prev) => {
                    if (!prev || !Array.isArray(prev.bookings)) return prev;
                    return {
                        ...prev,
                        bookings: prev.bookings.map((b) => (
                            String(b.id) === String(bookingId)
                                ? { ...b, paymentStatus: 'PAID' }
                                : b
                        )),
                    };
                });
                queryClient.invalidateQueries({ queryKey: queryKeys.bookings.detail(bookingId) });
                queryClient.invalidateQueries({ queryKey: queryKeys.bookings.customer() });
                toast.success(t('Payment completed using wallet balance.'));
                return;
            }

            if (!razorpayKeyId) {
                toast.error(t('Payment is not configured. Please contact support.'));
                return;
            }

            await ensureRazorpayLoaded();

            // 1. Call backend to create Razorpay order
            const orderResp = await payBooking(bookingId, { createRazorpayOrder: true });
            const order = orderResp.order;

            if (!order) {
                toast.error(t('Failed to initiate payment. Please try again.'));
                return;
            }

            // 2. Launch Razorpay modal
            launchRazorpayCheckout(order, booking, user,
                async (razorpayResponse) => {
                    // 3. On success, update payment status
                    await payBooking(bookingId, {
                        paymentReference: razorpayResponse.razorpay_payment_id,
                        paymentOrderId: razorpayResponse.razorpay_order_id,
                        paymentSignature: razorpayResponse.razorpay_signature,
                    });
                    queryClient.setQueryData(queryKeys.bookings.detail(bookingId), (prev) => {
                        if (!prev?.booking) return prev;
                        return {
                            ...prev,
                            booking: {
                                ...prev.booking,
                                paymentStatus: 'PAID',
                            },
                        };
                    });
                    queryClient.setQueryData(queryKeys.bookings.customer(), (prev) => {
                        if (!prev || !Array.isArray(prev.bookings)) return prev;
                        return {
                            ...prev,
                            bookings: prev.bookings.map((b) => (
                                String(b.id) === String(bookingId)
                                    ? { ...b, paymentStatus: 'PAID' }
                                    : b
                            )),
                        };
                    });
                    queryClient.invalidateQueries({ queryKey: queryKeys.bookings.detail(bookingId) });
                    queryClient.invalidateQueries({ queryKey: queryKeys.bookings.customer() });
                    toast.success(t('Payment successful! Thank you.'));
                },
                () => {
                    toast.error(t('Payment cancelled or failed.'));
                }
            );
        },
        onError: (err) => {
            toast.error(err?.response?.data?.message || t('Payment failed.'));
        },
    });

    const reviewMutation = useMutation({
        mutationFn: (data) => createReview(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.bookings.detail(bookingId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.bookings.customer() });
            toast.success(t('Thank you for your feedback!'));
            setActiveReview({ rating: 0, comment: '' });
        },
        onError: (error) => {
            toast.error(error.response?.data?.error || t('Failed to submit review'));
        }
    });

    useEffect(() => {
        if (!workerProfileId) return;

        // Only track location for active bookings
        const isActive = ['CONFIRMED', 'IN_PROGRESS'].includes(booking?.status);
        if (!isActive) return;

        const fetchLocation = async () => {
            try {
                const res = await getWorkerLocation(workerProfileId);
                if (res?.location) {
                    setWorkerLocation({
                        lat: res.location.latitude,
                        lng: res.location.longitude,
                    });
                }
            } catch {
                // ignore location fetch errors
            }
        };

        fetchLocation();

        const handleLocationUpdate = (event) => {
            const payload = event.detail;
            if (payload?.workerProfileId === workerProfileId) {
                setWorkerLocation({ lat: payload.latitude, lng: payload.longitude });
            }
        };

        const joinWorkerRoom = () => {
            const socketRef = typeof window !== 'undefined' ? window.__UPRO_SOCKET : null;
            if (socketRef?.current) {
                socketRef.current.emit('joinRoom', `worker_tracking:${workerProfileId}`);
            }
        };

        joinWorkerRoom();
        window.addEventListener('upro:socket-ready', joinWorkerRoom);
        window.addEventListener('upro:worker-location-updated', handleLocationUpdate);

        return () => {
            window.removeEventListener('upro:socket-ready', joinWorkerRoom);
            window.removeEventListener('upro:worker-location-updated', handleLocationUpdate);

            // Strictly clean up: leave the room when component unmounts or status changes
            const socketRef = typeof window !== 'undefined' ? window.__UPRO_SOCKET : null;
            if (socketRef?.current) {
                socketRef.current.emit('leaveRoom', `worker_tracking:${workerProfileId}`);
            }
        };
    }, [workerProfileId, booking?.status]);

    useSocketEvent('booking:status_updated', (payload) => {
        if (!user?.id || !bookingId) return;

        const eventBookingId = payload?.id || payload?.bookingId;
        const eventCustomerId = payload?.customer?.id || payload?.customerId;
        const isForMe = String(eventBookingId) === String(bookingId) && String(eventCustomerId) === String(user.id);
        if (!isForMe) return;

        const getStatusMessage = (status) => {
            switch (status) {
                case 'CONFIRMED': return t('Worker accepted your booking');
                case 'IN_PROGRESS': return t('Worker started your service');
                case 'COMPLETED': return t('Service marked as completed');
                case 'CANCELLED': return t('Booking was cancelled');
                default: return t('Booking updated');
            }
        };

        queryClient.invalidateQueries({ queryKey: queryKeys.bookings.detail(bookingId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.bookings.customer() });
        toast.info(getStatusMessage(payload?.status));
    }, [bookingId, user?.id]);

    useSocketEvent('booking:otp_refreshed', (payload) => {
        if (!user?.id || !bookingId) return;

        const eventBookingId = payload?.bookingId;
        const eventCustomerId = payload?.customerId;
        const isForMe = String(eventBookingId) === String(bookingId) && String(eventCustomerId) === String(user.id);
        if (!isForMe) return;

        if (payload?.otpCode && payload?.otpType) {
            queryClient.setQueryData(queryKeys.bookings.detail(bookingId), (prev) => {
                if (!prev?.booking) return prev;
                const nextBooking = { ...prev.booking };
                if (payload.otpType === 'START') {
                    nextBooking.startOtp = payload.otpCode;
                } else if (payload.otpType === 'COMPLETE') {
                    nextBooking.completionOtp = payload.otpCode;
                }
                return { ...prev, booking: nextBooking };
            });
        }

        queryClient.invalidateQueries({ queryKey: queryKeys.bookings.detail(bookingId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.bookings.customer() });
        refetch();
        toast.info(t('A new OTP has been generated.'));
    }, [bookingId, user?.id, refetch]);

    const handleOpenMaps = () => {
        if (!booking) return;
        const lat = booking.latitude;
        const lng = booking.longitude;
        const address = booking.address || booking.addressDetails;

        if (lat && lng) {
            window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
        } else if (address) {
            window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
        }
    };

    if (isLoading) return <MainLayout><div className="flex items-center justify-center min-h-[60vh]"><AsyncState isLoading={true} /></div></MainLayout>;
    if (isError) return <MainLayout><div className={`${getPageLayout('narrow')} py-10`}><AsyncState isError={true} onRetry={refetch} /></div></MainLayout>;
    if (!booking) return <MainLayout><div className={`${getPageLayout('narrow')} py-10`}><AsyncState isEmpty={true} emptyTitle={t("Booking not found")} /></div></MainLayout>;

    // Helper: Filter booking photos
    const beforePhotos = booking?.photos?.filter(p => p.type === 'BEFORE') || [];
    const afterPhotos = booking?.photos?.filter(p => p.type === 'AFTER') || [];

    return (
        <MainLayout>
            <div className={`${getPageLayout('default')} pb-32 lg:pb-10 min-h-screen`}>
                <Breadcrumbs items={[
                    { label: t('Dashboard'), to: '/customer/dashboard' },
                    { label: t('Bookings'), to: '/customer/bookings' },
                    { label: `${t('Booking')} #${bookingId}` },
                ]} />

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Main Content Area */}
                    <div className="lg:col-span-3 space-y-6">
                        {/* Header Card */}
                        <div className="space-y-4">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white">
                                            {t('Booking')} #{booking.id}
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
                                    {booking.status === 'COMPLETED' && booking.paymentStatus === 'PAID' && (
                                        <Button
                                            size="md"
                                            variant="outline"
                                            icon={Download}
                                            onClick={() => {
                                                toast.promise(downloadInvoice(booking.id), {
                                                    loading: t('Generating Invoice...'),
                                                    success: t('Invoice Downloaded Successfully'),
                                                    error: t('Failed to generate invoice')
                                                });
                                            }}
                                            className="h-12 px-6 rounded-xl font-bold"
                                        >
                                            {t('Invoice')}
                                        </Button>
                                    )}
                                    {booking.status === 'COMPLETED' && booking.paymentStatus !== 'PAID' && (
                                        <>
                                            <Button
                                                size="md"
                                                variant="outline"
                                                icon={CreditCard}
                                                onClick={() => payMutation.mutate('WALLET')}
                                                loading={payMutation.isPending}
                                                className="px-6 h-12 rounded-xl font-bold"
                                            >
                                                {t('Pay via Wallet')}
                                            </Button>
                                            <Button
                                                size="md"
                                                icon={CreditCard}
                                                onClick={() => payMutation.mutate('ONLINE')}
                                                loading={payMutation.isPending}
                                                className="bg-brand-600 hover:bg-brand-700 text-white shadow-lg px-6 h-12 rounded-xl font-bold"
                                            >
                                                {t('Pay Online')}
                                            </Button>
                                        </>
                                    )}
                                    {['PENDING', 'CONFIRMED'].includes(booking.status) && (
                                        <Button
                                            size="md"
                                            variant="ghost"
                                            icon={XCircle}
                                            onClick={() => setIsCancelModalOpen(true)}
                                            className="text-error-500 hover:bg-error-50 h-12 px-6 rounded-xl font-bold"
                                        >
                                            {t('Cancel Booking')}
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Service Status Banner */}
                            <div className="p-4 rounded-2xl border flex items-center justify-between transition-all bg-white border-gray-100 shadow-sm dark:bg-dark-800/50 dark:border-dark-700 dark:shadow-none">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400">
                                        <ShieldAlert size={24} />
                                    </div>
                                     <div>
                                        <p className="text-2xs font-black uppercase text-gray-500 tracking-widest leading-none mb-1">{t('Live Status')}</p>
                                        <h3 className="text-sm font-black text-gray-900 dark:text-gray-100">
                                            {booking.status === 'PENDING' ? t('Awaiting professional acceptance') :
                                                booking.status === 'CONFIRMED' ? t('Professional is assigned and ready') :
                                                    booking.status === 'IN_PROGRESS' ? t('Service is currently in progress') :
                                                        booking.status === 'COMPLETED' ? t('Job finished successfully') :
                                                            t('Booking has been cancelled')}
                                        </h3>
                                    </div>
                                </div>
                                 {booking.status === 'IN_PROGRESS' && (
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-green-500 animate-ping" aria-hidden="true"></div>
                                        <span className="text-2xs font-black uppercase text-green-500">{t('Live')}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Live Tracking Feature - More prominent in main column */}
                        {['CONFIRMED', 'IN_PROGRESS'].includes(booking.status) && booking.latitude && booking.longitude && (
                            <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 mb-8">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                         <div className="p-1.5 rounded-lg bg-brand-500/10 text-brand-500">
                                            <Compass size={18} />
                                        </div>
                                        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-gray-700 dark:text-gray-300">
                                            {t('Live Professional Tracking')}
                                        </h3>
                                    </div>
                                     <div className="px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" aria-hidden="true" />
                                        {t('Active Stream')}
                                    </div>
                                </div>
                                <LiveTrackingMap
                                    workerId={workerProfileId}
                                    customerLocation={{ lat: booking.latitude, lng: booking.longitude }}
                                    initialWorkerLocation={workerLocation}
                                    height="340px"
                                />
                            </section>
                        )}

                        <BookingDetailsGrid booking={booking} onOpenMaps={handleOpenMaps} />

                        {/* Photo Proof Review Gallery */}
                        {(beforePhotos.length > 0 || afterPhotos.length > 0) && (
                            <section className="mt-8">
                                <h3 className="text-lg font-bold mb-3 text-gray-800 dark:text-gray-200">{t('Photo Proof of Work')}</h3>
                                <div className="flex flex-wrap gap-6">
                                    <div>
                                        <h4 className="text-sm font-semibold mb-2">{t('Before Photos')}</h4>
                                        <div className="flex gap-3">
                                            {beforePhotos.map(photo => (
                                                <button key={photo.id} className="w-32 h-32 rounded-lg border overflow-hidden bg-gray-50 dark:bg-dark-800 focus:outline-none" onClick={() => setPhotoModal(photo)}>
                                                    <img src={photo.url.replace('/upload/', '/upload/f_auto,q_auto/')} alt="Before" className="w-full h-full object-cover" loading="lazy" srcSet={`${photo.url.replace('/upload/', '/upload/f_auto,q_auto/')} 1x, ${photo.url.replace('/upload/', '/upload/f_auto,q_auto/')} 2x`} />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-semibold mb-2">{t('After Photos')}</h4>
                                        <div className="flex gap-3">
                                            {afterPhotos.map(photo => (
                                                <button key={photo.id} className="w-32 h-32 rounded-lg border overflow-hidden bg-gray-50 dark:bg-dark-800 focus:outline-none" onClick={() => setPhotoModal(photo)}>
                                                    <img src={photo.url.replace('/upload/', '/upload/f_auto,q_auto/')} alt="After" className="w-full h-full object-cover" loading="lazy" srcSet={`${photo.url.replace('/upload/', '/upload/f_auto,q_auto/')} 1x, ${photo.url.replace('/upload/', '/upload/f_auto,q_auto/')} 2x`} />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">{t('Review the photos before confirming completion. If you notice any issues, flag the booking or contact support.')}</p>
                            </section>
                        )}
                        {/* Modal for photo preview */}
                        {photoModal && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
                                <div className="bg-white dark:bg-dark-900 rounded-lg shadow-xl max-w-xl w-full p-6 relative">
                                    <button
                                        className="absolute top-3 right-3 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
                                        onClick={() => setPhotoModal(null)}
                                        aria-label="Close"
                                    >
                                        <span style={{ fontSize: 24 }}>&times;</span>
                                    </button>
                                    <img src={photoModal.url.replace('/upload/', '/upload/f_auto,q_auto/')} alt={photoModal.type} className="w-full max-h-96 object-contain rounded" style={{ minHeight: 400 }} loading="lazy" srcSet={`${photoModal.url.replace('/upload/', '/upload/f_auto,q_auto/')} 1x, ${photoModal.url.replace('/upload/', '/upload/f_auto,q_auto/')} 2x`} />
                                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">{photoModal.type === 'BEFORE' ? t('Before Work') : t('After Work')}</div>
                                </div>
                            </div>
                        )}

                        {/* Session Timeline for multi-day bookings */}
                        {booking.status === 'IN_PROGRESS' && (
                            <BookingSessionsTimeline bookingId={booking.id} />
                        )}
                    </div>

                    {/* Sidebar Area */}
                    <div className="space-y-6">
                        <CustomerWorkerSection
                            booking={booking}
                            user={user}
                            activeReview={activeReview}
                            setActiveReview={setActiveReview}
                            reviewMutation={reviewMutation}
                        />


                        <CustomerOTPSection booking={booking} />

                        {/* Payment Info */}
                        <Card className="p-5 border-none bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-xl shadow-brand-500/20">
                            <h3 className="text-2xs font-black uppercase tracking-widest opacity-80 mb-1">{t('Billing Summary')}</h3>
                            <div className="flex justify-between items-end">
                                 <div>
                                    <p className="text-3xl font-black">₹{formatInrAmount(booking.totalPrice ?? booking.estimatedPrice)}</p>
                                    <p className="text-2xs font-bold opacity-80 uppercase tracking-tighter">
                                        {t('Payment')}: {t(getPaymentDisplayText(booking))}
                                    </p>
                                </div>
                                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                                    <CreditCard size={20} />
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>

            {booking && !isLoading && !isError && (
                <CustomerMobileActions
                    booking={booking}
                    navigate={navigate}
                    payMutation={payMutation}
                    onWalletPay={() => payMutation.mutate('WALLET')}
                    onCancelOpen={() => setIsCancelModalOpen(true)}
                />
            )}

            {/* Cancellation Modal */}
            <CancellationModal
                isOpen={isCancelModalOpen}
                onClose={() => setIsCancelModalOpen(false)}
                bookingId={parseInt(bookingId)}
                role="CUSTOMER"
                invalidateKeys={[queryKeys.bookings.detail(bookingId), queryKeys.bookings.customer()]}
            />
        </MainLayout>
    );
}
