// CustomerBookingsPage — premium dashboard list with filter bar

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Filter, CalendarCheck, Star, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { motion as Motion } from 'framer-motion';

import { MainLayout } from '../../components/layout/MainLayout';
import {
  Button,
  AsyncState,
  BookingCard,
  Input,
  Card,
  ConfirmDialog,
  Pagination,
  BookingCardSkeleton
} from '../../components/common';
import { cancelBooking, getAllBookings } from '../../api/bookings';
import { createReview } from '../../api/reviews';
import { queryKeys } from '../../utils/queryKeys';
import { getPageLayout } from '../../constants/layout';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcut';
import { useDebounce } from '../../hooks/useDebounce';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useTranslation } from 'react-i18next';

export function CustomerBookingsPage() {
  const { t } = useTranslation();
  usePageTitle(t('My Bookings'));
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [activeActionId, setActiveActionId] = useState(null);
  const [cancelConfirmId, setCancelConfirmId] = useState(null);

  // Keyboard shortcuts
  useKeyboardShortcuts([
    { key: 'd', callback: () => navigate('/customer/dashboard'), meta: true, title: t('Dashboard') },
    { key: 's', callback: () => navigate('/services'), meta: true, title: t('Browse Services') },
  ]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.bookings.customer(),
    queryFn: () => getAllBookings({ viewAs: 'CUSTOMER' }),
    refetchInterval: 30000,
  });

  const cancelMutation = useMutation({
    mutationFn: (id) => cancelBooking(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.bookings.customer() });
      const previous = queryClient.getQueryData(queryKeys.bookings.customer());

      queryClient.setQueryData(queryKeys.bookings.customer(), (current) => {
        if (!current) return current;

        const patchBooking = (booking) =>
          booking?.id === id
            ? {
                ...booking,
                status: 'CANCELLED',
              }
            : booking;

        if (Array.isArray(current)) {
          return current.map(patchBooking);
        }

        if (Array.isArray(current?.bookings)) {
          return {
            ...current,
            bookings: current.bookings.map(patchBooking),
          };
        }

        return current;
      });

      return { previous };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.customer() });
      toast.success(t('Booking cancelled successfully.'));
    },
    onError: (error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.bookings.customer(), context.previous);
      }
      toast.error(error.response?.data?.message || t('Failed to cancel booking'));
    },
  });

  const reviewMutation = useMutation({
    mutationFn: (payload) => createReview(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.customer() });
    },
  });

  const handleBookingAction = async (type, payload) => {
    setActiveActionId(payload.id);
    try {
      if (type === 'CANCEL') {
        setCancelConfirmId(payload.id);
      } else if (type === 'REVIEW') {
        await reviewMutation.mutateAsync(payload);
      }
    } finally {
      setActiveActionId(null);
    }
  };

  const bookings = data?.bookings || [];
  const debouncedSearch = useDebounce(searchQuery);
  const normalizedSearch = debouncedSearch.toLowerCase();
  const filteredBookings = bookings.filter((b) => {
    const serviceName = String(b.service?.name || '').toLowerCase();
    const bookingIdText = String(b.id || '');
    return serviceName.includes(normalizedSearch) || bookingIdText.includes(debouncedSearch);
  });

  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedBookings = filteredBookings.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <MainLayout>
      <div className={`${getPageLayout('default')} module-canvas module-canvas--profile`}>
        {/* Header Block */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <Motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <span className="text-xs font-bold uppercase tracking-widest text-brand-500 mb-2 block">{t('Service History')}</span>
            <h1 className="text-4xl font-bold tracking-tight text-neutral-900 dark:text-white">
              {t('My Bookings')}
            </h1>
          </Motion.div>

          <Motion.div 
            initial={{ opacity: 0, y: -10 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.1 }}
            className="flex items-center gap-3 w-full md:w-auto"
          >
            <div className="flex-1 md:w-80">
              <Input
                icon={Search}
                placeholder={t("Search by service or ID...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="outline" className="h-14 w-14 p-0 rounded-2xl bg-white dark:bg-dark-800 shrink-0 shadow-sm border-none ring-1 ring-black/5 dark:ring-white/10">
              <Filter size={18} />
            </Button>
          </Motion.div>
        </div>

        {/* Global Stats Summary */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <Card className="p-6 flex items-center gap-4 border-none shadow-sm bg-gradient-to-br from-brand-50 to-brand-100/50 dark:from-brand-500/10 dark:to-brand-500/5">
            <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-600 dark:text-brand-400">
              <CalendarDays size={24} />
            </div>
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-0.5">{t('Total Bookings')}</h4>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">{bookings.length}</p>
            </div>
          </Card>
          <Card className="p-6 flex items-center gap-4 border-none shadow-sm bg-gradient-to-br from-success-50 to-success-100/50 dark:from-success-500/10 dark:to-success-500/5">
            <div className="w-12 h-12 rounded-xl bg-success-500/10 flex items-center justify-center text-success-600 dark:text-success-400">
              <Star size={24} />
            </div>
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-0.5">{t('Success Rate')}</h4>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                {bookings.length > 0 ? `${((bookings.filter(b => b.status === 'COMPLETED').length / bookings.length) * 100).toFixed(0)}%` : t('N/A')}
              </p>
            </div>
          </Card>
        </div>

        <AsyncState
          isLoading={isLoading}
          isError={isError}
          error={error}
          onRetry={refetch}
          isEmpty={filteredBookings.length === 0}
          loadingFallback={<div className="space-y-4"><BookingCardSkeleton /><BookingCardSkeleton /></div>}
          emptyTitle={searchQuery ? t("No matches found") : t("No bookings yet")}
          emptyMessage={searchQuery ? t("Try searching for a different service name or ID.") : t("Start your first booking to experience our professional services.")}
          emptyAction={
            <Button size="lg" variant="gradient" onClick={() => navigate('/services')} className="mt-2 text-sm">
              {t('Book a Service')}
            </Button>
          }
        >
          <div className="flex flex-col gap-4 mb-10">
            {paginatedBookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                role="CUSTOMER"
                onAction={handleBookingAction}
                isActionLoading={cancelMutation.isPending || reviewMutation.isPending}
                activeActionId={activeActionId}
              />
            ))}
          </div>
          
          {totalPages > 1 && (
            <div className="flex justify-center">
              <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} totalItems={filteredBookings.length} pageSize={PAGE_SIZE} />
            </div>
          )}
        </AsyncState>

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
          message={t("Are you sure you want to cancel this booking?") + " " + t("Cancellation fees may apply depending on the timing.")}
          confirmText={t("Confirm Cancellation")}
          cancelText={t("Keep Booking")}
          variant="danger"
          loading={cancelMutation.isPending}
        />
      </div>
    </MainLayout>
  );
}
