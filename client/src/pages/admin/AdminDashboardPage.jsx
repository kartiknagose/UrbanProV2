// AdminDashboardPage — premium layout, gradient quick-actions, refined tables

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Users, Briefcase, Calendar, AlertTriangle,
  RefreshCw, LayoutGrid, UserCog, ShieldCheck, ArrowRight, Activity
} from 'lucide-react';
import {
  PageHeader, Card, CardTitle, CardDescription,
  Button, Badge, Spinner, StatCard,
  Skeleton, SimpleBarChart, SimpleDonutChart,
  AsyncState, StatGridSkeleton, BookingStatusBadge
} from '../../components/common';
import { useSocketEvent } from '../../hooks/useSocket';
import { getAdminUsers, getAdminDashboard } from '../../api/admin';
import { getAllBookings } from '../../api/bookings';
import { getVerificationApplications } from '../../api/verification';
import { MainLayout } from '../../components/layout/MainLayout';
import { getPageLayout } from '../../constants/layout';
import { queryKeys } from '../../utils/queryKeys';
import { usePageTitle } from '../../hooks/usePageTitle';

export function AdminDashboardPage() {
  usePageTitle('Admin Dashboard');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const formatDateTime = (value) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleString();
  };

  const formatDate = (value) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString();
  };

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.admin.dashboard(),
    queryFn: getAdminDashboard,
  });

  const bookingsQuery = useQuery({
    queryKey: queryKeys.admin.bookingsPreview(),
    queryFn: getAllBookings,
  });

  const usersQuery = useQuery({
    queryKey: queryKeys.admin.usersPreview(),
    queryFn: () => getAdminUsers(),
  });

  const stats = data?.stats;
  const bookings = useMemo(() => bookingsQuery.data?.bookings || [], [bookingsQuery.data?.bookings]);
  const users    = useMemo(() => usersQuery.data?.users    || [], [usersQuery.data?.users]);

  const verificationQuery = useQuery({
    queryKey: queryKeys.admin.verificationPreview(),
    queryFn: getVerificationApplications,
  });

  const applications        = verificationQuery.data?.applications || [];
  const pendingApplications = applications.filter(app => app.status === 'PENDING');

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.dashboard() });
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.bookingsPreview() });
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.verificationPreview() });
  };

  useSocketEvent('booking:created',        refreshAll);
  useSocketEvent('booking:status_updated', refreshAll);
  useSocketEvent('verification:updated',   refreshAll);
  useSocketEvent('verification:created',   refreshAll);
  useSocketEvent('admin:users_updated',    refreshAll);
  useSocketEvent('admin:workers_updated',  refreshAll);

  const chartData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d;
    });

    const userGrowth = last7Days.map(date => {
      const dateStr = date.toISOString().split('T')[0];
      const count   = users.filter(u => u.createdAt?.startsWith(dateStr)).length;
      return {
        label:   date.toLocaleDateString('en-US', { weekday: 'short' }),
        value:   count,
        tooltip: `${count} Users`,
      };
    });

    const bookingStatus = [
      { label: 'Completed', value: bookings.filter(b => b.status === 'COMPLETED').length, color: '#10b981' },
      { label: 'Confirmed', value: bookings.filter(b => b.status === 'CONFIRMED').length, color: '#6366f1' },
      { label: 'Pending',   value: bookings.filter(b => b.status === 'PENDING').length,   color: '#f59e0b' },
      { label: 'Cancelled', value: bookings.filter(b => b.status === 'CANCELLED').length, color: '#ef4444' },
    ];

    return { userGrowth, bookingStatus };
  }, [users, bookings]);

  const quickActions = [
    { icon: LayoutGrid, label: 'Services',      path: '/admin/services',      variant: 'primary' },
    { icon: Users,      label: 'Workers',        path: '/admin/workers',       variant: 'outline' },
    { icon: UserCog,    label: 'Users',          path: '/admin/users',         variant: 'outline' },
    { icon: Calendar,   label: 'Bookings',       path: '/admin/bookings',      variant: 'ghost' },
    { icon: ShieldCheck, label: 'Verification',  path: '/admin/verification',  variant: 'ghost' },
  ];

  return (
    <MainLayout>
      <div className={getPageLayout('default')}>
        <div className="flex items-start justify-between mb-8">
          <PageHeader
            title="Admin Dashboard"
            subtitle="Monitor marketplace activity and manage the platform."
            gradient
          />
          <button
            onClick={refreshAll}
            className="p-2.5 rounded-xl bg-neutral-100 dark:bg-dark-800 hover:bg-neutral-200 dark:hover:bg-dark-700 transition-colors border border-neutral-200 dark:border-dark-600"
            title="Refresh data"
          >
            <RefreshCw size={18} className="text-neutral-500" />
          </button>
        </div>

        <AsyncState
          isLoading={isLoading}
          isError={isError}
          error={error}
          onRetry={refetch}
          loadingFallback={<StatGridSkeleton />}
          errorFallback={
            <Card className="p-6 border-error-200 dark:border-error-500/30 bg-error-50 dark:bg-error-500/10">
              <p className="text-error-600 dark:text-error-400 mb-3 text-sm font-medium">
                {error?.response?.data?.error || error?.message || 'Failed to load dashboard.'}
              </p>
              <Button size="sm" variant="outline" onClick={() => refetch()}>Retry</Button>
            </Card>
          }
        >
          {stats && (
            <>
              {/* Stat Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
                <StatCard title="Users"                value={stats.users}                    icon={Users}      color="brand"   delay={0} />
                <StatCard title="Workers"              value={stats.workers}                  icon={Briefcase}  color="info"    delay={1} />
                <StatCard title="Total Bookings"       value={stats.bookings}                 icon={Calendar}   color="success" delay={2} />
                <StatCard title="Pending Bookings"     value={stats.pendingBookings}          icon={AlertTriangle} color="warning" delay={3} />
                <StatCard
                  title="Pending Verifications"
                  value={stats.pendingVerifications || 0}
                  icon={ShieldCheck}
                  color="error"
                  delay={4}
                  onClick={() => navigate('/admin/verification')}
                  className="cursor-pointer"
                />
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <SimpleBarChart title="User Growth (Last 7 Days)" data={chartData.userGrowth} height="h-64" />
                <SimpleDonutChart title="Booking Status Distribution" data={chartData.bookingStatus} />
              </div>

              {/* Tables + Quick Actions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Recent Bookings */}
                <Card>
                  <div className="flex items-center justify-between p-5 pb-0">
                    <div>
                      <CardTitle className="mb-0.5">Recent Bookings</CardTitle>
                      <CardDescription>Latest bookings across the marketplace</CardDescription>
                    </div>
                    <button onClick={() => navigate('/admin/bookings')} className="text-xs font-bold text-brand-500 hover:text-brand-600 flex items-center gap-1">
                      View all <ArrowRight size={12} />
                    </button>
                  </div>
                  <div className="p-5 pt-4">
                    {bookingsQuery.isLoading && <div className="flex justify-center py-8"><Spinner size="lg" /></div>}
                    {!bookingsQuery.isLoading && bookings.length === 0 && (
                      <p className="text-sm text-neutral-500 dark:text-neutral-400 py-4 text-center">No bookings yet.</p>
                    )}
                    {!bookingsQuery.isLoading && bookings.length > 0 && (
                      <div className="space-y-3">
                        {bookings.slice(0, 5).map((booking) => (
                          <div key={booking.id} className="flex items-center justify-between py-2 border-b border-neutral-50 dark:border-dark-800 last:border-0">
                            <div>
                              <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                                {booking.service?.name || `Booking #${booking.id}`}
                              </p>
                              <p className="text-xs text-neutral-400">
                                {formatDateTime(booking.scheduledAt || booking.scheduledDate)}
                              </p>
                            </div>
                            <BookingStatusBadge status={booking.status} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>

                {/* Newest Users */}
                <Card>
                  <div className="flex items-center justify-between p-5 pb-0">
                    <div>
                      <CardTitle className="mb-0.5">Newest Users</CardTitle>
                      <CardDescription>Latest signups by role</CardDescription>
                    </div>
                    <button onClick={() => navigate('/admin/users')} className="text-xs font-bold text-brand-500 hover:text-brand-600 flex items-center gap-1">
                      Manage <ArrowRight size={12} />
                    </button>
                  </div>
                  <div className="p-5 pt-4">
                    {usersQuery.isLoading && <div className="flex justify-center py-8"><Spinner size="lg" /></div>}
                    {!usersQuery.isLoading && users.length === 0 && (
                      <p className="text-sm text-neutral-500 dark:text-neutral-400 py-4 text-center">No users yet.</p>
                    )}
                    {!usersQuery.isLoading && users.length > 0 && (
                      <div className="space-y-3">
                        {users.slice(0, 5).map((user) => (
                          <div key={user.id} className="flex items-center justify-between py-2 border-b border-neutral-50 dark:border-dark-800 last:border-0">
                            <div>
                              <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{user.name}</p>
                              <p className="text-xs text-neutral-400">{user.email}</p>
                            </div>
                            <Badge variant={user.role === 'ADMIN' ? 'info' : user.role === 'WORKER' ? 'warning' : 'default'} size="xs">
                              {user.role}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>

                {/* Pending Verifications */}
                <Card>
                  <div className="flex items-center justify-between p-5 pb-0">
                    <div>
                      <CardTitle className="mb-0.5">Pending Verifications</CardTitle>
                      <CardDescription>Worker applications needing review</CardDescription>
                    </div>
                    {pendingApplications.length > 0 && (
                      <Badge variant="warning" size="xs" pulse>
                        {pendingApplications.length} pending
                      </Badge>
                    )}
                  </div>
                  <div className="p-5 pt-4">
                    {verificationQuery.isLoading && <div className="flex justify-center py-8"><Spinner size="lg" /></div>}
                    {!verificationQuery.isLoading && pendingApplications.length === 0 && (
                      <p className="text-sm text-neutral-500 dark:text-neutral-400 py-4 text-center">No pending applications.</p>
                    )}
                    {!verificationQuery.isLoading && pendingApplications.length > 0 && (
                      <div className="space-y-3">
                        {pendingApplications.slice(0, 5).map((app) => (
                          <div key={app.id} className="flex items-center justify-between py-2 border-b border-neutral-50 dark:border-dark-800 last:border-0">
                            <div>
                              <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{app.user?.name || 'Worker'}</p>
                              <p className="text-xs text-neutral-400">Applied: {formatDate(app.submittedAt)}</p>
                            </div>
                            <Badge variant="warning" size="xs">Pending</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                    <Button size="sm" fullWidth variant="outline" onClick={() => navigate('/admin/verification')} className="mt-3">
                      Review Applications
                    </Button>
                  </div>
                </Card>

                {/* Quick Actions */}
                <Card variant="gradient-border">
                  <div className="p-5 pb-0">
                    <CardTitle>Quick Actions</CardTitle>
                    <CardDescription>Admin shortcuts for daily operations</CardDescription>
                  </div>
                  <div className="p-5 pt-4 space-y-2.5">
                    {quickActions.map(({ icon: Icon, label, path, variant }) => (
                      <Button
                        key={path}
                        fullWidth
                        variant={variant}
                        icon={Icon}
                        className="justify-start h-11"
                        onClick={() => navigate(path)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </Card>
              </div>
            </>
          )}
        </AsyncState>
      </div>
    </MainLayout>
  );
}
