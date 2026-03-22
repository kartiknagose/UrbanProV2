import { useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase,
  Wallet,
  Clock,
  CalendarCheck,
  Star,
  MessageSquare,
  ShieldCheck,
  CheckCircle,
  Activity,
  Calendar,
  Circle,
  Target,
  MapPin,
  ChevronRight,
  User,
  AlertCircle,
  PlayCircle,
  ShieldAlert,
  Zap,
  ArrowRight,
  Wifi,
  WifiOff
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
  BookingCard,
  Avatar,
  BookingCardSkeleton,
  StatGridSkeleton,
  AsyncState,
  Modal,
  ConfirmDialog
} from '../../components/common';

import { getAllBookings, getOpenBookings } from '../../api/bookings';
import { getMyWorkerProfile } from '../../api/workers';
import { OtpVerificationModal } from '../../components/features/bookings/OtpVerificationModal';
import { queryKeys } from '../../utils/queryKeys';
import { SocialShare } from '../../components/features/growth/SocialShare';
import { useAuth } from '../../hooks/useAuth';
import { getPageLayout } from '../../constants/layout';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcut';
import { useWorkerLocation } from '../../hooks/useWorkerLocation';
import { useBookingActions } from '../../hooks/useBookingActions';
import { useSocketEvent } from '../../hooks/useSocket';
import { toast } from 'sonner';
import { usePageTitle } from '../../hooks/usePageTitle';
import { asArray } from '../../utils/safeData';

const formatJobSchedule = (value, locale) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Schedule not set';
  return date.toLocaleString(locale, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export function WorkerDashboardPage() {
    const { t, i18n } = useTranslation();
    usePageTitle(t('Dashboard'));
  const { user } = useAuth();
  const navigate = useNavigate();

  const [dashboardTab, setDashboardTab] = useState('active');
  const { isOnline, toggleOnline } = useWorkerLocation(true);

  const queryClient = useQueryClient();

  const { handleBookingAction, activeActionId, isAnyPending, otpModalProps, cancelConfirmProps } = useBookingActions({
    invalidateKeys: [queryKeys.bookings.worker(), queryKeys.bookings.open()],
  });

  // Keyboard shortcuts
  useKeyboardShortcuts([
    { key: 'b', callback: () => navigate('/worker/bookings'), meta: true },
    { key: 's', callback: () => navigate('/worker/services'), meta: true },
    { key: 'a', callback: () => navigate('/worker/availability'), meta: true },
  ]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: queryKeys.bookings.worker(),
    queryFn: getAllBookings,
  });

  const { data: profileData } = useQuery({
    queryKey: queryKeys.worker.profile(),
    queryFn: getMyWorkerProfile,
  });
  const profile = profileData?.profile;

  const { data: openJobsData } = useQuery({
    queryKey: queryKeys.bookings.open(),
    queryFn: getOpenBookings,
  });

  const openJobs = asArray(openJobsData?.bookings);
  const bookings = useMemo(() => asArray(data?.bookings), [data?.bookings]);
  const activeBookings = useMemo(() =>
    bookings.filter(b => {
      // Always show active jobs
      if (['CONFIRMED', 'IN_PROGRESS'].includes(b.status)) return true;
      // Keep completed jobs until worker has reviewed
      if (b.status === 'COMPLETED') {
        const hasReviewed = asArray(b.reviews).some(r => r.reviewerId === user?.id);
        return !hasReviewed;
      }
      return false;
    }),
    [bookings, user?.id]);

  // Direct requests — PENDING bookings where the customer specifically chose this worker
  const directRequests = useMemo(() =>
    bookings.filter(b => b.status === 'PENDING'),
    [bookings]);

  const stats = useMemo(() => {
    const totalEarnings = bookings
      .filter(b => b.status === 'COMPLETED')
      .reduce((sum, b) => sum + Number(b.totalPrice || 0), 0);

    return [
      { title: t('Revenue'), value: `₹${totalEarnings.toLocaleString()}`, icon: Wallet, color: 'brand' },
      { title: t('Active'), value: activeBookings.length, icon: Activity, color: 'info' },
      { title: t('Rating'), value: profile?.rating || t('NEW'), icon: Star, color: 'warning' },
      { title: t('Jobs Done'), value: bookings.filter(b => b.status === 'COMPLETED').length, icon: CheckCircle, color: 'success' },
    ];
  }, [bookings, activeBookings, profile, t]);

  useSocketEvent('booking:created', () => {
    toast.info(t('New service request available on the board!'));
    refetch();
    queryClient.invalidateQueries({ queryKey: queryKeys.bookings.open() });
  });

  useSocketEvent('booking:status_updated', (payload) => {
    const workerUserId = payload?.workerUserId || payload?.workerProfile?.userId || payload?.workerProfile?.user?.id || null;
    const workerProfileId = payload?.workerProfileId || payload?.workerId || payload?.workerProfile?.id || null;
    const isMine = String(workerUserId) === String(user?.id) || String(workerProfileId) === String(profile?.id);

    if (isMine || payload?.status === 'PENDING') {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.worker() });
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.open() });
    }
  });

  return (
    <MainLayout>
      <div className={getPageLayout('wide')}>

        {/* Dynamic Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
          <div className="flex items-center gap-8">
            <div className="relative group">
              <Avatar name={user?.name} src={user?.profilePhotoUrl} size="xl" ring status={isOnline ? t('online') : t('offline')} />
              <button
                onClick={toggleOnline}
                aria-label={isOnline ? t('Go offline') : t('Go online')}
                className={`absolute -bottom-2 -right-2 p-2 rounded-full shadow-xl transition-all ${isOnline ? 'bg-success-500 text-white animate-pulse' : 'bg-gray-400 text-white'}`}
              >
                {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
              </button>
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tighter mb-2 text-gray-900 dark:text-white">
                {t('HQ')}, <span className="text-brand-500 font-bold">{user?.name?.split(' ')[0]}</span>
              </h1>
              <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2">
                <Activity size={12} /> {t('System Status')}: {isOnline ? t('Active & Ready') : t('Standby Mode')}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={() => navigate('/worker/earnings')} variant="outline" className="rounded-2xl px-6 h-12 font-bold uppercase text-[10px] bg-transparent border-2 border-brand-500/20">
              {t('Wallet')}
            </Button>
            <Button onClick={() => navigate('/worker/availability')} className="rounded-2xl px-8 h-12 font-bold uppercase text-[10px] shadow-xl shadow-brand-500/20">
              {t('Set Schedule')}
            </Button>
          </div>
        </div>

        {/* Stats Matrix */}
        {isLoading ? (
          <StatGridSkeleton />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {stats.map((s, idx) => (
              <StatCard key={idx} {...s} className="md:scale-105" />
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Mission Control Column */}
          <div className="lg:col-span-2 space-y-8">

            {/* Section Tabs */}
            <div role="tablist" aria-label={t("Dashboard sections")} className="flex flex-wrap gap-2 p-1 rounded-2xl bg-gray-100 dark:bg-dark-900">
              {[
                { id: 'direct', label: t('Direct Requests'), count: directRequests.length, color: 'warning' },
                { id: 'public', label: t('Public Jobs'), count: openJobs.length, color: 'error' },
                { id: 'active', label: t('Active Jobs'), count: activeBookings.filter(b => ['CONFIRMED', 'IN_PROGRESS'].includes(b.status)).length, color: 'brand' },
                { id: 'review', label: t('Pending Review'), count: activeBookings.filter(b => b.status === 'COMPLETED').length, color: 'success' },
              ].map(tab => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={dashboardTab === tab.id}
                  aria-controls={`tabpanel-${tab.id}`}
                  id={`tab-${tab.id}`}
                  onClick={() => setDashboardTab(tab.id)}
                  className={`
                    relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all
                    ${dashboardTab === tab.id
                      ? 'bg-white text-gray-900 shadow-md dark:bg-dark-700 dark:text-white dark:shadow-lg'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }
                  `}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`
                      inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold
                      ${tab.color === 'warning' ? 'bg-warning-500/15 text-warning-600' : ''}
                      ${tab.color === 'error' ? 'bg-error-500/15 text-error-600' : ''}
                      ${tab.color === 'brand' ? 'bg-brand-500/15 text-brand-600' : ''}
                      ${tab.color === 'success' ? 'bg-success-500/15 text-success-600' : ''}
                    `}>
                      {tab.count}
                    </span>
                  )}
                  {tab.id === 'direct' && tab.count > 0 && (
                    <>
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-warning-500 rounded-full animate-ping" />
                      <span className="sr-only">New direct requests available</span>
                    </>
                  )}
                </button>
              ))}
            </div>

            {/* Direct Requests Tab */}
            {dashboardTab === 'direct' && (
              <section role="tabpanel" id="tabpanel-direct" aria-labelledby="tab-direct" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-warning-50 dark:bg-warning-500/10">
                      <User size={20} className="text-warning-500" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">{t('Direct Requests')}</h2>
                      <p className="text-xs text-gray-500 font-medium">{t('Customers who specifically chose you')}</p>
                    </div>
                  </div>
                </div>

                {directRequests.length === 0 ? (
                  <Card className="p-12 text-center border-dashed border-2">
                    <User size={40} className="text-gray-300 mx-auto mb-4" />
                    <p className="font-bold text-lg text-gray-500 dark:text-gray-400">{t('No direct requests yet')}</p>
                    <p className="text-xs text-gray-400 mt-2 max-w-xs mx-auto">{t('When customers book you directly from your profile, their requests will appear here.')}</p>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {directRequests.map(booking => (
                      <BookingCard
                        key={booking.id}
                        booking={booking}
                        role="WORKER"
                        onAction={handleBookingAction}
                        activeActionId={activeActionId}
                        isActionLoading={isAnyPending}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Public Jobs Tab */}
            {dashboardTab === 'public' && (
              <section role="tabpanel" id="tabpanel-public" aria-labelledby="tab-public" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-50 dark:bg-error-500/10">
                      <Zap size={20} className="text-error-500" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">{t('Public Job Board')}</h2>
                      <p className="text-xs text-gray-500 font-medium">{t('Open requests from nearby customers')}</p>
                    </div>
                  </div>
                </div>

                {openJobs.length === 0 ? (
                  <Card className="p-12 text-center border-dashed border-2">
                    <Zap size={40} className="text-gray-300 mx-auto mb-4" />
                    <p className="font-bold text-lg text-gray-500 dark:text-gray-400">{t('No open jobs right now')}</p>
                    <p className="text-xs text-gray-400 mt-2 max-w-xs mx-auto">{t('New open requests from customers will appear here. Stay online to get notified.')}</p>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {openJobs.map(job => (
                      <Card key={job.id} className="p-5 group hover:shadow-2xl transition-all border-dashed border-2 hover:border-brand-500/50">
                        <div className="flex flex-col md:flex-row justify-between gap-4">
                          <div className="flex gap-4">
                            <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-500 shrink-0">
                              <Zap size={24} />
                            </div>
                            <div>
                              <h4 className="font-bold text-lg leading-none mb-1">{job.service?.name}</h4>
                              <p className="text-sm text-gray-500 flex items-center gap-2">
                                <MapPin size={12} /> {job.address?.split(',')[0] || t('Nearby Location')}
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                {formatJobSchedule(job.scheduledAt || job.scheduledDate, i18n.language)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right hidden md:block">
                              <p className="text-[10px] font-bold uppercase text-gray-400">{t('Potential')}</p>
                              <p className="text-lg font-bold text-success-500">₹{job.totalPrice || '750+'}</p>
                            </div>
                            <Button
                              variant="primary"
                              className="px-8 rounded-xl h-11 font-bold uppercase text-[10px]"
                              onClick={() => handleBookingAction('CONFIRM', { id: job.id })}
                              loading={isAnyPending && activeActionId === job.id}
                            >
                              {t('Accept Job')}
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Active Jobs Tab */}
            {dashboardTab === 'active' && (
              <section role="tabpanel" id="tabpanel-active" aria-labelledby="tab-active" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-500/10">
                      <Activity size={20} className="text-brand-500" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">{t('Active Jobs')}</h2>
                      <p className="text-xs text-gray-500 font-medium">{t('Confirmed and in-progress work')}</p>
                    </div>
                  </div>
                </div>

                <AsyncState
                  isLoading={isLoading}
                  isEmpty={activeBookings.filter(b => ['CONFIRMED', 'IN_PROGRESS'].includes(b.status)).length === 0}
                  loadingFallback={<div className="space-y-6"><BookingCardSkeleton /><BookingCardSkeleton /></div>}
                  emptyTitle={t("No active jobs")}
                  emptyMessage={t("Accept a request or public job to get started.")}
                >
                  <div className="space-y-4">
                    {activeBookings.filter(b => ['CONFIRMED', 'IN_PROGRESS'].includes(b.status)).map(booking => (
                      <BookingCard
                        key={booking.id}
                        booking={booking}
                        role="WORKER"
                        onAction={handleBookingAction}
                        activeActionId={activeActionId}
                      />
                    ))}
                  </div>
                </AsyncState>
              </section>
            )}

            {/* Pending Review Tab */}
            {dashboardTab === 'review' && (
              <section role="tabpanel" id="tabpanel-review" aria-labelledby="tab-review" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-green-50 dark:bg-success-500/10">
                      <Star size={20} className="text-success-500" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">{t('Pending Reviews')}</h2>
                      <p className="text-xs text-gray-500 font-medium">{t('Rate your experience with the customer')}</p>
                    </div>
                  </div>
                </div>

                {activeBookings.filter(b => b.status === 'COMPLETED').length === 0 ? (
                  <Card className="p-12 text-center border-dashed border-2">
                    <Star size={40} className="text-gray-300 mx-auto mb-4" />
                    <p className="font-bold text-lg text-gray-500 dark:text-gray-400">{t('All caught up!')}</p>
                    <p className="text-xs text-gray-400 mt-2 max-w-xs mx-auto">{t('No completed jobs waiting for your review.')}</p>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {activeBookings.filter(b => b.status === 'COMPLETED').map(booking => (
                      <BookingCard
                        key={booking.id}
                        booking={booking}
                        role="WORKER"
                        onAction={handleBookingAction}
                        activeActionId={activeActionId}
                        isActionLoading={isAnyPending}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>

          {/* Tactical Intelligence Column */}
          <div className="space-y-8">
            <Card className="p-8 rounded-[2.5rem] bg-gradient-to-br from-gray-100 to-gray-50 dark:from-dark-900 dark:to-dark-800 border-0 shadow-2xl">
              <h3 className="font-bold uppercase tracking-widest text-[10px] mb-8 opacity-60 text-gray-900 dark:text-white">Status Dashboard</h3>
              <div className="space-y-8">
                <div className="flex justify-between items-center group">
                  <div className="flex gap-4 items-center">
                    <div className="w-10 h-10 rounded-xl bg-info-500/10 flex items-center justify-center text-info-500 group-hover:scale-110 transition-transform">
                      <Target size={20} />
                    </div>
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{t('Success Rate')}</span>
                  </div>
                  <span className="font-bold text-brand-500">{bookings.length > 0 ? `${((bookings.filter(b => b.status === 'COMPLETED').length / bookings.length) * 100).toFixed(0)}%` : t('N/A')}</span>
                </div>
                <div className="flex justify-between items-center group">
                  <div className="flex gap-4 items-center">
                    <div className="w-10 h-10 rounded-xl bg-success-500/10 flex items-center justify-center text-success-500 group-hover:scale-110 transition-transform">
                      <ShieldCheck size={20} />
                    </div>
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{t('Trust Rank')}</span>
                  </div>
                  <span className="font-bold text-success-500">{profile?.verificationStatus === 'VERIFIED' ? t('Verified') : t('Pending')}</span>
                </div>
              </div>
              <div className="mt-12 pt-8 border-t border-white/5">
                <Button
                  variant="ghost"
                  fullWidth
                  className="justify-between h-14 bg-white/5 hover:bg-white/10 text-white rounded-2xl group"
                  onClick={() => navigate('/worker/reviews')}
                >
                  <span className="font-bold uppercase tracking-widest text-[10px]">{t('Client Intel')}</span>
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </Card>

            <div className="p-8 bg-brand-500/10 border-2 border-dashed border-brand-500/20 rounded-[2rem]">
              <p className="font-bold text-brand-600 uppercase text-[10px] tracking-widest mb-4">{t('Share & Earn')}</p>
              <p className="text-sm font-medium leading-relaxed text-gray-700 dark:text-gray-300 mb-6">
                {t('Invite fellow experts and earn rewards for every successful registration.')}
              </p>
              <SocialShare
                title={t("Join UrbanPro V2")}
                text={`${t("Use my referral code")} ${profile?.user?.referralCode || ''} ${t("to sign up as a pro!")}`}
                variant="row"
              />
            </div>
          </div>
        </div>

        {/* OTP Verification Modal */}
        <OtpVerificationModal {...otpModalProps} />
        <ConfirmDialog {...cancelConfirmProps} />
      </div>
    </MainLayout>
  );
}
