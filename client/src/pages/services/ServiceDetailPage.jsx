// Service detail page with booking form

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { CalendarClock, MapPin, DollarSign, User, MessageSquare, Zap, Target, FileText, Search, CheckCircle2, Star, Clock } from 'lucide-react';
import { MainLayout } from '../../components/layout/MainLayout';
import { Input, Button, Spinner, Badge } from '../../components/common';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../hooks/useAuth';
import { getServiceById, getServiceWorkers } from '../../api/services';
import { createBooking } from '../../api/bookings';
import { queryKeys } from '../../utils/queryKeys';
import { resolveProfilePhotoUrl } from '../../utils/profilePhoto';

const bookingSchema = z.object({
  workerProfileId: z.preprocess((val) => (val === '' || val === undefined ? undefined : Number(val)), z.number().int().positive().optional()), // Optional for Auto-Assign
  scheduledDate: z.string().min(1, 'Scheduled date is required'),
  addressDetails: z.string().min(10, 'Address must be at least 10 characters'),
  estimatedPrice: z.preprocess((val) => (val === '' || val === undefined ? undefined : Number(val)), z.number().nonnegative().optional()),
  notes: z.string().max(1000).optional(),
});

export function ServiceDetailPage() {
  const queryClient = useQueryClient();
  const { isDark } = useTheme();
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const [serverError, setServerError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [bookingMode, setBookingMode] = useState('DIRECT');
  const [workerSearch, setWorkerSearch] = useState('');

  const bookingModes = [
    {
      id: 'DIRECT',
      title: 'Direct Worker Booking',
      description: 'Pick a worker and request a slot. The worker confirms.',
      icon: User,
      enabled: true,
    },
    {
      id: 'AUTO_ASSIGN',
      title: 'Service-First (Open Booking)',
      description: 'We broadcast your job to nearby workers.',
      icon: Target,
      enabled: true, // ENABLED NOW
    },
    {
      id: 'BIDS',
      title: 'Request + Bids',
      description: 'Post a job and compare worker quotes.',
      icon: FileText,
      enabled: false,
    },
    {
      id: 'INSTANT',
      title: 'Instant / On-Demand',
      description: 'Get the nearest available worker now.',
      icon: Zap,
      enabled: false,
    },
  ];

  const activeMode = bookingModes.find((mode) => mode.id === bookingMode);

  const { data: service, isLoading, isError, error } = useQuery({
    queryKey: ['service', id],
    queryFn: async () => {
      const data = await getServiceById(id);
      return data.service || data;
    },
    enabled: Boolean(id),
  });

  const { data: workers = [], isLoading: workersLoading } = useQuery({
    queryKey: ['service-workers', id],
    queryFn: async () => {
      const data = await getServiceWorkers(id);
      return data.workers || data;
    },
    enabled: Boolean(id),
    staleTime: 5 * 60 * 1000,
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
    setValue,
  } = useForm({
    resolver: zodResolver(bookingSchema),
  });

  const selectedWorkerId = watch('workerProfileId');
  const scheduledDateValue = watch('scheduledDate');
  const selectedWorker = workers.find((worker) => String(worker.id) === String(selectedWorkerId));
  const normalizedQuery = workerSearch.trim().toLowerCase();
  const filteredWorkers = normalizedQuery
    ? workers.filter((worker) => {
      const name = (worker.user?.name || '').toLowerCase();
      const rate = worker.hourlyRate ? String(worker.hourlyRate) : '';
      const workerId = worker.id ? String(worker.id) : '';
      return name.includes(normalizedQuery) || rate.includes(normalizedQuery) || workerId.includes(normalizedQuery);
    })
    : workers;

  const handleQuickPick = (workerId) => {
    setValue('workerProfileId', workerId, { shouldValidate: true, shouldDirty: true });
  };

  const onSubmit = async (data) => {
    setServerError('');
    setSuccessMessage('');

    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/services/${id}` } });
      return;
    }

    // Check for profile completion
    if (!user?.isProfileComplete) {
      const confirmSetup = window.confirm(
        'You need to complete your profile (address details) before booking a service. Would you like to do that now?'
      );
      if (confirmSetup) {
        navigate('/profile/setup', { state: { from: `/services/${id}` } });
      }
      return;
    }

    // Validation: If Direct Mode, Worker is required
    if (bookingMode === 'DIRECT' && !data.workerProfileId) {
      setServerError('Please select a worker for Direct Booking.');
      return;
    }

    try {
      const scheduledIso = new Date(data.scheduledDate).toISOString();

      // For Auto-Assign, send null as workerProfileId
      const workerIdToSend = bookingMode === 'DIRECT' ? data.workerProfileId : null;

      // Calculate estimate to send
      const finalEstimate = selectedWorker ? selectedWorker.hourlyRate : service.basePrice;

      await createBooking({
        workerProfileId: workerIdToSend,
        serviceId: Number(id),
        scheduledDate: scheduledIso,
        addressDetails: data.addressDetails,
        estimatedPrice: finalEstimate ? Number(finalEstimate) : undefined,
        notes: data.notes,
      });

      setSuccessMessage('Booking placed successfully! Workers will be notified.');
      reset();

      // Real-time update: Invalidate booking queries so they refresh immediately
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.customer() });
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.worker() });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });

      setTimeout(() => navigate('/dashboard'), 2000);

    } catch (err) {
      const message = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to create booking';
      setServerError(message);
    }
  };

  return (
    <MainLayout>
      <div className={`min-h-screen pb-20 ${isDark ? 'bg-dark-950' : 'bg-gray-50'}`}>

        {/* Decorative Background - Subtle & Premium */}
        <div className="absolute top-0 left-0 right-0 h-[500px] overflow-hidden pointer-events-none">
          <div className={`absolute -top-[50%] -left-[20%] w-[70%] h-[200%] rounded-full blur-[100px] opacity-20 ${isDark ? 'bg-brand-900' : 'bg-brand-200'}`} />
          <div className={`absolute top-0 right-0 w-[50%] h-[100%] rounded-full blur-[120px] opacity-20 ${isDark ? 'bg-blue-900' : 'bg-blue-200'}`} />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">

          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-32">
              <Spinner size="xl" className="text-brand-500" />
              <p className="mt-4 text-gray-500 font-medium animate-pulse">Finding the best experts for you...</p>
            </div>
          )}

          {/* Error State */}
          {isError && (
            <div className="max-w-lg mx-auto mt-20 text-center">
              <div className="w-20 h-20 bg-error-50 text-error-500 rounded-3xl flex items-center justify-center mx-auto mb-6 dark:bg-error-900/20">
                <FileText size={40} />
              </div>
              <h3 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Service Not Found</h3>
              <p className={`mb-8 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{error?.message || 'We could not find the service you are looking for.'}</p>
              <Button onClick={() => navigate('/services')} variant="outline" size="lg">Browse All Services</Button>
            </div>
          )}

          {service && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">

              {/* LEFT COLUMN: Content & Selection */}
              <div className="lg:col-span-7 space-y-10">

                {/* 1. Service Header (Clean & Bold) */}
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <Badge variant="brand" className="px-3 py-1 text-sm font-medium rounded-full shadow-sm shadow-brand-500/20">
                      {service.category || 'General'}
                    </Badge>
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-brand-600 dark:text-brand-400">
                      <div className="bg-brand-100 dark:bg-brand-900/30 p-1 rounded-full">
                        <DollarSign size={12} strokeWidth={3} />
                      </div>
                      <span>Starts at ₹{service.basePrice || 'Top Rated'}</span>
                    </div>
                  </div>

                  <h1 className={`text-4xl sm:text-5xl font-extrabold mb-4 leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {service.name}
                  </h1>
                  <p className={`text-lg leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {service.description || 'Experience top-tier professional services tailored to your needs. Validated experts, guaranteed satisfaction.'}
                  </p>

                  {/* Quick Stats/Trust Signals */}
                  <div className="flex flex-wrap gap-6 mt-6 pt-6 border-t border-gray-200 dark:border-dark-800">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="text-green-500" size={20} />
                      <span className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Verified Experts</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-yellow-500"><Star size={20} fill="currentColor" /></div>
                      <span className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>4.8+ Rated</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="text-blue-500" size={20} />
                      <span className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>On-time Guarantee</span>
                    </div>
                  </div>
                </div>

                {/* 2. Step 1: Booking Mode */}
                <div className="space-y-4">
                  <h3 className={`text-xl font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-brand-600 text-white text-sm">1</span>
                    Choose Your Preference
                  </h3>

                  <div className={`p-1.5 rounded-2xl flex gap-1 ${isDark ? 'bg-dark-800' : 'bg-white border border-gray-200 shadow-sm'}`}>
                    {bookingModes.filter(m => m.enabled).map((mode) => {
                      const isActive = bookingMode === mode.id;
                      return (
                        <button
                          key={mode.id}
                          onClick={() => setBookingMode(mode.id)}
                          className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 py-4 px-4 rounded-xl text-sm font-medium transition-all duration-300 ${isActive
                            ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/30'
                            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700'
                            }`}
                        >
                          <mode.icon size={20} className={isActive ? 'text-brand-100' : ''} />
                          <span className="text-base font-semibold">{mode.title}</span>
                          {isActive && <CheckCircle2 size={18} className="text-white hidden sm:block" fill="currentColor" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Contextual Helper Text */}
                  <div className="pl-2">
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {bookingMode === 'DIRECT'
                        ? "Browse profiles and pick the specific professional you want."
                        : "We'll broadcast your request to all nearby pros. The first one to accept gets the job."}
                    </p>
                  </div>
                </div>

                {/* 3. Step 2: Dynamic Content */}

                {/* AUTO ASSIGN VIEW */}
                {bookingMode === 'AUTO_ASSIGN' && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className={`relative overflow-hidden rounded-3xl p-8 border ${isDark ? 'bg-brand-900/10 border-brand-500/20' : 'bg-brand-50 border-brand-100'}`}>
                      <div className="relative z-10 flex flex-col sm:flex-row items-center text-center sm:text-left gap-6">
                        <div className="w-20 h-20 rounded-2xl bg-white dark:bg-dark-800 shadow-lg flex items-center justify-center shrink-0">
                          <Zap size={40} className="text-brand-500" fill="currentColor" />
                        </div>
                        <div>
                          <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Smart Match Technology</h3>
                          <p className={`mb-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                            Get the fastest service! We notify top-rated {service.name} experts near you instantly.
                          </p>
                          <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                            <Badge variant="success" className="bg-green-100 text-green-700 border-green-200">Avg. 5 min response</Badge>
                            <Badge variant="info" className="bg-blue-100 text-blue-700 border-blue-200">Verified Pros Only</Badge>
                          </div>
                        </div>
                      </div>
                      {/* Decor */}
                      <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-brand-500/10 rounded-full blur-3xl"></div>
                    </div>
                  </div>
                )}

                {/* DIRECT SELECTION VIEW */}
                {bookingMode === 'DIRECT' && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <h3 className={`text-xl font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-brand-600 text-white text-sm">2</span>
                        Select Verified Pro
                      </h3>

                      {/* Search Bar */}
                      <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                          type="text"
                          placeholder="Search by name..."
                          value={workerSearch}
                          onChange={(e) => setWorkerSearch(e.target.value)}
                          className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm focus:ring-2 focus:ring-brand-500 placeholder:text-gray-400 outline-none transition-all ${isDark ? 'bg-dark-800 border-dark-700 text-white' : 'bg-white border-gray-200 text-gray-900'
                            }`}
                        />
                      </div>
                    </div>

                    {workersLoading ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[1, 2, 3, 4].map(i => (
                          <div key={i} className={`h-40 rounded-2xl animate-pulse ${isDark ? 'bg-dark-800' : 'bg-gray-100'}`}></div>
                        ))}
                      </div>
                    ) : filteredWorkers.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredWorkers.map((worker) => {
                          const isSelected = String(worker.id) === String(selectedWorkerId);
                          return (
                            <div
                              key={worker.id}
                              onClick={() => handleQuickPick(worker.id)}
                              className={`relative cursor-pointer group rounded-2xl border p-5 transition-all duration-300 ${isSelected
                                ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 ring-2 ring-brand-500 shadow-xl shadow-brand-500/10 scale-[1.02]'
                                : isDark
                                  ? 'border-dark-700 bg-dark-800 hover:border-dark-600 hover:shadow-lg'
                                  : 'border-gray-200 bg-white hover:border-brand-200 hover:shadow-lg'
                                }`}
                            >
                              <div className="flex gap-4">
                                <div className="relative shrink-0">
                                  <div className="w-16 h-16 rounded-2xl bg-gray-200 dark:bg-dark-700 bg-cover bg-center shadow-md overflow-hidden flex items-center justify-center"
                                    style={{ backgroundImage: worker.user?.profilePhotoUrl ? `url(${resolveProfilePhotoUrl(worker.user.profilePhotoUrl)})` : undefined }}
                                  >
                                    {!worker.user?.profilePhotoUrl && <User className="w-8 h-8 text-gray-400" />}
                                  </div>
                                  {worker.isVerified && (
                                    <div className="absolute -bottom-2 -right-2 bg-white dark:bg-dark-800 rounded-full p-0.5 shadow-sm">
                                      <div className="bg-blue-500 text-white p-0.5 rounded-full">
                                        <CheckCircle2 size={12} strokeWidth={3} />
                                      </div>
                                    </div>
                                  )}
                                </div>

                                <div className="flex-1 min-w-0 flex flex-col justify-between">
                                  <div>
                                    <div className="flex justify-between items-start">
                                      <h4 className={`font-bold truncate text-base ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                                        {worker.user?.name || 'UrbanPro Worker'}
                                      </h4>
                                      <span className={`font-bold text-lg leading-none ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                        ₹{worker.hourlyRate}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                      <div className="flex items-center text-yellow-500 gap-0.5">
                                        <Star size={12} fill="currentColor" />
                                        <span className={`text-sm font-bold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{worker.rating?.toFixed(1) || 'N/A'}</span>
                                      </div>
                                      <span className="text-xs text-gray-400">• {worker.totalReviews} jobs</span>
                                    </div>
                                  </div>

                                  <div className="mt-3">
                                    <button
                                      type="button"
                                      className={`w-full py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors ${isSelected
                                        ? 'bg-brand-600 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-dark-700 dark:text-gray-300 dark:hover:bg-dark-600'
                                        }`}
                                    >
                                      {isSelected ? 'Selected' : 'Choose'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className={`text-center py-16 rounded-3xl border border-dashed ${isDark ? 'border-dark-700 bg-dark-800/50' : 'border-gray-200 bg-gray-50'}`}>
                        <Search className="mx-auto text-gray-400 mb-4" size={48} />
                        <h4 className={`text-lg font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>No workers found</h4>
                        <p className="text-gray-500">Try changing your search terms</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: Booking Form (Sticky & Clean) */}
              <div className="lg:col-span-5 relative">
                <div className="lg:sticky lg:top-24 transition-all duration-300">

                  <div className={`rounded-3xl shadow-2xl overflow-hidden ring-1 ${isDark ? 'bg-dark-800 ring-white/5 shadow-black/50' : 'bg-white ring-black/5 shadow-xl shadow-brand-900/5'}`}>
                    {/* Integrated Header */}
                    <div className={`px-6 py-6 ${isDark ? 'bg-brand-900/20 border-b border-white/5' : 'bg-brand-50/50 border-b border-brand-100'}`}>
                      <h2 className={`text-xl font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>Booking Details</h2>
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Complete your request to secure a slot.</p>
                    </div>

                    <div className="p-6 md:p-8 space-y-6">
                      <form onSubmit={handleSubmit(onSubmit)}>
                        <input type="hidden" {...register('workerProfileId')} />

                        {bookingMode === 'DIRECT' && !selectedWorker && (
                          <div className="mb-6 p-4 rounded-2xl bg-warning-50 text-warning-800 border border-warning-200 flex items-start gap-3 animate-pulse">
                            <User size={20} className="mt-0.5 shrink-0" />
                            <span className="text-sm font-medium">Please select a worker from the list on the left to continue.</span>
                          </div>
                        )}

                        {/* Form Fields - Spacious & Modern */}
                        <div className="space-y-5">
                          {/* Date Time */}
                          <div className="group">
                            <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-gray-400 group-focus-within:text-brand-400' : 'text-gray-500 group-focus-within:text-brand-600'}`}>
                              Date & Time
                            </label>
                            <div className="relative transform transition-all group-focus-within:scale-[1.01]">
                              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <CalendarClock className="text-gray-400" size={20} />
                              </div>
                              <input
                                type="datetime-local"
                                className={`w-full pl-12 pr-4 py-3.5 rounded-xl border text-base outline-none transition-all shadow-sm ${isDark
                                  ? 'bg-dark-900 border-dark-600 text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500'
                                  : 'bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500'
                                  } ${errors.scheduledDate ? 'border-error-500' : ''}`}
                                {...register('scheduledDate')}
                              />
                            </div>
                            {errors.scheduledDate && <p className="mt-1.5 text-xs text-error-500 font-medium pl-1">{errors.scheduledDate.message}</p>}
                          </div>

                          {/* Address */}
                          <div className="group">
                            <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-gray-400 group-focus-within:text-brand-400' : 'text-gray-500 group-focus-within:text-brand-600'}`}>
                              Service Location
                            </label>
                            <div className="relative transform transition-all group-focus-within:scale-[1.01]">
                              <div className="absolute top-3.5 left-4 pointer-events-none">
                                <MapPin className="text-gray-400" size={20} />
                              </div>
                              <textarea
                                rows={2}
                                placeholder="Enter your full address"
                                className={`w-full pl-12 pr-4 py-3 rounded-xl border text-base resize-none outline-none transition-all shadow-sm ${isDark
                                  ? 'bg-dark-900 border-dark-600 text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500'
                                  : 'bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500'
                                  } ${errors.addressDetails ? 'border-error-500' : ''}`}
                                {...register('addressDetails')}
                              />
                            </div>
                            {errors.addressDetails && <p className="mt-1.5 text-xs text-error-500 font-medium pl-1">{errors.addressDetails.message}</p>}
                          </div>

                          {/* Notes */}
                          <div className="group">
                            <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-gray-400 group-focus-within:text-brand-400' : 'text-gray-500 group-focus-within:text-brand-600'}`}>
                              Special Requests (Optional)
                            </label>
                            <div className="relative transform transition-all group-focus-within:scale-[1.01]">
                              <div className="absolute top-3.5 left-4 pointer-events-none">
                                <MessageSquare className="text-gray-400" size={20} />
                              </div>
                              <textarea
                                rows={2}
                                placeholder="Any specific instructions..."
                                className={`w-full pl-12 pr-4 py-3 rounded-xl border text-base resize-none outline-none transition-all shadow-sm ${isDark
                                  ? 'bg-dark-900 border-dark-600 text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500'
                                  : 'bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500'
                                  }`}
                                {...register('notes')}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Pricing Summary Block */}
                        <div className={`mt-8 p-4 rounded-xl border ${isDark ? 'bg-dark-900 border-dark-700' : 'bg-gray-50 border-gray-200'}`}>
                          <div className="flex justify-between items-center mb-2">
                            <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Selected Service</span>
                            <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{service.name}</span>
                          </div>
                          <div className="flex justify-between items-center mb-2">
                            <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Booking Mode</span>
                            <span className="text-brand-600 dark:text-brand-400 font-medium">{activeMode?.title}</span>
                          </div>
                          <div className="flex justify-between items-center pt-3 mt-3 border-t border-gray-200 dark:border-dark-700">
                            <span className="text-base font-semibold">Total Estimate</span>
                            <span className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              ₹{selectedWorker ? selectedWorker.hourlyRate : service.basePrice}
                            </span>
                          </div>
                        </div>

                        {/* Action Button */}
                        <div className="mt-8">
                          {serverError && (
                            <div className="mb-4 p-3 rounded-xl bg-error-50 text-error-600 text-sm border border-error-100 flex items-center gap-2">
                              <FileText size={16} /> {serverError}
                            </div>
                          )}

                          {successMessage && (
                            <div className="mb-4 p-3 rounded-xl bg-success-50 text-success-600 text-sm border border-success-100 flex items-center gap-2">
                              <CheckCircle2 size={16} /> {successMessage}
                            </div>
                          )}

                          <Button
                            type="submit"
                            fullWidth
                            size="lg"
                            loading={isSubmitting}
                            disabled={!activeMode?.enabled || (bookingMode === 'DIRECT' && !selectedWorker)}
                            className="h-14 text-lg font-bold shadow-xl shadow-brand-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                          >
                            {bookingMode === 'AUTO_ASSIGN' ? 'Find Worker Now' : 'Confirm Booking'}
                          </Button>

                          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-400">
                            <Zap size={12} fill="currentColor" />
                            <span>Secure payment only after job completion</span>
                          </div>
                        </div>
                      </form>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
