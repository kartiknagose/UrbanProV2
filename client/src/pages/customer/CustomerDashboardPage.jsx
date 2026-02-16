// Customer dashboard page
// Shows booking summary and quick actions

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useTheme } from '../../context/ThemeContext';
import { MainLayout } from '../../components/layout/MainLayout';
import { PageHeader, Card, CardHeader, CardTitle, CardDescription, Button, Badge, StatCard, Skeleton, AsyncState, Spinner } from '../../components/common';

import {
  Calendar,
  Clock,
  Briefcase,
  CheckCircle,
  XOctagon,
  DollarSign,
  Star,
  CalendarClock,
  Wallet,
  Zap,
  ChevronRight,
  Search,
  ShieldAlert
} from 'lucide-react';
import { getAllBookings, payBooking } from '../../api/bookings';
import { getAllServices } from '../../api/services';
import { queryKeys } from '../../utils/queryKeys';
import { getBookingStatusVariant } from '../../utils/statusHelpers';


export function CustomerDashboardPage() {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.bookings.customer(),
    queryFn: getAllBookings,
  });

  const servicesQuery = useQuery({
    queryKey: ['services-preview'],
    queryFn: getAllServices,
    staleTime: 5 * 60 * 1000,
  });

  const payMutation = useMutation({
    mutationFn: (id) => payBooking(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.customer() });
    },
  });

  const bookings = data?.bookings || [];
  const services = servicesQuery.data?.services || servicesQuery.data || [];

  const pendingReviews = useMemo(() => {
    return bookings.filter((booking) => booking.status === 'COMPLETED' && (!booking.reviews || booking.reviews.length === 0));
  }, [bookings]);

  const summary = useMemo(() => {
    const counts = {
      total: bookings.length,
      pending: bookings.filter((b) => b.status === 'PENDING').length,
      confirmed: bookings.filter((b) => b.status === 'CONFIRMED').length,
      completed: bookings.filter((b) => b.status === 'COMPLETED').length,
      cancelled: bookings.filter((b) => b.status === 'CANCELLED').length,
    };
    return counts;
  }, [bookings]);

  const totalSpent = useMemo(() => {
    return bookings
      .filter((booking) => booking.status === 'COMPLETED')
      .reduce((sum, booking) => sum + Number(booking.totalPrice || 0), 0);
  }, [bookings]);

  return (
    <MainLayout>
      <div className="relative overflow-hidden min-h-screen">
        {/* Decorative Background Elements */}
        <div className="pointer-events-none absolute -top-24 right-0 h-96 w-96 rounded-full bg-brand-400/10 blur-3xl" />
        <div className="pointer-events-none absolute top-20 left-10 h-72 w-72 rounded-full bg-blue-400/10 blur-3xl" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">
          <PageHeader
            title="Dashboard"
            subtitle="Manage your bookings and find new services."
            className="mb-8"
          />

          <AsyncState
            isLoading={isLoading}
            isError={isError}
            onRetry={refetch}
            loadingFallback={
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-32 rounded-2xl" />
                  ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <Skeleton className="lg:col-span-2 h-96 rounded-2xl" />
                  <Skeleton className="h-96 rounded-2xl" />
                </div>
              </div>
            }
            errorFallback={
              <div className="p-8 rounded-2xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900 text-center">
                <p className="text-red-600 dark:text-red-400 mb-4">Unable to load dashboard data right now.</p>
                <Button onClick={() => refetch()} variant="outline" className="border-red-200 text-red-600 hover:bg-red-100">
                  Try Again
                </Button>
              </div>
            }
          >
            <>
              {/* Stats Overview */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
                <StatCard title="Total Bookings" value={summary.total} icon={Briefcase} color="brand" delay={0} />
                <StatCard title="Pending" value={summary.pending} icon={Clock} color="warning" delay={1} />
                <StatCard title="Confirmed" value={summary.confirmed} icon={Calendar} color="info" delay={2} />
                <StatCard title="Completed" value={summary.completed} icon={CheckCircle} color="success" delay={3} />
                <StatCard title="Cancelled" value={summary.cancelled} icon={XOctagon} color="error" delay={4} />
                <StatCard title="Total Spent" value={`₹${totalSpent.toFixed(0)}`} icon={DollarSign} color="brand" delay={5} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Main Column (2/3) */}
                <div className="lg:col-span-2 space-y-8">

                  {/* Current/Recent Bookings */}
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className={`text-xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Recent Activity</h2>
                      <Button variant="ghost" size="sm" onClick={() => navigate('/bookings')} className="text-brand-600 hover:text-brand-700 hover:bg-brand-50 dark:hover:bg-brand-900/20">
                        View All
                      </Button>
                    </div>

                    {bookings.length === 0 ? (
                      <div className={`text-center py-12 rounded-3xl border border-dashed ${isDark ? 'border-dark-700 bg-dark-800/30' : 'border-gray-200 bg-gray-50/50'}`}>
                        <div className="w-16 h-16 bg-gray-100 dark:bg-dark-700 rounded-full flex items-center justify-center mx-auto mb-4">
                          <CalendarClock className="text-gray-400" size={32} />
                        </div>
                        <h3 className={`text-lg font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>No bookings yet</h3>
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} mt-1 mb-6 max-w-xs mx-auto`}>
                          Explore our services and book your first professional today.
                        </p>
                        <Button onClick={() => navigate('/services')}>Find a Service</Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {bookings.slice(0, 5).map((booking) => (
                          <div key={booking.id}
                            onClick={() => navigate(`/bookings/${booking.id}`)}
                            className={`group flex flex-col sm:flex-row gap-4 p-5 rounded-2xl border transition-all duration-200 cursor-pointer hover:shadow-xl active:scale-[0.98] ${isDark ? 'bg-dark-800 border-dark-700 hover:border-brand-500/30' : 'bg-white border-gray-100 hover:border-brand-200'
                              }`}>

                            {/* Icon/Image Placeholder */}
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-dark-700 text-gray-300' : 'bg-brand-50 text-brand-600'
                              }`}>
                              {booking.serviceId % 2 === 0 ? <Briefcase size={20} /> : <Zap size={20} />}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className={`font-black text-lg ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                                    {booking.service?.name || `Service #${booking.serviceId}`}
                                  </h4>
                                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} flex items-center gap-2 mt-1`}>
                                    <Calendar size={14} className="text-brand-500" />
                                    {new Date(booking.scheduledAt || booking.scheduledDate).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                  </p>
                                </div>
                                <Badge variant={getBookingStatusVariant(booking.status)} className="font-black uppercase text-[10px]">
                                  {booking.status}
                                </Badge>
                              </div>

                              {/* Prominent OTP Banner for Ease of Use */}
                              {((booking.status === 'CONFIRMED' && booking.startOtp) || (booking.status === 'IN_PROGRESS' && booking.completionOtp)) && (
                                <div className="mt-4">
                                  <div className={`px-4 py-2.5 rounded-xl flex items-center justify-between border-2 border-dashed ${booking.status === 'CONFIRMED' ? (isDark ? 'bg-brand-950/20 border-brand-800' : 'bg-brand-50 border-brand-200 shadow-sm') : (isDark ? 'bg-success-950/20 border-success-800' : 'bg-success-50 border-success-200 shadow-sm')}`}>
                                    <div className="flex items-center gap-3">
                                      <div className={`p-1.5 rounded-lg ${booking.status === 'CONFIRMED' ? 'bg-brand-500 text-white' : 'bg-success-500 text-white'}`}>
                                        <ShieldAlert size={16} />
                                      </div>
                                      <div>
                                        <span className={`text-[10px] font-black uppercase tracking-widest block leading-none mb-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                          {booking.status === 'CONFIRMED' ? 'Start Code' : 'Completion Code'}
                                        </span>
                                        <span className={`text-[9px] font-bold ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Give to professional</span>
                                      </div>
                                    </div>
                                    <span className={`text-2xl font-black tracking-[0.2em] font-mono leading-none ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                      {booking.status === 'CONFIRMED' ? booking.startOtp : booking.completionOtp}
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* Action Area */}
                              <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                  <div className={`text-[10px] font-black uppercase px-2 py-1 rounded-md tracking-widest ${isDark ? 'bg-dark-900 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
                                    ID: {booking.id}
                                  </div>
                                  {booking.workerProfile && (
                                    <div className="text-xs font-bold flex items-center gap-2 text-gray-500">
                                      <div className="w-1.5 h-1.5 rounded-full bg-success-500 animate-pulse"></div>
                                      {booking.workerProfile.user?.name}
                                    </div>
                                  )}
                                  {booking.status === 'COMPLETED' && booking.paymentStatus !== 'PAID' && (
                                    <Badge variant="warning" size="sm" className="font-black uppercase text-[8px]">Payment Required</Badge>
                                  )}
                                </div>

                                <div className="flex gap-2 w-full sm:w-auto" onClick={(e) => e.stopPropagation()}>
                                  {booking.status === 'COMPLETED' && (
                                    <>
                                      {booking.paymentStatus !== 'PAID' && (
                                        <Button
                                          size="sm"
                                          className="h-9 px-6 font-bold flex-1 sm:flex-none"
                                          onClick={() => payMutation.mutate(booking.id)}
                                          loading={payMutation.isPending}
                                        >
                                          Pay now
                                        </Button>
                                      )}
                                      {(!booking.reviews || booking.reviews.length === 0) && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-9 px-6 font-bold flex-1 sm:flex-none"
                                          onClick={() => navigate('/reviews')}
                                        >
                                          Rate & Review
                                        </Button>
                                      )}
                                    </>
                                  )}
                                  {booking.status === 'PENDING' && (
                                    <div className="flex items-center gap-2 text-[10px] font-black text-brand-500 uppercase tracking-widest bg-brand-500/10 px-3 py-1.5 rounded-lg border border-brand-500/20">
                                      <Search size={12} className="animate-pulse" />
                                      Finding Provider...
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* Pending Reviews Section */}
                  {pendingReviews.length > 0 && (
                    <section>
                      <h2 className={`text-lg font-bold mb-4 ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>We value your feedback</h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {pendingReviews.slice(0, 2).map((booking) => (
                          <div key={booking.id} className={`p-5 rounded-2xl border ${isDark ? 'bg-gradient-to-br from-yellow-900/10 to-transparent border-yellow-900/30' : 'bg-gradient-to-br from-yellow-50 to-white border-yellow-100'}`}>
                            <div className="flex items-start justify-between mb-2">
                              <h4 className={`font-medium ${isDark ? 'text-yellow-100' : 'text-yellow-900'}`}>{booking.service?.name}</h4>
                              <Star className="text-yellow-500 fill-yellow-500" size={16} />
                            </div>
                            <p className={`text-sm mb-4 ${isDark ? 'text-yellow-200/70' : 'text-yellow-700/80'}`}>
                              How was your experience with {booking.workerProfile?.user?.name}?
                            </p>
                            <Button size="sm" variant="outline" className="w-full border-yellow-200 text-yellow-700 hover:bg-yellow-100 hover:text-yellow-800 dark:border-yellow-800 dark:text-yellow-400" onClick={() => navigate('/reviews')}>
                              Write a Review
                            </Button>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>

                {/* Right Column (1/3) */}
                <div className="space-y-8">

                  {/* Quick Actions Card */}
                  <Card className="overflow-hidden border-none shadow-lg">
                    <div className={`p-6 ${isDark ? 'bg-gradient-to-br from-brand-900 to-dark-800' : 'bg-gradient-to-br from-brand-600 to-brand-700'} text-white`}>
                      <h3 className="font-bold text-lg mb-1">Quick Actions</h3>
                      <p className="text-brand-100 text-sm opacity-90">Manage your account instantly</p>
                    </div>
                    <div className={`p-4 grid grid-cols-2 gap-3 ${isDark ? 'bg-dark-800' : 'bg-white'}`}>
                      <Button variant="outline" className="h-auto py-4 flex-col gap-2 border-dashed" onClick={() => navigate('/services')}>
                        <Briefcase className="text-brand-500" size={24} />
                        <span className="text-xs font-medium">Book New</span>
                      </Button>
                      <Button variant="outline" className="h-auto py-4 flex-col gap-2 border-dashed" onClick={() => navigate('/bookings')}>
                        <CalendarClock className="text-blue-500" size={24} />
                        <span className="text-xs font-medium">My Bookings</span>
                      </Button>
                      <Button variant="outline" className="h-auto py-4 flex-col gap-2 border-dashed" onClick={() => navigate('/profile')}>
                        <Wallet className="text-green-500" size={24} />
                        <span className="text-xs font-medium">Wallet</span>
                      </Button>
                      <Button variant="outline" className="h-auto py-4 flex-col gap-2 border-dashed" onClick={() => navigate('/reviews')}>
                        <Star className="text-yellow-500" size={24} />
                        <span className="text-xs font-medium">Reviews</span>
                      </Button>
                    </div>
                  </Card>

                  {/* Recommended Services */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Popular Services</CardTitle>
                      <CardDescription>Trending in your area</CardDescription>
                    </CardHeader>
                    <div className="divide-y divide-gray-100 dark:divide-dark-700">
                      {servicesQuery.isLoading ? (
                        <div className="p-4 flex justify-center"><Spinner /></div>
                      ) : services.slice(0, 5).map((service) => (
                        <div key={service.id}
                          className="p-4 flex items-center justify-between group cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors"
                          onClick={() => navigate(`/services/${service.id}`)}>
                          <div>
                            <h4 className={`font-medium text-sm ${isDark ? 'text-gray-200 group-hover:text-brand-400' : 'text-gray-800 group-hover:text-brand-600'}`}>
                              {service.name}
                            </h4>
                            <p className="text-xs text-gray-500">{service.category}</p>
                          </div>
                          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 dark:bg-dark-700 group-hover:bg-brand-100 dark:group-hover:bg-brand-900/30 transition-colors">
                            <ChevronRight size={16} className="text-gray-400 group-hover:text-brand-600 dark:text-gray-500 dark:group-hover:text-brand-400" />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="p-3 border-t border-gray-100 dark:border-dark-700">
                      <Button variant="ghost" fullWidth size="sm" onClick={() => navigate('/services')}>
                        Browse All Services
                      </Button>
                    </div>
                  </Card>

                  {/* Support Promo */}
                  <div className={`p-6 rounded-2xl ${isDark ? 'bg-indigo-900/20 border border-indigo-500/20' : 'bg-indigo-50 border border-indigo-100'}`}>
                    <h4 className={`font-bold mb-2 ${isDark ? 'text-indigo-300' : 'text-indigo-800'}`}>Need Help?</h4>
                    <p className={`text-sm mb-4 ${isDark ? 'text-indigo-200/70' : 'text-indigo-700/70'}`}>
                      Our support team is available 24/7 to assist with your bookings.
                    </p>
                    <Button size="sm" variant="outline" className="w-full border-indigo-200 text-indigo-600 hover:bg-indigo-100 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-900/40">
                      Contact Support
                    </Button>
                  </div>
                </div>

              </div>
            </>
          </AsyncState>
        </div >
      </div >
    </MainLayout >
  );
}
