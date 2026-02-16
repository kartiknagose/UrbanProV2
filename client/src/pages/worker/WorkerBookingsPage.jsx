// Worker bookings page
// Manage incoming jobs and update booking statuses

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  CalendarClock,
  MapPin,
  User,
  CheckCircle,
  XCircle,
  PlayCircle,
  ShieldAlert,
  Briefcase,
  ChevronDown,
  Clock,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { MainLayout } from '../../components/layout/MainLayout';
import { Card, Badge, Button, PageHeader, AsyncState, Modal, Input, ImageUpload } from '../../components/common';
import { useTheme } from '../../context/ThemeContext';
import {
  getAllBookings,
  updateBookingStatus,
  cancelBooking,
  verifyBookingStart,
  verifyBookingCompletion
} from '../../api/bookings';
import { uploadBookingPhoto } from '../../api/uploads';
import { UserMiniProfile } from '../../components/features/bookings/UserMiniProfile';
import { queryKeys } from '../../utils/queryKeys';
import { getBookingStatusVariant } from '../../utils/statusHelpers';
import { toast } from 'sonner';

const statusFilters = ['ALL', 'PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

export function WorkerBookingsPage() {
  const queryClient = useQueryClient();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('ALL');
  const [expandedId, setExpandedId] = useState(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [activeBookingId, setActiveBookingId] = useState(null);

  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const [otpAction, setOtpAction] = useState(null); // 'start' or 'complete'
  const [otpCode, setOtpCode] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const bookingsQuery = useQuery({
    queryKey: queryKeys.bookings.worker(),
    queryFn: () => getAllBookings({ viewAs: 'WORKER' }),
    refetchInterval: 30000, // Poll every 30s to catch new bookings
  });

  const updateMutation = useMutation({
    mutationFn: ({ bookingId, status }) => updateBookingStatus(bookingId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.worker() });
      toast.success('Booking updated successfully');
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Update failed'),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ bookingId, reason }) => cancelBooking(bookingId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.worker() });
      toast.success('Booking status updated');
      setIsCancelModalOpen(false);
      setCancelReason('');
      setActiveBookingId(null);
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Update failed'),
  });

  const handleCancelClick = (bookingId) => {
    setActiveBookingId(bookingId);
    setCancelReason('');
    setIsCancelModalOpen(true);
  };

  const handleCancelSubmit = () => {
    if (!cancelReason.trim()) return;
    cancelMutation.mutate({ bookingId: activeBookingId, reason: cancelReason });
  };

  const verifyStartMutation = useMutation({
    mutationFn: ({ bookingId, otp, photoUrl }) => verifyBookingStart(bookingId, { otp, photoUrl }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.worker() });
      toast.success('Job started successfully!');
      setIsOtpModalOpen(false);
      resetOtpForm();
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Verification failed'),
  });

  const verifyCompleteMutation = useMutation({
    mutationFn: ({ bookingId, otp, photoUrl }) => verifyBookingCompletion(bookingId, { otp, photoUrl }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.worker() });
      toast.success('Job completed successfully!');
      setIsOtpModalOpen(false);
      resetOtpForm();
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Verification failed'),
  });

  const resetOtpForm = () => {
    setOtpCode('');
    setSelectedFile(null);
    setSelectedBookingId(null);
    setOtpAction(null);
  };

  const handleOtpSubmit = async () => {
    if (!selectedFile) return toast.error('Please upload a photo first');
    if (!otpCode) return toast.error('Please enter the verification code');

    try {
      setIsUploading(true);
      const photoUrl = await uploadBookingPhoto(selectedFile);

      if (otpAction === 'start') {
        verifyStartMutation.mutate({ bookingId: selectedBookingId, otp: otpCode, photoUrl });
      } else {
        verifyCompleteMutation.mutate({ bookingId: selectedBookingId, otp: otpCode, photoUrl });
      }
    } catch (error) {
      toast.error('Failed to upload photo');
    } finally {
      setIsUploading(false);
    }
  };

  const bookings = bookingsQuery.data?.bookings || [];

  const filteredBookings = useMemo(() => {
    if (filter === 'ALL') return bookings;
    return bookings.filter(b => b.status === filter);
  }, [bookings, filter]);

  const getActions = (booking) => {
    const actions = [];
    if (booking.status === 'PENDING') {
      actions.push({
        label: 'Confirm',
        icon: CheckCircle,
        action: () => updateMutation.mutate({ bookingId: booking.id, status: 'CONFIRMED' })
      });
      actions.push({
        label: 'Reject',
        icon: XCircle,
        action: () => handleCancelClick(booking.id)
      });
    }
    if (booking.status === 'CONFIRMED') {
      actions.push({
        label: 'Start Job',
        icon: PlayCircle,
        action: () => {
          setSelectedBookingId(booking.id);
          setOtpAction('start');
          setIsOtpModalOpen(true);
        }
      });
      actions.push({
        label: 'Cancel',
        icon: XCircle,
        action: () => handleCancelClick(booking.id)
      });
    }
    if (booking.status === 'IN_PROGRESS') {
      actions.push({
        label: 'Complete Job',
        icon: CheckCircle,
        action: () => {
          setSelectedBookingId(booking.id);
          setOtpAction('complete');
          setIsOtpModalOpen(true);
        }
      });
    }
    return actions;
  };

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <PageHeader
          title="Job Management"
          subtitle="Manage your schedules, earnings and active works."
        />

        <div className="flex overflow-x-auto gap-2 mb-8 pb-2 no-scrollbar">
          {statusFilters.map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'primary' : 'outline'}
              onClick={() => setFilter(f)}
              className="whitespace-nowrap rounded-full px-5"
            >
              {f}
            </Button>
          ))}
        </div>

        <AsyncState
          isLoading={bookingsQuery.isLoading}
          isError={bookingsQuery.isError}
          error={bookingsQuery.error}
          onRetry={bookingsQuery.refetch}
          isEmpty={!bookingsQuery.isLoading && !bookingsQuery.isError && filteredBookings.length === 0}
          emptyTitle="No jobs found"
          emptyMessage={`You don't have any jobs with status: ${filter}`}
          errorFallback={
            <Card className="p-6">
              <p className="text-error-500 mb-3 font-medium">
                {bookingsQuery.error?.response?.data?.error || bookingsQuery.error?.message || 'Failed to load bookings.'}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button size="sm" onClick={() => bookingsQuery.refetch()}>
                  Retry
                </Button>
                <Button size="sm" variant="outline" onClick={() => navigate('/system-status')}>
                  Check System Status
                </Button>
              </div>
            </Card>
          }
        >
          <div className="grid grid-cols-1 gap-3">
            {filteredBookings.map((booking) => {
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
                    <div className={`p-2 rounded-lg shrink-0 ${isDark ? 'bg-brand-900/20 text-brand-400' : 'bg-brand-50 text-brand-600'}`}>
                      <CalendarClock size={18} />
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
                          ₹{booking.totalPrice || booking.estimatedPrice || booking.service?.basePrice || '0'}
                        </p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter sm:hidden">Payout</p>
                      </div>

                      <div className="hidden sm:block text-right">
                        <Badge size="sm" variant="outline" className="text-[10px] py-0">
                          {new Date(booking.scheduledAt || booking.scheduledDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Badge>
                      </div>
                    </div>

                    <div className={`p-1.5 rounded-full transition-transform duration-300 ${isExpanded ? 'rotate-180 bg-brand-500 text-white' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-800'}`}>
                      <ChevronDown size={16} />
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className={`p-4 sm:p-5 border-t space-y-5 animate-in slide-in-from-top duration-300 ${isDark ? 'border-dark-700/50 bg-dark-900/20' : 'border-gray-100 bg-white'}`}>

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
                            {booking.addressDetails || booking.address || 'No address provided'}
                          </span>
                        </div>
                      </div>


                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Customer Info */}
                        <div className="space-y-3">
                          <UserMiniProfile
                            user={booking.customer}
                            label="Customer"
                            showContact={booking.status !== 'CANCELLED'}
                          />
                        </div>

                        {/* Status Info / Next Steps */}
                        <div className={`p-4 rounded-xl border flex items-center gap-4 ${isDark ? 'bg-dark-800/20 border-dark-700' : 'bg-gray-50 border-gray-100'}`}>
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark ? 'bg-brand-900/30 text-brand-400' : 'bg-brand-50 text-brand-600'}`}>
                            <ShieldAlert size={20} />
                          </div>
                          <div>
                            <p className="text-xs font-black uppercase text-gray-500">Service Status</p>
                            <p className={`text-sm font-bold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                              {booking.status === 'PENDING' ? 'Waiting for your confirmation' :
                                booking.status === 'CONFIRMED' ? 'Ready to start the job' :
                                  booking.status === 'IN_PROGRESS' ? 'Job currently being performed' :
                                    booking.status === 'CANCELLED' ? 'Job cancelled/rejected' : 'Service record archived'}
                            </p>
                          </div>
                          {booking.status === 'CANCELLED' && booking.cancellationReason && (
                            <div className={`p-3 rounded-xl flex items-start gap-3 border ${isDark ? 'bg-error-950/10 border-error-900/20' : 'bg-error-50 border-error-100'}`}>
                              <AlertCircle size={14} className="text-error-500 shrink-0 mt-0.5" />
                              <p className={`text-xs ${isDark ? 'text-error-400' : 'text-error-700'}`}>
                                <span className="font-black uppercase text-[9px] block mb-0.5 tracking-tighter opacity-70">Reason for Cancellation</span>
                                <span className="font-semibold">{booking.cancellationReason}</span>
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-5 border-t border-gray-100 dark:border-dark-800">
                        <div className="flex items-center gap-2">
                          {getActions(booking).map((action, idx) => (
                            <Button
                              key={idx}
                              size="sm"
                              icon={action.icon}
                              onClick={(e) => { e.stopPropagation(); action.action(); }}
                              className={action.label === 'Confirm' ? 'bg-brand-600 text-white px-6' : 'bg-gray-100 text-gray-700 dark:bg-dark-700 dark:text-gray-300'}
                            >
                              {action.label}
                            </Button>
                          ))}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="px-2"
                            onClick={(e) => { e.stopPropagation(); navigate(`/worker/bookings/${booking.id}`); }}
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
        isOpen={isOtpModalOpen}
        onClose={() => setIsOtpModalOpen(false)}
        title={otpAction === 'start' ? 'Start Verification' : 'Completion Verification'}
        size="sm"
      >
        <div className="space-y-4">
          <div className="p-4 bg-brand-50 border border-brand-100 rounded-xl">
            <p className="text-sm text-brand-800 font-medium">
              Step 1: Upload Proof
            </p>
            <p className="text-xs text-brand-600 mt-1">
              A {otpAction === 'start' ? 'BEFORE' : 'AFTER'} photo is required to resolve any future disputes.
            </p>
          </div>

          <ImageUpload
            label={otpAction === 'start' ? "Photo of work area before starting" : "Photo of completed work"}
            onUpload={setSelectedFile}
            value={selectedFile}
          />

          <div className="border-t border-gray-100 pt-6">
            <p className="text-sm text-gray-700 font-medium mb-1">
              Step 2: Enter Verification Code
            </p>
            <p className="text-xs text-gray-500 mb-3">
              Ask the customer for the code displayed on their dashboard.
            </p>

            <Input
              placeholder="e.g. 1234"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              maxLength={6}
              className="text-center text-2xl tracking-widest font-bold"
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setIsOtpModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleOtpSubmit}
              loading={verifyStartMutation.isPending || verifyCompleteMutation.isPending || isUploading}
              disabled={!selectedFile || !otpCode}
            >
              Verify & {otpAction === 'start' ? 'Start' : 'Complete'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Cancellation Reason Modal */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title="Reason for Cancellation"
        size="sm"
      >
        <div className="space-y-4">
          <div className={`p-4 rounded-xl flex items-center gap-4 bg-error-50 dark:bg-error-950/20 text-error-600`}>
            <ShieldAlert size={24} />
            <p className="text-sm font-bold leading-tight">Please provide a reason for cancelling or rejecting this job.</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase text-gray-500 tracking-widest pl-1">Cancellation Reason</label>
            <Input
              placeholder="e.g., Scheduling conflict, out of specialized tools..."
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
              Confirm Cancellation
            </Button>
          </div>
        </div>
      </Modal>
    </MainLayout >
  );
}
