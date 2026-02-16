// Customer bookings page
// Lists all bookings for the logged-in customer

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  MapPin,
  Briefcase,
  User,
  ShieldAlert,
  ChevronDown,
  Clock,
  CalendarClock,
  XCircle,
  AlertCircle
} from 'lucide-react';

import { MainLayout } from '../../components/layout/MainLayout';
import { Card, Badge, Button, PageHeader, AsyncState, Modal, Input } from '../../components/common';
import { useTheme } from '../../context/ThemeContext';
import { cancelBooking, getAllBookings, payBooking } from '../../api/bookings';
import { queryKeys } from '../../utils/queryKeys';
import { getBookingStatusVariant, getPaymentStatusVariant } from '../../utils/statusHelpers';
import { UserMiniProfile } from '../../components/features/bookings/UserMiniProfile';

export function CustomerBookingsPage() {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [activeBookingId, setActiveBookingId] = useState(null);

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.bookings.customer(),
    queryFn: () => getAllBookings({ viewAs: 'CUSTOMER' }),
    refetchInterval: 30000, // Poll every 30s
  });

  const cancelMutation = useMutation({
    mutationFn: ({ bookingId, reason }) => cancelBooking(bookingId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.customer() });
      setIsCancelModalOpen(false);
      setCancelReason('');
      setActiveBookingId(null);
    },
  });

  const handleCancelClick = (e, bookingId) => {
    e.stopPropagation();
    setActiveBookingId(bookingId);
    setCancelReason('');
    setIsCancelModalOpen(true);
  };

  const handleCancelSubmit = () => {
    if (!cancelReason.trim()) return;
    cancelMutation.mutate({ bookingId: activeBookingId, reason: cancelReason });
  };

  const payMutation = useMutation({
    mutationFn: (bookingId) => payBooking(bookingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.customer() });
    },
  });

  const bookings = data?.bookings || [];

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <PageHeader
          title="My Bookings"
          subtitle="Track and manage your service appointments."
        />

        <AsyncState
          isLoading={isLoading}
          isError={isError}
          error={error}
          onRetry={refetch}
          isEmpty={!isLoading && !isError && bookings.length === 0}
          emptyTitle="No bookings yet"
          emptyMessage="Once you book a service, it will appear here."
          emptyAction={
            <Button size="sm" variant="outline" onClick={() => navigate('/services')}>
              Browse Services
            </Button>
          }
        >
          <div className="grid grid-cols-1 gap-3">
            {bookings.map((booking) => {
              const isExpanded = expandedId === booking.id;

              return (
                <Card
                  key={booking.id}
                  className={`overflow-hidden border-none ring-1 transition-all duration-300 ${isExpanded ? 'ring-brand-500/30 shadow-xl' : 'ring-black/5 dark:ring-white/10 shadow-sm hover:shadow-md'}`}
                >
                  {/* Collapsed View / Card Header */}
                  <div
                    className={`p-3 sm:p-4 cursor-pointer flex items-center gap-4 ${isExpanded && (isDark ? 'bg-brand-900/10' : 'bg-brand-50/50')}`}
                    onClick={() => toggleExpand(booking.id)}
                  >
                    <div className={`p-2 rounded-lg shrink-0 ${isDark ? 'bg-dark-800 text-brand-400' : 'bg-brand-50 text-brand-600'}`}>
                      <Briefcase size={18} />
                    </div>

                    <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-4 items-center">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-black text-sm">Job #{booking.id}</h3>
                          <Badge size="sm" variant={getBookingStatusVariant(booking.status)}>
                            {booking.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <p className={`text-[10px] sm:text-xs font-medium truncate ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          {booking.service?.name || `Service #${booking.serviceId}`}
                        </p>
                      </div>

                      <div className="hidden sm:flex items-center gap-2">
                        <Clock size={14} className="text-gray-400" />
                        <span className={`text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                          {new Date(booking.scheduledAt || booking.scheduledDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      </div>

                      <div className="text-right sm:text-left">
                        <p className={`text-xs font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          ₹{booking.totalPrice || booking.estimatedPrice || '0'}
                        </p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter sm:hidden">Total</p>
                      </div>

                      <div className="hidden sm:block text-right">
                        {(booking.paymentStatus === 'PAID' || ['COMPLETED', 'CANCELLED'].includes(booking.status)) && (
                          <Badge size="sm" variant={getPaymentStatusVariant(booking.paymentStatus || 'PENDING')}>
                            {booking.paymentStatus || 'PENDING'}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className={`p-1.5 rounded-full transition-transform duration-300 ${isExpanded ? 'rotate-180 bg-brand-500 text-white' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-800'}`}>
                      <ChevronDown size={16} />
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className={`p-4 sm:p-5 border-t space-y-5 animate-in slide-in-from-top duration-300 ${isDark ? 'border-dark-700/50 bg-dark-900/20' : 'border-gray-100 bg-white'}`}>

                      {/* Detailed Strip */}
                      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                        <div className="flex-1 w-full flex items-center gap-3">
                          <Calendar size={16} className="text-brand-500 shrink-0" />
                          <span className={`text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                            Scheduled for {new Date(booking.scheduledAt || booking.scheduledDate).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' })}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 w-full sm:w-auto p-2 rounded-lg bg-gray-50 dark:bg-dark-800">
                          <MapPin size={16} className="text-success-500 shrink-0" />
                          <span className={`text-xs font-medium truncate ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {booking.addressDetails || booking.address || 'No address'}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Worker Info */}
                        <div className="space-y-3">
                          {booking.workerProfile ? (
                            <UserMiniProfile
                              user={booking.workerProfile.user}
                              label="Assigned Professional"
                              showContact={['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(booking.status)}
                            />
                          ) : (
                            <div className={`flex flex-col items-center justify-center p-6 rounded-xl border border-dashed text-center min-h-[120px] ${isDark ? 'bg-accent-950/10 border-accent-900/50' : 'bg-accent-50/50 border-accent-100'}`}>
                              <User size={24} className="text-accent-400 animate-pulse mb-2" />
                              <p className="text-sm font-black text-accent-600">Finding the best match...</p>
                              <p className="text-[10px] text-accent-500/70 mt-1">We'll notify you as soon as a worker accepts</p>
                            </div>
                          )}
                        </div>

                        {/* OTP Banner */}
                        <div className="space-y-3">
                          {((booking.status === 'CONFIRMED' && booking.startOtp) || (booking.status === 'IN_PROGRESS' && booking.completionOtp)) ? (
                            <div className={`relative px-5 py-4 rounded-2xl border flex items-center justify-between overflow-hidden ${booking.status === 'CONFIRMED' ? (isDark ? 'bg-brand-950/40 border-brand-800' : 'bg-brand-50 border-brand-100') : (isDark ? 'bg-success-950/40 border-success-800' : 'bg-success-50 border-success-100')}`}>
                              <div className="relative z-10">
                                <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-1 ${booking.status === 'CONFIRMED' ? 'text-brand-500' : 'text-success-500'}`}>
                                  {booking.status === 'CONFIRMED' ? 'Share to Start Job' : 'Share to Complete Job'}
                                </p>
                                <p className={`text-4xl font-black tracking-[0.3em] font-mono ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                  {booking.status === 'CONFIRMED' ? booking.startOtp : booking.completionOtp}
                                </p>
                              </div>
                              <ShieldAlert className={`absolute -right-4 -bottom-4 w-24 h-24 opacity-10 ${booking.status === 'CONFIRMED' ? 'text-brand-500' : 'text-success-500'}`} />
                              <div className={`p-3 rounded-xl ${booking.status === 'CONFIRMED' ? 'bg-brand-500' : 'bg-success-500'} text-white shadow-lg`}>
                                <ShieldAlert size={20} />
                              </div>
                            </div>
                          ) : (
                            <div className={`p-5 rounded-2xl border border-dashed flex items-center justify-center min-h-[100px] ${isDark ? 'bg-dark-800/20 border-dark-700' : 'bg-gray-50 border-gray-200'}`}>
                              <p className="text-sm font-medium text-gray-500 italic">No security code required at this stage.</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-5 border-t border-gray-100 dark:border-dark-800">
                        <div className="flex-1 w-full">
                          {booking.notes && (
                            <div className="flex gap-2 min-w-0">
                              <div className="w-1 h-8 bg-brand-500 rounded-full shrink-0" />
                              <p className={`text-xs italic leading-snug ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
                                <span className="font-bold not-italic mr-1 text-[10px] uppercase">Note:</span>
                                {booking.notes}
                              </p>
                            </div>
                          )}
                          {booking.status === 'CANCELLED' && booking.cancellationReason && (
                            <div className={`mt-2 p-3 rounded-xl flex items-start gap-3 border ${isDark ? 'bg-error-950/10 border-error-900/20' : 'bg-error-50 border-error-100'}`}>
                              <AlertCircle size={14} className="text-error-500 shrink-0 mt-0.5" />
                              <p className={`text-xs ${isDark ? 'text-error-400' : 'text-error-700'}`}>
                                <span className="font-black uppercase text-[9px] block mb-0.5 tracking-tighter opacity-70">Cancellation Reason</span>
                                <span className="font-semibold">{booking.cancellationReason}</span>
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {booking.status === 'COMPLETED' && booking.paymentStatus !== 'PAID' && (
                            <Button
                              size="md"
                              loading={payMutation.isPending}
                              onClick={(e) => { e.stopPropagation(); payMutation.mutate(booking.id); }}
                              className="bg-brand-600 hover:bg-brand-700 text-white shadow-xl shadow-brand-500/20 px-8"
                            >
                              Pay Now
                            </Button>
                          )}

                          {booking.status !== 'CANCELLED' && booking.status !== 'COMPLETED' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-gray-400 hover:text-error-500 px-4"
                              loading={cancelMutation.isPending && activeBookingId === booking.id}
                              onClick={(e) => handleCancelClick(e, booking.id)}
                            >
                              Cancel Booking
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="ghost"
                            className="font-black uppercase text-[10px] tracking-widest"
                            onClick={(e) => { e.stopPropagation(); navigate(`/bookings/${booking.id}`); }}
                          >
                            Go to Details
                          </Button>

                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </AsyncState>
      </div>

      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title="Cancel Booking"
        size="sm"
      >
        <div className="space-y-4">
          <div className={`p-4 rounded-xl flex items-center gap-4 bg-error-50 dark:bg-error-950/20 text-error-600`}>
            <ShieldAlert size={24} />
            <p className="text-sm font-bold leading-tight">Are you sure you want to cancel? This action cannot be undone.</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase text-gray-500 tracking-widest pl-1">Reason for Cancellation</label>
            <Input
              placeholder="e.g., Change of plans, found better price..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="h-12 text-sm"
              autoFocus
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              fullWidth
              variant="ghost"
              onClick={() => setIsCancelModalOpen(false)}
            >
              Go Back
            </Button>
            <Button
              fullWidth
              className="bg-error-600 text-white hover:bg-error-700"
              onClick={handleCancelSubmit}
              disabled={!cancelReason.trim()}
              loading={cancelMutation.isPending}
            >
              Abort Booking
            </Button>
          </div>
        </div>
      </Modal>
    </MainLayout>
  );
}
