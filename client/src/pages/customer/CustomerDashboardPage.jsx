import { useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { MainLayout } from '../../components/layout/MainLayout';
import {
  PageHeader,
  Card,
  Button,
  Badge,
  StatCard,
  BookingCard,
  Avatar,
  BookingCardSkeleton,
  StatGridSkeleton,
  AsyncState,
  ConfirmDialog
} from '../../components/common';
import { EmptyDataState } from '../../components/common/sections';

import {
  Calendar,
  Briefcase,
  CheckCircle,
  Clock,
  Home,
  Zap,
  Star,
  CalendarClock,
  Wallet,
  ShieldAlert,
  ArrowRight,
  ChevronRight
} from 'lucide-react';

import { getAllBookings, cancelBooking, payBooking } from '../../api/bookings';
import { createReview } from '../../api/reviews';
import { getAllServices } from '../../api/services';
import { queryKeys } from '../../utils/queryKeys';
import { useAuth } from '../../hooks/useAuth';
import { getPageLayout } from '../../constants/layout';
import { getServiceImage } from '../../constants/images';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcut';
import { useSocketEvent } from '../../hooks/useSocket';
import { formatCurrencyCompact } from '../../utils/formatters';
import { toastSuccess, toastErrorFromResponse, toastInfo, toastError } from '../../utils/notifications';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useRazorpay } from '../../hooks/useRazorpay';
import { ensureRazorpayLoaded, getRazorpayKeyId } from '../../utils/razorpay';
import { asArray } from '../../utils/safeData';

export function CustomerDashboardPage() {
  const { t } = useTranslation();
  usePageTitle(t('Dashboard'));
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [cancelConfirmId, setCancelConfirmId] = useState(null);
  const razorpayKeyId = getRazorpayKeyId();

  useRazorpay({
    onError: () => {
      toastError(t('Payment system failed to load. Please refresh and try again.'));
    },
  });

  // Keyboard shortcuts
  useKeyboardShortcuts([
    { key: 'b', callback: () => navigate('/customer/bookings'), meta: true, title: t('Go to bookings') },
    { key: 's', callback: () => navigate('/services'), meta: true, title: t('Browse services') },
    { key: 'p', callback: () => navigate('/customer/profile'), meta: true, title: t('Open profile') },
  ]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.bookings.customer(),
    queryFn: getAllBookings,
  });

  const servicesQuery = useQuery({
    queryKey: queryKeys.services.preview(),
    queryFn: getAllServices,
    staleTime: 5 * 60 * 1000,
  });

  const reviewMutation = useMutation({
    mutationFn: (payload) => createReview(payload),
    onSuccess: () => {
      toastSuccess(t('Review submitted! Thank you.'));
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.customer() });
    },
    onError: (error) => {
      toastErrorFromResponse(error, t('Failed to submit review'));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id) => cancelBooking(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.customer() });
    },
  });

  const launchRazorpayCheckout = (order, booking, onSuccess, onFailure) => {
    if (!window?.Razorpay) {
      toastError(t('Payment system unavailable. Please try again in a moment.'));
      onFailure?.();
      return;
    }

    if (!razorpayKeyId) {
      toastError(t('Payment is not configured. Please contact support.'));
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
        name: user?.name,
        email: user?.email,
        contact: user?.mobile,
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
      toastError(t('Unable to open payment window. Please try again.'));
      onFailure?.();
    }
  };

  const payMutation = useMutation({
    mutationFn: async (booking) => {
      if (!booking?.id) {
        throw new Error('Missing booking details for payment.');
      }

      if (!razorpayKeyId) {
        throw new Error('Payment is not configured.');
      }

      await ensureRazorpayLoaded();

      const orderResp = await payBooking(booking.id, { createRazorpayOrder: true });
      const order = orderResp?.order;

      if (!order) {
        throw new Error('Failed to initiate payment.');
      }

      await new Promise((resolve, reject) => {
        launchRazorpayCheckout(
          order,
          booking,
          async (razorpayResponse) => {
            try {
              await payBooking(booking.id, {
                paymentReference: razorpayResponse.razorpay_payment_id,
                paymentOrderId: razorpayResponse.razorpay_order_id,
                paymentSignature: razorpayResponse.razorpay_signature,
              });
              resolve();
            } catch (error) {
              reject(error);
            }
          },
          () => {
            reject(new Error('Payment cancelled or failed.'));
          }
        );
      });

      return { bookingId: booking.id };
    },
    onSuccess: ({ bookingId }) => {
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
      toastSuccess(t('Payment successful! Thank you.'));
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.customer() });
    },
    onError: (error) => {
      toastErrorFromResponse(error, t('Payment failed'));
    },
  });

  const [activeActionId, setActiveActionId] = useState(null);

  const bookings = useMemo(() => asArray(data?.bookings), [data?.bookings]);
  const activeBookings = useMemo(() =>
    bookings.filter(b => {
      // Always show active jobs
      if (['PENDING', 'CONFIRMED', 'IN_PROGRESS'].includes(b.status)) return true;
      // Keep completed jobs until customer has paid AND reviewed
      if (b.status === 'COMPLETED') {
        const hasReviewed = asArray(b.reviews).some(r => r.reviewerId === user?.id);
        const hasPaid = b.paymentStatus === 'PAID';
        return !hasPaid || !hasReviewed;
      }
      return false;
    }),
    [bookings, user?.id]);

  const services = servicesQuery.data?.services || servicesQuery.data || [];

  const handleBookingAction = async (type, payload) => {
    const actionId = payload.id || payload.bookingId;
    setActiveActionId(actionId);
    try {
      if (type === 'CANCEL') {
        setCancelConfirmId(actionId);
        return; // Dialog handles the rest
      } else if (type === 'PAY') {
        const booking = bookings.find((item) => item.id === actionId);
        await payMutation.mutateAsync(booking);
      } else if (type === 'REVIEW') {
        await reviewMutation.mutateAsync({
          bookingId: payload.bookingId,
          rating: payload.rating,
          comment: payload.comment,
        });
      }
    } finally {
      setActiveActionId(null);
    }
  };

  const summary = useMemo(() => {
    return {
      total: bookings.length,
      pending: bookings.filter((b) => b.status === 'PENDING').length,
      confirmed: bookings.filter((b) => b.status === 'CONFIRMED').length,
      completed: bookings.filter((b) => b.status === 'COMPLETED').length,
      cancelled: bookings.filter((b) => b.status === 'CANCELLED').length,
      active: activeBookings.length
    };
  }, [bookings, activeBookings]);

  const totalSpent = useMemo(() => {
    return bookings
      .filter((booking) => booking.status === 'COMPLETED')
      .reduce((sum, booking) => sum + Number(booking.totalPrice || 0), 0);
  }, [bookings]);

  const pendingPaymentTotal = useMemo(() => {
    return bookings
      .filter((booking) => booking.status === 'COMPLETED' && booking.paymentStatus !== 'PAID')
      .reduce((sum, booking) => sum + Number(booking.totalPrice || 0), 0);
  }, [bookings]);

  useSocketEvent('booking:created', (payload) => {
    const customerId = payload?.customerId || payload?.customer?.id;
    if (String(customerId) === String(user?.id)) {
      toastInfo(t('New booking confirmed!'));
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.customer() });
    }
  });

  useSocketEvent('booking:status_updated', (payload) => {
    const customerId = payload?.customerId || payload?.customer?.id;
    if (String(customerId) === String(user?.id)) {
      const bookingId = payload?.id || payload?.bookingId;
      toastSuccess(t('Booking status: {{status}}', { status: t(payload.status) }), {
        id: `booking-status:${bookingId}:${payload?.status}`,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.customer() });
    }
  });

  return (
    <MainLayout>
      <div className={getPageLayout('wide')}>

        {/* Modern Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="flex items-center gap-6">
            <Avatar name={user?.name} src={user?.profilePhotoUrl} size="xl" ring />
            <div>
              <div className="inline-flex items-center gap-2 mb-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand-600 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
                <Home size={12} />
                {t('Customer Home')}
              </div>
              <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-2 text-gray-900 dark:text-white">
                {t('Welcome back,')} <span className="text-brand-500">{user?.name?.split(' ')[0]}!</span>
              </h1>
              <p className="text-gray-500 font-medium italic">{t('Your personalized service hub is ready.')}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => navigate('/customer/bookings/wizard')} className="px-8 rounded-2xl h-14 font-bold uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-brand-500/20">
              {t('Book New Service')}
            </Button>
          </div>
        </div>

        {/* Dynamic Stat Cards */}
        {isLoading ? (
          <StatGridSkeleton />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-12">
            <StatCard
              title={t("Active Sessions")}
              value={summary.active}
              icon={CalendarClock}
              color="brand"
              className="md:scale-105"
            />
            <StatCard
              title={t("Jobs Completed")}
              value={summary.completed}
              icon={CheckCircle}
              color="success"
            />
            <StatCard
              title={t("Pending Payments")}
              value={formatCurrencyCompact(pendingPaymentTotal)}
              icon={Wallet}
              color="info"
            />
            <StatCard
              title={t("Total Invested")}
              value={formatCurrencyCompact(totalSpent)}
              icon={Briefcase}
              color="warning"
            />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Left Column: Activity & Recommendations */}
          <div className="lg:col-span-2 space-y-12">

            {/* Real-time Activity Section */}
            <section>
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                  {t('Live Activity')}
                </h2>
                <Link to="/customer/bookings" className="text-brand-500 font-bold text-xs uppercase tracking-widest hover:underline px-4 py-2 bg-brand-500/10 rounded-xl transition-colors">
                  {t('Full History')}
                </Link>
              </div>

              <AsyncState
                isLoading={isLoading}
                isError={isError}
                onRetry={refetch}
                loadingFallback={<div className="space-y-6"><BookingCardSkeleton /><BookingCardSkeleton /></div>}
                isEmpty={activeBookings.length === 0}
                emptyTitle={t("No active missions")}
                emptyMessage={t("Book a professional service to track real-time updates here.")}
                className="min-h-[200px]"
              >
                <div className="grid grid-cols-1 gap-6">
                  {activeBookings.map(booking => (
                    <BookingCard
                      key={booking.id}
                      booking={booking}
                      role="CUSTOMER"
                      onAction={handleBookingAction}
                      isActionLoading={cancelMutation.isPending || reviewMutation.isPending || payMutation.isPending}
                      activeActionId={activeActionId}
                    />
                  ))}
                </div>
              </AsyncState>
            </section>

            {/* Smart Discovery Section */}
            <section>
              <h2 className="text-2xl font-bold tracking-tight mb-8 text-gray-900 dark:text-white">
                {t('Handpicked for you')}
              </h2>
              {services.length === 0 ? (
                <EmptyDataState
                  title={t('No recommendations yet')}
                  description={t('Explore services to unlock personalized recommendations.')}
                  actionLabel={t('Browse Services')}
                  onAction={() => navigate('/services')}
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {services.slice(0, 4).map(service => (
                    <Card
                      key={service.id}
                      className="group hover:shadow-2xl transition-all duration-500 cursor-pointer overflow-hidden border-0 bg-transparent"
                      onClick={() => navigate(`/services/${service.id}`)}
                    >
                      <div className="relative h-56 rounded-[2rem] overflow-hidden shadow-lg">
                        <img
                          src={getServiceImage(service.name || service.category)}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 blur-[0.5px] group-hover:blur-0"
                          alt={service.name}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-dark-900 via-dark-900/10 to-transparent opacity-80" />
                        <div className="absolute bottom-6 left-6 right-6">
                          <Badge className="bg-brand-500 text-white border-0 mb-3 px-3 py-1 font-bold uppercase text-[8px] tracking-[0.2em]">{t(service.category || '')}</Badge>
                          <div className="flex items-center justify-between">
                            <h3 className="text-white font-bold text-xl tracking-tight">{t(service.name || '')}</h3>

                            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white scale-0 group-hover:scale-100 transition-transform duration-300">
                              <ArrowRight size={20} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right Column: Premium Widgets */}
          <div className="space-y-8">

            {/* Share Widget */}
            <Card className="border-0 bg-brand-500 text-white p-8 rounded-[2.5rem] relative overflow-hidden shadow-2xl shadow-brand-500/20">
              <div className="relative z-10">
                <h3 className="text-2xl font-bold mb-4 leading-tight">{t('Share UrbanPro with Friends')}</h3>
                <p className="text-brand-100 text-sm font-medium mb-6 opacity-80">{t('Know someone who needs quality home services? Spread the word!')}</p>
                <Button onClick={() => {
                  const fallbackCopy = async () => {
                    try {
                      await navigator.clipboard.writeText(window.location.origin);
                      toastSuccess(t('Link copied to clipboard!'));
                    } catch {
                      toastError(t('Unable to copy link. Please copy it manually.'));
                    }
                  };

                  if (navigator.share) {
                    navigator.share({ title: 'UrbanPro', text: t('Check out UrbanPro for professional home services!'), url: window.location.origin })
                      .catch((err) => {
                        if (err?.name === 'AbortError') return;
                        fallbackCopy();
                      });
                  } else {
                    fallbackCopy();
                  }
                }} className="w-full h-14 bg-white text-brand-600 rounded-2xl font-bold uppercase text-[10px] tracking-widest hover:bg-brand-50 hover:scale-[1.02] transition-all">
                  {t('Share Now')}
                </Button>
              </div>
              <Zap className="absolute -bottom-6 -right-6 w-32 h-32 opacity-10 rotate-12" />
            </Card>

            {/* Security widget */}
            <Card className="p-8 rounded-[2.5rem] bg-opacity-50 backdrop-blur-sm">
              <h3 className="font-bold uppercase tracking-widest text-[10px] mb-8 text-gray-500 dark:text-gray-400">{t('Safety Matrix')}</h3>
              <div className="space-y-8">
                <div className="flex gap-4 group">
                  <div className="w-12 h-12 rounded-2xl bg-success-500/10 flex items-center justify-center text-success-500 group-hover:scale-110 transition-transform">
                    <ShieldAlert size={24} />
                  </div>
                  <div>
                    <p className="font-bold text-sm tracking-tight mb-1 text-dark-900 dark:text-white">{t('Zero-Risk Promise')}</p>
                    <p className="text-xs text-gray-500 font-medium">{t('Verified professional network')}</p>
                  </div>
                </div>
                <div className="flex gap-4 group">
                  <div className="w-12 h-12 rounded-2xl bg-info-500/10 flex items-center justify-center text-info-500 group-hover:scale-110 transition-transform">
                    <Star size={24} />
                  </div>
                  <div>
                    <p className="font-bold text-sm tracking-tight mb-1 text-dark-900 dark:text-white">{t('UrbanPro Quality')}</p>
                    <p className="text-xs text-gray-500 font-medium">{t('Top-rated standard of work')}</p>
                  </div>
                </div>
                <div className="flex gap-4 group">
                  <div className="w-12 h-12 rounded-2xl bg-brand-500/10 flex items-center justify-center text-brand-500 group-hover:scale-110 transition-transform">
                    <Wallet size={24} />
                  </div>
                  <div>
                    <p className="font-bold text-sm tracking-tight mb-1 text-dark-900 dark:text-white">{t('Secure Escrow')}</p>
                    <p className="text-xs text-gray-500 font-medium">{t('Pay only when satisfied')}</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Support widget */}
            <div className="p-2">
              <button onClick={() => toastInfo(t('Support center coming soon! For urgent help, email support@urbanpro.com'))} className="w-full p-6 rounded-3xl border-2 border-dashed flex items-center justify-between group transition-all border-gray-200 hover:border-brand-500/30 dark:border-dark-700 dark:hover:border-brand-500/50">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-dark-800 flex items-center justify-center">
                    <Clock size={18} className="text-gray-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{t('Support Center')}</p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{t('Available 24/7')}</p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-gray-400 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={cancelConfirmId !== null}
        onCancel={() => setCancelConfirmId(null)}
        onConfirm={async () => {
          try {
            await cancelMutation.mutateAsync(cancelConfirmId);
          } finally {
            setCancelConfirmId(null);
          }
        }}
        title={t("Cancel Booking")}
        message={t("Are you sure you want to cancel this booking? This action cannot be undone.")}
        confirmText={t("Yes, Cancel")}
        cancelText={t("Keep Booking")}
        variant="danger"
        loading={cancelMutation.isPending}
      />
    </MainLayout>
  );
}
