import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Calendar,
  Users,
  MapPin,
  IndianRupee,
  Ticket,
  MessageSquare,
  Repeat,
  AlertCircle,
  Star,
  MapPinIcon,
  User,
  Loader2,
} from 'lucide-react';
import { Button, Badge, Card, Input, Textarea, Avatar, AsyncState } from '../../common';
import { LocationPicker } from '../location/LocationPicker';
import { AddressAutocomplete } from '../location/AddressAutocomplete';
import { queryKeys } from '../../../utils/queryKeys';
import { getServiceWorkers, getAllServices } from '../../../api/services';
import { previewPrice } from '../../../api/bookings';
import { validateCoupon } from '../../../api/growth';
import { toast } from 'sonner';

const STEP_TITLES = {
  service: 'Select Service',
  worker: 'Choose Expert',
  details: 'Location & Schedule',
  summary: 'Confirm Booking',
};

const WizardStep = ({ step, isActive, isCompleted, title, icon: Icon }) => (
  <div className={`flex items-center gap-3 transition-opacity ${isActive ? 'opacity-100' : 'opacity-50'}`}>
    <div
      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
        isCompleted
          ? 'bg-success-500 text-white'
          : isActive
            ? 'bg-brand-500 text-white ring-2 ring-brand-300'
            : 'bg-neutral-200 dark:bg-dark-700 text-neutral-600 dark:text-neutral-400'
      }`}
    >
      {isCompleted ? <CheckCircle2 size={20} /> : step + 1}
    </div>
    <div className="hidden sm:block">
      <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">{`Step ${step + 1}`}</p>
      <p className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
        {Icon && <Icon size={16} />} {title}
      </p>
    </div>
  </div>
);

export function BookingWizard({ onSuccess, initialService = null, initialWorker = null }) {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);
  const [bookingMode, setBookingMode] = useState('DIRECT'); // DIRECT or OPEN
  const [selectedService, setSelectedService] = useState(initialService);
  const [selectedWorker, setSelectedWorker] = useState(initialWorker);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [frequency, setFrequency] = useState('ONE_TIME');
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [pricingData, setPricingData] = useState(null);

  const formatScheduledDateTime = (value) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleString();
  };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    mode: 'onChange',
    defaultValues: {
      workerProfileId: initialWorker?.id,
      serviceId: initialService?.id,
      scheduledDate: '',
      addressDetails: '',
      addressLat: 0,
      addressLng: 0,
      notes: '',
      estimatedPrice: '',
      frequency: 'ONE_TIME',
      couponCode: '',
    },
  });

  const watchScheduledDate = watch('scheduledDate');
  const watchEstimatedPrice = watch('estimatedPrice');
  const watchNotes = watch('notes');

  // Fetch services if not provided
  const { data: servicesData, isLoading: servicesLoading } = useQuery({
    queryKey: queryKeys.services.all(),
    queryFn: getAllServices,
    enabled: !selectedService,
  });

  // Fetch workers for selected service
  const { data: workersData, isLoading: workersLoading } = useQuery({
    queryKey: [queryKeys.services.workers(selectedService?.id)],
    queryFn: () => getServiceWorkers(selectedService?.id),
    enabled: selectedService && bookingMode === 'DIRECT',
  });

  // Preview pricing
  const previewPricingMutation = useMutation({
    mutationFn: () =>
      previewPrice({
        serviceId: selectedService?.id,
        workerProfileId: selectedWorker?.id,
        scheduledDate: watchScheduledDate,
        estimatedPrice: watchEstimatedPrice || selectedService?.basePrice,
        frequency,
      }),
    onSuccess: (data) => {
      setPricingData(data);
    },
    onError: () => {
      setPricingData(null);
    },
  });

  // Trigger pricing preview when relevant fields change
  useMemo(() => {
    if (selectedService?.id && watchScheduledDate && currentStep >= 2) {
      previewPricingMutation.mutate();
    }
  }, [selectedService?.id, watchScheduledDate, currentStep, previewPricingMutation]);

  // Handle coupon validation
  const handleApplyCoupon = async () => {
    if (!couponCode) return;
    setIsValidatingCoupon(true);
    try {
      const finalPrice = pricingData?.totalPrice || watchEstimatedPrice || selectedService?.basePrice;
      const result = await validateCoupon({
        code: couponCode,
        bookingAmount: finalPrice,
        serviceCategory: selectedService?.category,
      });
      setAppliedCoupon(result);
      setValue('couponCode', result.code);
      toast.success(t('Coupon applied successfully!'));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid coupon code');
      setAppliedCoupon(null);
      setValue('couponCode', '');
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  // Calculate final price
  const finalPrice = pricingData?.totalPrice || watchEstimatedPrice || selectedService?.basePrice || 0;
  const discountedPrice = appliedCoupon ? Math.max(0, finalPrice - appliedCoupon.discountAmount) : finalPrice;

  // Render steps
  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return renderServiceStep();
      case 1:
        return renderWorkerStep();
      case 2:
        return renderDetailsStep();
      case 3:
        return renderSummaryStep();
      default:
        return null;
    }
  };

  // Step 0: Service Selection
  const renderServiceStep = () => (
    <Motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
            <Ticket size={20} className="text-brand-500" /> {t('What service do you need?')}
          </h3>
        </div>

        {/* Booking Mode Selection */}
        <div className="space-y-3">
          <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">{t('Booking Type')}</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setBookingMode('DIRECT')}
              className={`p-4 rounded-xl border-2 transition-all ${
                bookingMode === 'DIRECT'
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10'
                  : 'border-neutral-200 dark:border-dark-700 hover:border-brand-300'
              }`}
            >
              <Users size={20} className="mx-auto mb-2 text-brand-500" />
              <p className="font-bold text-sm text-neutral-900 dark:text-white">{t('Direct Booking')}</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">{t('Select an expert')}</p>
            </button>
            <button
              onClick={() => setBookingMode('OPEN')}
              className={`p-4 rounded-xl border-2 transition-all ${
                bookingMode === 'OPEN'
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10'
                  : 'border-neutral-200 dark:border-dark-700 hover:border-brand-300'
              }`}
            >
              <AlertCircle size={20} className="mx-auto mb-2 text-accent-500" />
              <p className="font-bold text-sm text-neutral-900 dark:text-white">{t('Open Job')}</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">{t('Let experts bid')}</p>
            </button>
          </div>
        </div>

        {/* Service Grid */}
        <div className="space-y-3">
          <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">{t('Select Service')}</label>
          <div className="max-h-96 overflow-y-auto space-y-2">
            <AsyncState isLoading={servicesLoading} error={null}>
              {servicesData?.map((service) => (
                <button
                  key={service.id}
                  onClick={() => {
                    setSelectedService(service);
                    setValue('serviceId', service.id);
                    setSelectedWorker(null);
                    setValue('workerProfileId', '');
                  }}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    selectedService?.id === service.id
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10'
                      : 'border-neutral-200 dark:border-dark-700 hover:border-brand-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-bold text-neutral-900 dark:text-white">{service.name}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">{service.category}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-brand-600 dark:text-brand-400">₹{service.basePrice}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('Base rate')}</p>
                    </div>
                  </div>
                </button>
              ))}
            </AsyncState>
          </div>
        </div>
      </div>
    </Motion.div>
  );

  // Step 1: Worker Selection
  const renderWorkerStep = () =>
    bookingMode === 'OPEN' ? (
      <Motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
        <div className="space-y-6 text-center">
          <div>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2 flex items-center justify-center gap-2">
              <Users size={20} className="text-accent-500" /> {t('Open Job Setup')}
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {t('Experts in your area will bid for this job. You can review and select the best offer.')}
            </p>
          </div>
          <div className="bg-accent-50 dark:bg-accent-500/10 p-4 rounded-xl border border-accent-200 dark:border-accent-500/20">
            <p className="text-sm font-bold text-accent-900 dark:text-accent-100">{t('Ready to post this job?')}</p>
            <p className="text-xs text-accent-700 dark:text-accent-300 mt-2">{t('Continue to complete the job details.')}</p>
          </div>
        </div>
      </Motion.div>
    ) : (
      <Motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
        <div className="space-y-6">
          <h3 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <Users size={20} className="text-brand-500" /> {t('Choose an Expert')}
          </h3>

          {workersLoading ? (
            <div className="py-8 text-center">
              <Loader2 size={32} className="mx-auto animate-spin text-brand-500" />
            </div>
          ) : workersData?.length ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {workersData.map((worker) => (
                <button
                  key={worker.id}
                  onClick={() => {
                    setSelectedWorker(worker);
                    setValue('workerProfileId', worker.id);
                  }}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    selectedWorker?.id === worker.id
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10'
                      : 'border-neutral-200 dark:border-dark-700 hover:border-brand-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar src={worker.profilePhoto} name={worker.firstName} size="lg" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-neutral-900 dark:text-white">{worker.firstName} {worker.lastName}</p>
                        <Badge variant="success" size="sm">{worker.status}</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                        <span className="flex items-center gap-1">
                          <Star size={12} className="fill-accent-500 text-accent-500" /> {worker.avgRating?.toFixed(1)} ({worker.reviewCount})
                        </span>
                        <span>₹{worker.hourlyRate}/hr</span>
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">{worker.skills?.join(', ') || 'Multi-skilled'}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-neutral-500 dark:text-neutral-400">
              {t('No experts available for this service in your area.')}
            </div>
          )}
        </div>
      </Motion.div>
    );

  // Step 2: Location & Schedule Details
  const renderDetailsStep = () => (
    <Motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
            <MapPin size={20} className="text-brand-500" /> {t('Location & Schedule')}
          </h3>
        </div>

        <div className="space-y-6">
          {/* Date & Time */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-200 flex items-center gap-2">
              <Calendar size={16} className="text-brand-500" /> {t('Date & Time')}
            </label>
            <Input
              type="datetime-local"
              icon={Calendar}
              error={errors.scheduledDate?.message}
              className="h-12"
              {...register('scheduledDate', { required: t('Date & time is required') })}
            />
          </div>

          {/* Frequency */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-200 flex items-center gap-2">
              <Repeat size={16} className="text-brand-500" /> {t('Frequency')}
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { value: 'ONE_TIME', label: t('One Time') },
                { value: 'WEEKLY', label: t('Weekly') },
                { value: 'BI_WEEKLY', label: t('Bi-Weekly') },
                { value: 'MONTHLY', label: t('Monthly') },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setFrequency(opt.value);
                    setValue('frequency', opt.value);
                  }}
                  className={`py-2 px-3 rounded-lg text-sm font-bold transition-all border ${
                    frequency === opt.value
                      ? 'bg-brand-50 border-brand-500 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400'
                      : 'bg-white border-neutral-200 text-neutral-600 dark:bg-dark-800 dark:border-dark-700 dark:text-neutral-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Location */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-200 flex items-center gap-2">
              <MapPinIcon size={16} className="text-brand-500" /> {t('Service Location')}
            </label>
            <AddressAutocomplete
              value={selectedLocation?.address || ''}
              onChange={(loc) => {
                setSelectedLocation(loc);
                setValue('addressDetails', loc.address);
                setValue('addressLat', loc.lat);
                setValue('addressLng', loc.lng);
              }}
              placeholder={t('Search for your address...')}
            />
              <div className="rounded-xl overflow-hidden border border-neutral-200 dark:border-dark-700 h-32 sm:h-40 md:h-48">
              <LocationPicker
                initialLocation={selectedLocation}
                onChange={(loc) => {
                  if (loc?.address) {
                    setSelectedLocation(loc);
                    setValue('addressDetails', loc.address);
                    setValue('addressLat', loc.lat);
                    setValue('addressLng', loc.lng);
                  }
                }}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-200 flex items-center gap-2">
              <MessageSquare size={16} className="text-brand-500" /> {t('Special Requests (Optional)')}
            </label>
            <Textarea
              rows={3}
              placeholder={t('Any special instructions, gate codes, parking info...')}
              className="text-sm"
              {...register('notes')}
            />
          </div>

          {/* Custom Price */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-200 flex items-center gap-2">
              <IndianRupee size={16} className="text-brand-500" /> {t('Offer Price (Optional)')}
            </label>
            <Input
              type="number"
              placeholder={`Est: ₹${selectedService?.basePrice || 0}`}
              step="100"
              min="0"
              className="h-12"
              {...register('estimatedPrice')}
            />
          </div>
        </div>
      </div>
    </Motion.div>
  );

  // Step 3: Summary & Confirmation
  const renderSummaryStep = () => (
    <Motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
      <div className="space-y-6">
        <h3 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
          <CheckCircle2 size={20} className="text-brand-500" /> {t('Confirm Your Booking')}
        </h3>

        {/* Booking Summary Card */}
        <Card className="border-2 border-brand-200 dark:border-brand-500/30 bg-brand-50 dark:bg-brand-500/10 p-6 space-y-4">
          {/* Service */}
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">{t('Service')}</p>
              <p className="text-sm font-bold text-neutral-900 dark:text-white mt-1">{selectedService?.name}</p>
            </div>
            <Badge variant="default">{selectedService?.category}</Badge>
          </div>

          {/* Worker (if direct booking) */}
          {bookingMode === 'DIRECT' && selectedWorker && (
            <div className="border-t border-brand-200 dark:border-brand-500/20 pt-4">
              <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">{t('Expert')}</p>
              <div className="flex items-center gap-3 mt-1">
                <Avatar src={selectedWorker.profilePhoto} name={selectedWorker.firstName} size="md" />
                <div>
                  <p className="text-sm font-bold text-neutral-900 dark:text-white">
                    {selectedWorker.firstName} {selectedWorker.lastName}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                    <Star size={12} className="fill-accent-500 text-accent-500" /> {selectedWorker.avgRating?.toFixed(1)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Date & Location */}
          <div className="border-t border-brand-200 dark:border-brand-500/20 pt-4 space-y-3">
            <div>
              <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">{t('Date & Time')}</p>
              <p className="text-sm font-bold text-neutral-900 dark:text-white mt-1">
                {formatScheduledDateTime(watchScheduledDate)} ({frequency})
              </p>
            </div>
            {selectedLocation?.address && (
              <div>
                <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">{t('Location')}</p>
                <p className="text-sm font-bold text-neutral-900 dark:text-white mt-1 flex items-center gap-2">
                  <MapPin size={14} /> {selectedLocation.address}
                </p>
              </div>
            )}
          </div>

          {/* Pricing Section */}
          <div className="border-t border-brand-200 dark:border-brand-500/20 pt-4 space-y-2">
            <div className="flex justify-between items-center">
              <p className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">{t('Base Price')}</p>
              <p className="text-sm font-bold text-neutral-900 dark:text-white">₹{finalPrice.toFixed(2)}</p>
            </div>
            {appliedCoupon && (
              <div className="flex justify-between items-center text-success-600 dark:text-success-400">
                <p className="text-sm font-semibold">{t('Discount')} ({appliedCoupon.code})</p>
                <p className="text-sm font-bold">-₹{appliedCoupon.discountAmount.toFixed(2)}</p>
              </div>
            )}
            <div className="flex justify-between items-center border-t border-brand-200 dark:border-brand-500/20 pt-2">
              <p className="text-base font-bold text-neutral-900 dark:text-white">{t('Total')}</p>
              <p className="text-lg font-black text-brand-600 dark:text-brand-400">₹{discountedPrice.toFixed(2)}</p>
            </div>
          </div>
        </Card>

        {/* Coupon Section */}
        <div className="space-y-3">
          <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-200 flex items-center gap-2">
            <Ticket size={16} className="text-brand-500" /> {t('Apply Promo Code')}
          </label>
          {!appliedCoupon ? (
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder={t('Enter promo code')}
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                className="h-10 flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleApplyCoupon}
                loading={isValidatingCoupon}
                disabled={!couponCode || isValidatingCoupon}
              >
                {t('Apply')}
              </Button>
            </div>
          ) : (
            <div className="p-3 bg-success-50 dark:bg-success-500/10 border border-success-200 dark:border-success-500/20 rounded-lg flex items-center justify-between">
              <span className="text-sm font-bold text-success-700 dark:text-success-400">{appliedCoupon.code} {t('Applied')}</span>
              <button onClick={() => setAppliedCoupon(null)} className="text-success-600 hover:text-success-700">
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Notes Display */}
        {watchNotes && (
          <div className="p-3 bg-neutral-50 dark:bg-dark-800 rounded-lg">
            <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">{t('Special Requests')}</p>
            <p className="text-sm text-neutral-900 dark:text-white mt-1">{watchNotes}</p>
          </div>
        )}
      </div>
    </Motion.div>
  );

  // Handle navigation
  const handleNext = () => {
    if (currentStep === 0 && !selectedService) {
      toast.error(t('Please select a service'));
      return;
    }
    if (currentStep === 1 && bookingMode === 'DIRECT' && !selectedWorker) {
      toast.error(t('Please select an expert'));
      return;
    }
    if (currentStep === 2 && !watchScheduledDate) {
      toast.error(t('Please select a date and time'));
      return;
    }
    if (currentStep === 2 && !selectedLocation?.address) {
      toast.error(t('Please select a location'));
      return;
    }
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCreateBooking = async () => {
    if (isSubmitting) return;
    handleSubmit(async (data) => {
      try {
        await onSuccess({
          ...data,
          couponCode: appliedCoupon?.code || '',
          frequency,
        });
      } catch (err) {
        toast.error(err.message || t('Failed to create booking'));
      }
    })();
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between gap-2 mb-6 px-4">
          {Object.entries(STEP_TITLES).map(([ key, title], idx) => (
            <WizardStep
              key={key}
              step={idx}
              isActive={currentStep === idx}
              isCompleted={currentStep > idx}
              title={title}
              icon={[Calendar, Users, MapPin, CheckCircle2][idx]}
            />
          ))}
        </div>
        <div className="h-1 bg-neutral-200 dark:bg-dark-700 rounded-full overflow-hidden">
          <Motion.div
            className="h-full bg-gradient-to-r from-brand-400 to-brand-600"
            initial={{ width: 0 }}
            animate={{ width: `${((currentStep + 1) / 4) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Content Area */}
      <div className="mb-8">
        <AnimatePresence mode="wait">{renderStep()}</AnimatePresence>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between gap-4 sticky bottom-0 bg-white dark:bg-dark-950 p-4 rounded-t-2xl border-t border-neutral-200 dark:border-dark-700 shadow-lg">
        <Button
          variant="outline"
          icon={ChevronLeft}
          onClick={handlePrevious}
          disabled={currentStep === 0}
        >
          {t('Previous')}
        </Button>

        {currentStep < 3 ? (
          <Button
            icon={ChevronRight}
            onClick={handleNext}
            className="bg-brand-500 hover:bg-brand-600"
          >
            {t('Next')}
          </Button>
        ) : (
          <Button
            icon={CheckCircle2}
            onClick={handleCreateBooking}
            loading={isSubmitting}
            className="bg-success-500 hover:bg-success-600"
          >
            {t('Confirm Booking')}
          </Button>
        )}
      </div>
    </div>
  );
}
