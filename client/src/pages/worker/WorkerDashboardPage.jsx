// Worker dashboard page
// Shows job summary and recent bookings for the worker

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Briefcase,
  Wallet,
  Clock,
  CalendarCheck,
  Star,
  ShieldCheck,
  CheckCircle,
  Activity,
  Calendar,
  DollarSign,
  Target,
  MapPin,
  ChevronRight,
  User,
  AlertCircle,
  XCircle,
  PlayCircle,
  ShieldAlert,
  Image as ImageIcon
} from 'lucide-react';
import { MainLayout } from '../../components/layout/MainLayout';
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Badge,
  StatCard,
  Skeleton,
  AsyncState,
  Spinner,
  SimpleBarChart,
  SimpleDonutChart,
  Modal,
  Input,
  ImageUpload
} from '../../components/common';

import { useTheme } from '../../context/ThemeContext';
import { getAllBookings, updateBookingStatus, cancelBooking, getOpenBookings, acceptBooking, verifyBookingStart, verifyBookingCompletion } from '../../api/bookings';
import { getMyAvailability } from '../../api/availability';
import { getMyServices, getMyWorkerProfile } from '../../api/workers';
import { uploadBookingPhoto } from '../../api/uploads';
import { queryKeys } from '../../utils/queryKeys';
import { getBookingStatusVariant } from '../../utils/statusHelpers';


export function WorkerDashboardPage() {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [activeBookingId, setActiveBookingId] = useState(null);

  // OTP Verification State
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const [otpAction, setOtpAction] = useState(null); // 'start' or 'complete'
  const [otpCode, setOtpCode] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.bookings.worker(),
    queryFn: getAllBookings,
    refetchInterval: 30000, // Poll every 30s to catch new direct bookings
  });

  const { data: profileData } = useQuery({
    queryKey: ['worker-profile'],
    queryFn: getMyWorkerProfile,
  });
  const profile = profileData?.profile;

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => updateBookingStatus(id, { status }),
    onSuccess: (_, variables) => {
      const labels = { CONFIRMED: 'accepted', IN_PROGRESS: 'started', COMPLETED: 'completed' };
      toast.success(`Job ${labels[variables.status] || 'updated'} successfully!`);
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.worker() });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.error || 'Failed to update booking status.');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id) => cancelBooking(id, cancelReason),
    onSuccess: () => {
      toast.success('Booking updated successfully.');
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.worker() });
      setIsCancelModalOpen(false);
      setCancelReason('');
      setActiveBookingId(null);
    },
    onError: (err) => {
      toast.error(err?.response?.data?.error || 'Failed to update booking.');
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
    cancelMutation.mutate(activeBookingId);
  };

  // Query for Open Jobs (Job Board)
  const { data: openJobsData, refetch: refetchOpenJobs } = useQuery({
    queryKey: ['open-bookings'],
    queryFn: getOpenBookings,
  });

  const acceptJobMutation = useMutation({
    mutationFn: (id) => acceptBooking(id),
    onSuccess: () => {
      toast.success('Job accepted! You can now see customer details.');
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.worker() });
      queryClient.invalidateQueries({ queryKey: ['open-bookings'] });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.error || 'Failed to accept job.');
    },
  });

  // Verification Mutations
  const verifyStartMutation = useMutation({
    mutationFn: ({ bookingId, otp }) => verifyBookingStart(bookingId, otp),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.worker() });
      setIsOtpModalOpen(false);
      setOtpCode('');
      setSelectedFile(null);
      toast.success('Job started successfully!');
    },
    onError: (error) => toast.error(error.response?.data?.message || error.message || 'Invalid OTP'),
  });

  const verifyCompleteMutation = useMutation({
    mutationFn: ({ bookingId, otp }) => verifyBookingCompletion(bookingId, otp),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.worker() });
      setIsOtpModalOpen(false);
      setOtpCode('');
      setSelectedFile(null);
      toast.success('Job completed successfully!');
    },
    onError: (error) => toast.error(error.response?.data?.message || error.message || 'Invalid OTP'),
  });

  const handleOtpSubmit = async () => {
    if (!selectedFile) {
      toast.error(`Please upload a ${otpAction === 'start' ? 'BEFORE' : 'AFTER'} photo as proof.`);
      return;
    }

    if (!otpCode || otpCode.length < 4) {
      toast.error('Please enter a valid OTP');
      return;
    }

    setIsUploading(true);
    try {
      const type = otpAction === 'start' ? 'BEFORE' : 'AFTER';
      await uploadBookingPhoto(selectedFile, selectedBookingId, type);

      if (otpAction === 'start') {
        verifyStartMutation.mutate({ bookingId: selectedBookingId, otp: otpCode });
      } else if (otpAction === 'complete') {
        verifyCompleteMutation.mutate({ bookingId: selectedBookingId, otp: otpCode });
      }
    } catch (error) {
      toast.error('Failed to upload photo proof. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const openOtpModal = (bookingId, action) => {
    setSelectedBookingId(bookingId);
    setOtpAction(action);
    setOtpCode('');
    setSelectedFile(null);
    setIsOtpModalOpen(true);
  };

  const openJobs = openJobsData?.bookings || [];
  const bookings = data?.bookings || [];

  // Stats Calculation
  const stats = useMemo(() => {
    const totalJobs = bookings.length;
    const completedJobs = bookings.filter((b) => b.status === 'COMPLETED').length;
    const pendingJobs = bookings.filter((b) => ['PENDING', 'CONFIRMED', 'IN_PROGRESS'].includes(b.status)).length;
    const totalEarnings = bookings
      .filter((b) => b.status === 'COMPLETED')
      .reduce((sum, b) => sum + (Number(b.totalPrice) || 0), 0);

    // Calculate rating (mock based on profile if available, else standard)
    const rating = profile?.rating || 0;

    return [
      { title: 'Total Earnings', value: `₹${totalEarnings.toFixed(0)}`, icon: Wallet, color: 'brand', trend: { value: 12, direction: 'up', label: 'vs last week' } },
      { title: 'Active Jobs', value: pendingJobs, icon: Activity, color: 'info' },
      { title: 'Completed Jobs', value: completedJobs, icon: CheckCircle, color: 'success' },
      { title: 'Rating', value: rating ? rating.toFixed(1) : 'New', icon: Star, color: 'warning' },
    ];
  }, [bookings, profile]);

  const chartData = useMemo(() => {
    // Earnings (Last 7 Days)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d;
    });

    const earningsData = last7Days.map(date => {
      const dateString = date.toISOString().split('T')[0];
      const dailyTotal = bookings
        .filter(b => {
          if (b.status !== 'COMPLETED') return false;
          // Use scheduledDate as the reference date
          if (!b.scheduledDate) return false;
          const bookingDate = new Date(b.scheduledDate).toISOString().split('T')[0];
          return bookingDate === dateString;
        })
        .reduce((sum, b) => sum + (Number(b.totalPrice) || 0), 0);

      return {
        label: date.toLocaleDateString('en-US', { weekday: 'short' }),
        value: dailyTotal,
        tooltip: `₹${dailyTotal}`
      };
    });

    // Job Status Distribution
    const activeJobsCount = bookings.filter(b => ['PENDING', 'CONFIRMED', 'IN_PROGRESS'].includes(b.status)).length;
    const completedCount = bookings.filter(b => b.status === 'COMPLETED').length;
    const cancelledCount = bookings.filter(b => ['CANCELLED', 'REJECTED'].includes(b.status)).length;

    const statusData = [
      { label: 'Completed', value: completedCount, color: '#10b981' }, // emerald-500
      { label: 'Active', value: activeJobsCount, color: '#3b82f6' },    // blue-500
      { label: 'Cancelled', value: cancelledCount, color: '#ef4444' }   // red-500
    ];

    return { earningsData, statusData };
  }, [bookings]);

  const activeBookings = bookings
    .filter(b => ['PENDING', 'CONFIRMED', 'IN_PROGRESS'].includes(b.status))
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
    .slice(0, 5);

  return (
    <MainLayout>
      <div className={`min-h-screen pb-20 ${isDark ? 'bg-dark-950' : 'bg-gray-50'}`}>

        {/* Welcome Header */}
        <div className={`pt-12 pb-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden ${isDark ? 'bg-gradient-to-r from-brand-900 via-dark-900 to-dark-950' : 'bg-gradient-to-r from-brand-600 via-brand-500 to-accent-500'}`}>
          <div className="absolute inset-0 bg-[url('/pattern.svg')] opacity-10"></div>
          <div className="max-w-7xl mx-auto relative z-10 text-white">
            <div className="flex justify-between items-end">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold mb-2">Welcome back, {profile?.user?.name || 'Pro'}!</h1>
                <p className="text-brand-100 text-lg max-w-2xl">
                  Here's what's happening with your business today. You have {activeBookings.length} active jobs.
                </p>
              </div>
              <Button
                variant="outline"
                className="hidden sm:flex bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm"
                onClick={() => navigate('/worker/availability')}
              >
                <Clock size={16} className="mr-2" /> Manage Availability
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-20">

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
            {stats.map((stat, index) => (
              <StatCard
                key={index}
                title={stat.title}
                value={stat.value}
                icon={stat.icon}
                color={stat.color}
                trend={stat.trend}
                delay={index}
                onClick={stat.title === 'Rating' ? () => navigate('/worker/reviews') : undefined}
                className={`shadow-lg border-none ring-1 ring-black/5 dark:ring-white/5 ${stat.title === 'Rating' ? 'cursor-pointer' : ''}`}
              />
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <SimpleBarChart
              title="Weekly Earnings"
              data={chartData.earningsData}
              height="h-64"
            />
            <SimpleDonutChart
              title="Job Status Overview"
              data={chartData.statusData}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Main Column: Jobs */}
            <div className="lg:col-span-2 space-y-8">

              {/* Active Jobs Section */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className={`text-xl font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    <Briefcase className="text-brand-500" size={20} /> Active Jobs
                  </h2>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/worker/bookings')}>View All</Button>
                </div>

                {isLoading ? (
                  <div className="space-y-4">
                    {[1, 2].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
                  </div>
                ) : activeBookings.length > 0 ? (
                  <div className="space-y-4">
                    {activeBookings.map((booking) => (
                      <div
                        key={booking.id}
                        onClick={() => navigate(`/worker/bookings/${booking.id}`)}
                        className={`p-6 rounded-2xl border transition-all duration-300 cursor-pointer group hover:shadow-xl active:scale-[0.98] ${isDark ? 'bg-dark-800 border-dark-700 hover:border-brand-500/50' : 'bg-white border-gray-100 hover:border-brand-500/30'}`}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isDark ? 'bg-brand-900/30 text-brand-400' : 'bg-brand-50 text-brand-600'}`}>
                              <CalendarCheck size={24} />
                            </div>
                            <div>
                              <h3 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>{booking.service?.name}</h3>
                              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mt-1">
                                <User size={14} /> {booking.customer?.name}
                              </div>
                            </div>
                          </div>
                          <Badge variant={getBookingStatusVariant(booking.status)}>
                            {booking.status.replace('_', ' ')}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 pl-16">
                          <div className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300">
                            <Calendar size={16} className="text-brand-500" />
                            {new Date(booking.scheduledAt || booking.scheduledDate).toLocaleDateString()} at {new Date(booking.scheduledAt || booking.scheduledDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                            <MapPin size={16} className="text-success-500" />
                            <span className="truncate">{booking.address || booking.addressDetails}</span>
                          </div>
                        </div>


                        <div className="pl-16 flex flex-wrap gap-3">
                          {booking.status === 'PENDING' && (
                            <>
                              <Button
                                size="sm"
                                icon={CheckCircle}
                                onClick={(e) => { e.stopPropagation(); statusMutation.mutate({ id: booking.id, status: 'CONFIRMED' }); }}
                                className="bg-accent-600 text-white hover:bg-accent-700"
                              >
                                Confirm Job
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                icon={XCircle}
                                onClick={(e) => handleCancelClick(e, booking.id)}
                                loading={cancelMutation.isPending && activeBookingId === booking.id}
                                className="text-error-500 hover:bg-error-50"
                              >
                                Reject
                              </Button>
                            </>
                          )}
                          {booking.status === 'CONFIRMED' && (
                            <>
                              <Button
                                size="sm"
                                icon={PlayCircle}
                                onClick={(e) => { e.stopPropagation(); openOtpModal(booking.id, 'start'); }}
                                className="bg-brand-600 text-white hover:bg-brand-700"
                              >
                                Start Job
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                icon={XCircle}
                                onClick={(e) => handleCancelClick(e, booking.id)}
                                loading={cancelMutation.isPending && activeBookingId === booking.id}
                                className="text-error-500 hover:bg-error-50"
                              >
                                Cancel Job
                              </Button>
                            </>
                          )}
                          {booking.status === 'IN_PROGRESS' && (
                            <Button
                              size="sm"
                              icon={CheckCircle}
                              onClick={(e) => { e.stopPropagation(); openOtpModal(booking.id, 'complete'); }}
                              className="bg-green-600 text-white hover:bg-green-700"
                            >
                              Complete Job
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={`text-center py-12 rounded-2xl border border-dashed ${isDark ? 'border-dark-700 bg-dark-800/50' : 'border-gray-200 bg-gray-50'}`}>
                    <Briefcase className="mx-auto text-gray-400 mb-2" size={32} />
                    <h3 className={`text-lg font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>No active jobs</h3>
                    <p className="text-gray-500">Check the Open Requests tab to find work.</p>
                  </div>
                )}
              </section>

              {/* Open Requests Section */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className={`text-xl font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    <Target className="text-accent-500" size={20} /> Open Requests
                  </h2>
                  <Button variant="ghost" size="sm" onClick={() => refetchOpenJobs()}>Refresh</Button>
                </div>

                {openJobs.length > 0 ? (
                  <div className="space-y-4">
                    {openJobs.map((job) => (
                      <Card key={job.id} className="group overflow-hidden hover:shadow-2xl hover:shadow-brand-500/10 transition-all duration-300 border-none ring-1 ring-black/5 dark:ring-white/10 relative">
                        {/* Decorative Gradient Background */}
                        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-accent-500 to-brand-500" />

                        <div className="p-6">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h3 className={`font-bold text-xl mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {job.service?.name}
                              </h3>
                              <div className="flex items-center gap-3">
                                <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest text-accent-600 border-accent-200 bg-accent-50 dark:bg-accent-900/20 dark:border-accent-800">
                                  New Request
                                </Badge>
                                <span className={`text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                  ID: #{job.id}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className={`block text-xs uppercase tracking-tighter font-bold ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Est. Payout</span>
                              <span className={`text-2xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                ₹{job.totalPrice || job.estimatedPrice || job.service?.basePrice}
                              </span>
                            </div>
                          </div>

                          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 p-4 rounded-xl ${isDark ? 'bg-dark-900/50' : 'bg-gray-50'}`}>
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <Calendar size={16} className="text-brand-500" />
                              <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                                {new Date(job.scheduledAt || job.scheduledDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <Clock size={16} className="text-blue-500" />
                              <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                                {new Date(job.scheduledAt || job.scheduledDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm font-medium sm:col-span-2">
                              <MapPin size={16} className="text-success-500" />
                              <span className={`truncate ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {job.address || job.addressDetails || 'Service Location Specified'}
                              </span>
                            </div>
                          </div>

                          <Button
                            fullWidth
                            size="lg"
                            onClick={() => acceptJobMutation.mutate(job.id)}
                            loading={acceptJobMutation.isPending}
                            className="bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-500/20 h-12 rounded-xl text-base font-bold transition-transform active:scale-95"
                          >
                            Claim Job
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className={`text-center py-12 rounded-2xl border border-dashed ${isDark ? 'border-dark-700 bg-dark-800/50' : 'border-gray-200 bg-gray-50'}`}>
                    <Target className="mx-auto text-gray-400 mb-2" size={32} />
                    <h3 className={`text-lg font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>No listed jobs nearby</h3>
                    <p className="text-gray-500">We'll notify you when new requests come in.</p>
                  </div>
                )}
              </section>
            </div>

            {/* Sidebar: Quick Actions */}
            <div className="lg:col-span-1 space-y-6">
              <Card className="border-none shadow-lg shadow-brand-500/5">
                <CardHeader>
                  <CardTitle className="text-lg">Quick Actions</CardTitle>
                </CardHeader>
                <div className="p-4 pt-0 space-y-2">
                  <Button variant="ghost" fullWidth className="justify-start h-12" onClick={() => navigate('/worker/availability')}>
                    <Clock size={18} className="mr-3 text-blue-500" /> Availability
                  </Button>
                  <Button variant="ghost" fullWidth className="justify-start h-12" onClick={() => navigate('/worker/services')}>
                    <Briefcase size={18} className="mr-3 text-purple-500" /> My Services
                  </Button>
                  <Button variant="ghost" fullWidth className="justify-start h-12" onClick={() => navigate('/worker/profile')}>
                    <User size={18} className="mr-3 text-green-500" /> Profile
                  </Button>
                  <Button variant="ghost" fullWidth className="justify-start h-12" onClick={() => navigate('/worker/reviews')}>
                    <Star size={18} className="mr-3 text-yellow-500" /> Reviews
                  </Button>
                </div>
              </Card>

              <div className={`p-6 rounded-2xl ${isDark ? 'bg-brand-900/10 border border-brand-800' : 'bg-brand-50 border border-brand-100'}`}>
                <h3 className={`font-bold mb-2 ${isDark ? 'text-brand-100' : 'text-brand-900'}`}>Pro Tip</h3>
                <p className={`text-sm ${isDark ? 'text-brand-200' : 'text-brand-700'}`}>
                  Updating your availability calendar weekly increases your chances of getting hired by 40%.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Verification Modal */}
      <Modal
        isOpen={isOtpModalOpen}
        onClose={() => setIsOtpModalOpen(false)}
        title={otpAction === 'start' ? 'Start Verification' : 'Completion Verification'}
        size="sm"
      >
        <div className="space-y-4">
          <div className={`p-4 rounded-xl border ${isDark ? 'bg-brand-900/10 border-brand-800' : 'bg-brand-50 border-brand-100'}`}>
            <p className={`text-sm font-bold ${isDark ? 'text-brand-300' : 'text-brand-800'}`}>
              Step 1: Upload Proof
            </p>
            <p className={`text-xs mt-1 ${isDark ? 'text-brand-400' : 'text-brand-600'}`}>
              A {otpAction === 'start' ? 'BEFORE' : 'AFTER'} photo is required to document the work area.
            </p>
          </div>

          <ImageUpload
            label={otpAction === 'start' ? "Work area before starting" : "Completed service photo"}
            onUpload={setSelectedFile}
            value={selectedFile}
          />

          <div className={`border-t pt-6 ${isDark ? 'border-dark-700' : 'border-gray-100'}`}>
            <p className={`text-sm font-bold mb-1 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
              Step 2: Enter Verification Code
            </p>
            <p className={`text-xs mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Get the code from the customer's dashboard.
            </p>

            <Input
              placeholder="e.g. 1234"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              maxLength={6}
              className="text-center text-2xl tracking-widest font-bold h-16"
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
              className="px-8"
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
    </MainLayout>
  );
}
