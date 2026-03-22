import { useMemo, useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, CheckCircle, XCircle, PlayCircle } from 'lucide-react';
import { MainLayout } from '../../components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardDescription } from '../../components/common';
import { Badge, Button, PageHeader, AsyncState, Pagination, ConfirmDialog } from '../../components/common';
import { BookingStatusBadge } from '../../components/common';
import { cancelBooking, getAllBookings, updateBookingStatus } from '../../api/bookings';
import { queryKeys } from '../../utils/queryKeys';
import { getPageLayout } from '../../constants/layout';
import { useSocketEvent } from '../../hooks/useSocket';
import { toast } from 'sonner';
import { usePageTitle } from '../../hooks/usePageTitle';


const statusFilters = ['ALL', 'PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

const formatScheduledDateTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Schedule not set';
  return date.toLocaleString();
};

const optimizePhotoUrl = (value, transform = 'f_auto,q_auto') =>
  String(value || '').replace('/upload/', `/upload/${transform}/`);

export function AdminBookingsPage() {
  usePageTitle('Manage Bookings');
  const [filter, setFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [photoModal, setPhotoModal] = useState(null);
  const queryClient = useQueryClient();

  const bookingsQuery = useQuery({
    queryKey: queryKeys.bookings.admin(),
    queryFn: () => getAllBookings({ viewAs: 'ADMIN' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ bookingId, status }) => updateBookingStatus(bookingId, { status }),
    onSuccess: (_, { status }) => {
      toast.success(`Booking status updated to ${status}`);
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.admin() });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update booking'),
  });

  const cancelMutation = useMutation({
    mutationFn: (bookingId) => cancelBooking(bookingId),
    onSuccess: () => {
      toast.success('Booking cancelled');
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.admin() });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to cancel booking'),
  });

  const bookings = useMemo(() => bookingsQuery.data?.bookings || [], [bookingsQuery.data?.bookings]);

  const refreshAdminBookings = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.bookings.admin() });
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.dashboard() });
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.bookingsPreview() });
  }, [queryClient]);

  useSocketEvent('booking:created', refreshAdminBookings);
  useSocketEvent('booking:status_updated', refreshAdminBookings);

  const filteredBookings = useMemo(() => {
    if (filter === 'ALL') return bookings;
    return bookings.filter((booking) => booking.status === filter);
  }, [bookings, filter]);

  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedBookings = filteredBookings.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const getActions = (booking) => {
    const actions = [];

    if (booking.status === 'PENDING') {
      actions.push({
        label: 'Confirm',
        icon: CheckCircle,
        action: () => updateMutation.mutate({ bookingId: booking.id, status: 'CONFIRMED' }),
      });
    }

    if (booking.status === 'CONFIRMED') {
      actions.push({
        label: 'Start',
        icon: PlayCircle,
        action: () => updateMutation.mutate({ bookingId: booking.id, status: 'IN_PROGRESS' }),
      });
    }

    if (booking.status === 'IN_PROGRESS') {
      actions.push({
        label: 'Complete',
        icon: CheckCircle,
        action: () => updateMutation.mutate({ bookingId: booking.id, status: 'COMPLETED' }),
      });
    }

    if (booking.status !== 'CANCELLED' && booking.status !== 'COMPLETED') {
      actions.push({
        label: 'Cancel',
        icon: XCircle,
        variant: 'outline',
        action: () => setCancelTarget(booking.id),
      });
    }

    return actions;
  };

  return (
    <MainLayout>
      <div className={getPageLayout('default')}>
        <PageHeader
          title="Bookings"
          subtitle="Review and manage all marketplace bookings."
        />

        <div role="radiogroup" aria-label="Booking status filter" className="flex flex-wrap gap-2 mb-6">
          {statusFilters.map((status) => (
            <Button
              key={status}
              size="sm"
              role="radio"
              aria-checked={filter === status}
              variant={filter === status ? 'primary' : 'outline'}
              onClick={() => {
                setFilter(status);
                setPage(1);
              }}
            >
              {status}
            </Button>
          ))}
        </div>

        <AsyncState
          isLoading={bookingsQuery.isLoading}
          isError={bookingsQuery.isError}
          error={bookingsQuery.error}
          isEmpty={!bookingsQuery.isLoading && !bookingsQuery.isError && filteredBookings.length === 0}
          emptyTitle="No bookings for this filter"
          emptyMessage="Try a different status filter to see more results."
        >
          <div className="grid grid-cols-1 gap-5">
            {paginatedBookings.map((booking) => (
              <Card key={booking.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Booking #{booking.id}</CardTitle>
                      <CardDescription>
                        {formatScheduledDateTime(booking.scheduledAt || booking.scheduledDate)}
                      </CardDescription>
                    </div>
                    <BookingStatusBadge status={booking.status} />
                  </div>
                </CardHeader>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CalendarClock size={18} className="text-brand-500" />
                    <span className="text-gray-700 dark:text-gray-300">
                      {booking.service?.name || `Service #${booking.serviceId}`}
                    </span>
                  </div>

                  <div className="text-gray-600 dark:text-gray-400">
                    Customer: {booking.customer?.name || 'Customer'} · Worker: {booking.workerProfile?.user?.name || 'Unassigned'}
                  </div>

                  {booking.photos && booking.photos.length > 0 && (
                    <div className="mt-4 p-4 border rounded-xl bg-gray-50 dark:bg-dark-800/50">
                      <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                        <PlayCircle size={14} className="text-brand-500" />
                        Visual Proof of Work
                      </h4>
                      <div className="flex gap-3 overflow-x-auto pb-2">
                        {booking.photos.filter((photo) => photo?.url).map((photo) => (
                          <button key={photo.id} className="relative w-20 h-20 rounded-lg shrink-0 overflow-hidden border focus:outline-none focus:ring-2 focus:ring-brand-500" onClick={() => setPhotoModal(photo)}>
                            <img src={optimizePhotoUrl(photo.url, 'f_auto,q_auto,w_200')} alt={photo.type} className="w-full h-full object-cover" />
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] font-bold text-center py-0.5">
                              {photo.type}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {getActions(booking).map((action) => (
                    <Button
                      key={action.label}
                      size="sm"
                      variant={action.variant || 'primary'}
                      icon={action.icon}
                      loading={updateMutation.isPending || cancelMutation.isPending}
                      onClick={action.action}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              </Card>
            ))}
          </div>
          <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} totalItems={filteredBookings.length} pageSize={PAGE_SIZE} />
        </AsyncState>

        <ConfirmDialog
          isOpen={cancelTarget !== null}
          onCancel={() => setCancelTarget(null)}
          onConfirm={() => {
            cancelMutation.mutate(cancelTarget);
            setCancelTarget(null);
          }}
          title="Cancel Booking"
          message={`Are you sure you want to cancel booking #${cancelTarget}? This action cannot be undone.`}
          confirmText="Yes, Cancel"
          cancelText="Keep Booking"
          variant="danger"
          loading={cancelMutation.isPending}
        />

        {photoModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setPhotoModal(null)}>
            <div className="bg-white dark:bg-dark-900 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden relative" onClick={e => e.stopPropagation()}>
              <div className="px-6 py-4 border-b dark:border-dark-700 flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2 text-gray-900 dark:text-white">
                  <span className="w-2 h-2 rounded-full bg-brand-500"></span>
                  {photoModal.type === 'BEFORE' ? 'Before Work' : 'After Completion'} Proof
                </h3>
                <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-dark-800 transition-colors" onClick={() => setPhotoModal(null)}>
                  <XCircle size={24} />
                </button>
              </div>
              <div className="bg-gray-100 dark:bg-dark-950/50 flex items-center justify-center p-6" style={{ minHeight: '50vh' }}>
                <img src={optimizePhotoUrl(photoModal.url)} alt={photoModal.type} className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-sm" />
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
