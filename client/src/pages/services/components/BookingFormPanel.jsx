import { useState } from 'react';
import { CalendarClock, MapPin, IndianRupee, User, MessageSquare, Zap, FileText, CheckCircle2, Ticket, X, AlertCircle, Repeat } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Input, Textarea, Button, Badge } from '../../../components/common';
import { LocationPicker } from '../../../components/features/location/LocationPicker';
import { AddressAutocomplete } from '../../../components/features/location/AddressAutocomplete';
import { validateCoupon } from '../../../api/growth';
import { formatCurrencyCompact } from '../../../utils/formatters';
import { toastSuccess, toastErrorFromResponse } from '../../../utils/notifications';

import { useTranslation } from 'react-i18next';

const getFrequencyOptions = (t) => [
  { value: 'ONE_TIME', label: t('One Time') },
  { value: 'WEEKLY', label: t('Weekly') },
  { value: 'BI_WEEKLY', label: t('Bi-Weekly') },
  { value: 'MONTHLY', label: t('Monthly') },
];

export function BookingFormPanel({
  service,
  bookingMode,
  activeMode,
  selectedWorker,
  register,
  handleSubmit,
  onSubmit,
  errors,
  isSubmitting,
  estimatedPrice,
  selectedLocation,
  setSelectedLocation,
  setValue,
  serverError,
  successMessage,
  pricingData,
  isPricing,
}) {
  const { t } = useTranslation();
  const FREQUENCY_OPTIONS = getFrequencyOptions(t);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [frequency, setFrequency] = useState('ONE_TIME');

  const handleApplyCoupon = async () => {
    if (!couponCode) return;
    setIsValidating(true);
    try {
      const result = await validateCoupon({
        code: couponCode,
        bookingAmount: pricingData?.totalPrice || estimatedPrice || (selectedWorker ? selectedWorker.hourlyRate : service.basePrice),
        serviceCategory: service.category
      });
      setAppliedCoupon(result);
      setValue('couponCode', result.code);
      toastSuccess(t('Coupon applied successfully!'));
    } catch (err) {
      toastErrorFromResponse(err, 'Invalid coupon code');
      setAppliedCoupon(null);
      setValue('couponCode', '');
    } finally {
      setIsValidating(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setValue('couponCode', '');
  };

  const finalTotalPrice = pricingData?.totalPrice || estimatedPrice || (selectedWorker ? selectedWorker.hourlyRate : service.basePrice);
  const discountedPrice = appliedCoupon ? Math.max(0, finalTotalPrice - appliedCoupon.discountAmount) : finalTotalPrice;
  const formatINR = (value) => formatCurrencyCompact(Number(value || 0));

  return (
    <div className="rounded-[3rem] shadow-2xl overflow-hidden border border-white/40 bg-slate-50/90 dark:bg-dark-900/90 dark:border-dark-700/50 relative shadow-brand-500/5 backdrop-blur-3xl">
      {/* Integrated Header */}
      <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-brand-400 via-accent-500 to-brand-600" />
      <div className="px-10 py-8 border-b border-neutral-200/50 dark:border-dark-800 bg-white/40 dark:bg-dark-950/40 z-10 relative">
        <h2 className="text-3xl font-black mb-1.5 text-neutral-900 dark:text-white tracking-tighter">{t('Instant Booking')}</h2>
        <p className="text-sm font-bold text-neutral-500 dark:text-neutral-400 opacity-80">{t('Finalize your request with a verified expert.')}</p>
      </div>

      <div className="p-8 space-y-7">
        <form onSubmit={handleSubmit(onSubmit)}>
          <input type="hidden" {...register('workerProfileId')} />
          <input type="hidden" {...register('couponCode')} />
          <input type="hidden" {...register('frequency')} value={frequency} />

          <AnimatePresence>
            {bookingMode === 'DIRECT' && !selectedWorker && (
              <Motion.div 
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="mb-6 p-4 rounded-2xl bg-warning-50 dark:bg-warning-500/10 text-warning-800 dark:text-warning-300 border border-warning-200 dark:border-warning-500/20 flex items-start gap-3 shadow-sm"
              >
                <AlertCircle size={20} className="mt-0.5 shrink-0" strokeWidth={2.5} />
                <span className="text-sm font-bold">{t('Please select an expert from the list on the left to continue.')}</span>
              </Motion.div>
            )}
          </AnimatePresence>

          {/* Form Fields */}
          <div className="space-y-6">
            {/* Date Time */}
            <div className="group">
              <Input
                type="datetime-local"
                label={t("Date & Time")}
                icon={CalendarClock}
                error={errors.scheduledDate?.message}
                className="h-14 bg-neutral-50 dark:bg-dark-800/50 border-neutral-200/80 dark:border-dark-700 focus:bg-white dark:focus:bg-dark-900 text-lg font-bold"
                {...register('scheduledDate')}
              />
            </div>

            {/* Frequency Selection (Sprint 17 - #78) */}
            <div className="space-y-2.5">
              <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-200 flex items-center gap-2">
                <Repeat size={16} className="text-brand-500" /> {t('Booking Frequency')}
              </label>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {FREQUENCY_OPTIONS.map(opt => {
                  const isActive = frequency === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                         setFrequency(opt.value);
                         setValue('frequency', opt.value, { shouldValidate: true });
                      }}
                      className={`py-3 px-2 rounded-xl text-sm font-bold transition-all border ${isActive ? 'bg-brand-50 border-brand-500 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400 shadow-sm' : 'bg-white border-neutral-200 text-neutral-600 hover:border-brand-300 dark:bg-dark-800 dark:border-dark-700 dark:text-neutral-400 dark:hover:border-dark-600'}`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Address Autocomplete (Google Places) */}
            <div className="space-y-4">
              <AddressAutocomplete
                value={selectedLocation?.address || ''}
                onChange={(loc) => {
                  setSelectedLocation(loc);
                  setValue('addressDetails', loc.address, { shouldDirty: true, shouldValidate: true });
                  setValue('addressLat', loc.lat);
                  setValue('addressLng', loc.lng);
                  setValue('addressDetailsStructured', loc.details);
                }}
                placeholder={t("Search for your address...")}
              />
              <div className="rounded-2xl overflow-hidden border border-neutral-200/80 dark:border-dark-700">
                <LocationPicker
                  initialLocation={selectedLocation}
                  onChange={(loc) => {
                    setSelectedLocation(loc);
                    if (loc?.address) {
                      setValue('addressDetails', loc.address, { shouldDirty: true, shouldValidate: true });
                      setValue('addressLat', loc.lat);
                      setValue('addressLng', loc.lng);
                      setValue('addressDetailsStructured', loc.details);
                    }
                  }}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="group">
              <Textarea
                label={t("Special Requests (Optional)")}
                rows={2}
                placeholder={t("Any parking instructions, Gate codes, specific needs...")}
                icon={MessageSquare}
                className="bg-white/50 dark:bg-dark-800/50 border-neutral-200/80 dark:border-dark-700 text-sm focus:bg-white dark:focus:bg-dark-900 transition-all duration-300 rounded-2xl"
                {...register('notes')}
              />
            </div>

            <div className="space-y-6">
              {/* Optional Price Input */}
              <Input
                type="number"
                label={t("Offer Price (Optional)")}
                icon={IndianRupee}
                placeholder={`Est: ${formatINR(selectedWorker ? selectedWorker.hourlyRate : service.basePrice)}`}
                hint={t("Propose a custom budget")}
                className="group"
                {...register('estimatedPrice')}
              />

              {/* Coupon Code Inline Input */}
              <Input
                label={t("Promo Coupon")}
                icon={Ticket}
                placeholder={t("PROMOCODE")}
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                disabled={!!appliedCoupon}
                inputClassName="uppercase tracking-[0.1em] font-black"
                className="group"
                rightElement={
                  <AnimatePresence mode="wait">
                    {!appliedCoupon ? (
                      <Motion.div key="apply" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
                        <Button 
                          type="button" 
                          variant="primary" 
                          size="sm"
                          loading={isValidating} 
                          onClick={handleApplyCoupon} 
                          className="h-8 px-4 rounded-lg font-black uppercase tracking-widest text-[9px] shadow-md shadow-brand-500/20" 
                        >
                          {t('Apply')}
                        </Button>
                      </Motion.div>
                    ) : (
                      <Motion.div key="applied" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-1.5">
                        <Badge variant="success" className="h-8 px-2.5 rounded-lg font-black uppercase tracking-widest text-[8px] bg-success-500 text-white border-none gap-1.5">
                          <CheckCircle2 size={10} strokeWidth={3} /> {t('Success')}
                        </Badge>
                        <button 
                          type="button" 
                          onClick={removeCoupon} 
                          className="text-neutral-400 hover:text-error-500 p-1 transition-all"
                        >
                          <X size={14} strokeWidth={2.5} />
                        </button>
                      </Motion.div>
                    )}
                  </AnimatePresence>
                }
              />
            </div>
            
          </div>

          {/* Pricing Summary Block */}
          <div className="mt-8 p-6 rounded-3xl border bg-neutral-50/80 border-neutral-100/80 shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)] dark:bg-dark-950/50 dark:border-dark-800 relative overflow-hidden group">
            {/* Soft glow in background */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-brand-500/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
            
            <div className="relative z-10 flex justify-between items-center mb-5 pb-5 border-b border-neutral-200/60 dark:border-dark-800 border-dashed">
              <span className="text-neutral-500 dark:text-neutral-400 text-xs font-black uppercase tracking-widest">{t('Base Rate')}</span>
              <span className="font-bold text-neutral-900 dark:text-white px-3 py-1 bg-white dark:bg-dark-800 border border-neutral-200/50 dark:border-dark-700 rounded-lg shadow-sm">
                {service.name}
              </span>
            </div>

            {pricingData && (
              <div className="space-y-3.5 pb-5 mb-5 border-b border-neutral-200/60 border-dashed dark:border-dark-800">
                <div className="flex justify-between items-center text-sm font-semibold">
                  <span className="text-neutral-500">{t('Service Fee')}</span>
                  <span className="text-neutral-700 dark:text-neutral-300">{formatINR(pricingData.basePrice)}</span>
                </div>

                {pricingData.timeMultiplier > 1 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-neutral-500 font-medium flex items-center gap-1.5"><CalendarClock size={14} className="text-warning-500" /> {t('Premium Timing')}</span>
                    <span className="text-warning-600 font-black">x{pricingData.timeMultiplier}</span>
                  </div>
                )}

                {pricingData.surgeMultiplier > 1 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="flex items-center gap-1.5 font-bold text-error-600">
                      <Zap size={14} fill="currentColor" /> {t('Peak Demand Surge')}
                    </span>
                    <span className="font-black text-error-600">x{pricingData.surgeMultiplier}</span>
                  </div>
                )}

                {pricingData.gstAmount > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-neutral-400 font-medium">{t('Taxes & Fees')} (GST 18%)</span>
                    <span className="text-neutral-500 font-bold">+{formatINR(pricingData.gstAmount)}</span>
                  </div>
                )}
              </div>
            )}

            <AnimatePresence>
              {appliedCoupon && (
                <Motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="mb-6 overflow-hidden">
                  <div className="flex justify-between items-center p-4 rounded-[1.5rem] bg-gradient-to-br from-success-50/80 to-emerald-50/50 dark:from-success-500/10 dark:to-emerald-500/5 text-success-700 dark:text-success-400 border border-success-200/50 dark:border-success-500/30 shadow-sm relative group/promo">
                    <div className="absolute inset-0 bg-white/40 dark:bg-transparent animate-pulse" />
                    <div className="flex items-center gap-2.5 relative z-10">
                      <div className="p-2 bg-success-500 text-white rounded-xl shadow-lg shadow-success-500/20">
                        <Ticket size={16} strokeWidth={3} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-70">{t('Reward Applied')}</span>
                        <span className="text-xs font-black uppercase tracking-[0.1em]">{appliedCoupon.code}</span>
                      </div>
                    </div>
                    <span className="font-black text-2xl relative z-10 tracking-tighter">-{formatINR(appliedCoupon.discountAmount)}</span>
                  </div>
                </Motion.div>
              )}
            </AnimatePresence>

            <div className="flex justify-between items-end relative z-10 pt-1">
              <div>
                <span className="block text-[11px] font-black text-neutral-400 uppercase tracking-widest mb-1.5">{t('Total Payable')}</span>
                <span className="text-4xl font-black text-neutral-900 dark:text-white flex items-center gap-3 tracking-tighter">
                  {isPricing ? (
                    <div className="w-28 h-10 bg-neutral-200 dark:bg-dark-700 animate-pulse rounded-xl" />
                  ) : (
                    <>
                      {appliedCoupon ? (
                        <div className="flex items-baseline gap-3">
                          <span className="text-neutral-300 dark:text-dark-600 line-through text-xl font-bold decoration-2">{formatINR(finalTotalPrice)}</span>
                          <span className="text-transparent bg-clip-text bg-gradient-to-r from-success-500 to-emerald-400">{formatINR(discountedPrice)}</span>
                        </div>
                      ) : (
                        formatINR(finalTotalPrice)
                      )}
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="mt-8">
            <AnimatePresence>
              {serverError && (
                <Motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="mb-5 p-4 rounded-2xl bg-error-50 text-error-600 text-sm border border-error-100 flex items-start gap-3 dark:bg-error-500/10 dark:border-error-500/20 dark:text-error-400 shadow-sm">
                  <AlertCircle size={20} className="shrink-0 mt-0.5" strokeWidth={2.5} />
                  <span className="font-bold leading-relaxed">{serverError}</span>
                </Motion.div>
              )}
              {successMessage && (
                <Motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="mb-5 p-4 rounded-2xl bg-success-50 text-success-600 text-sm border border-success-100 flex items-start gap-3 dark:bg-success-500/10 dark:border-success-500/20 dark:text-success-400 shadow-sm">
                  <CheckCircle2 size={20} className="shrink-0 mt-0.5" strokeWidth={2.5} />
                  <span className="font-bold leading-relaxed">{successMessage}</span>
                </Motion.div>
              )}
            </AnimatePresence>

            <Button
              type="submit"
              fullWidth
              variant="gradient"
              loading={isSubmitting}
              disabled={!activeMode?.enabled || (bookingMode === 'DIRECT' && !selectedWorker)}
              className="h-16 text-xl font-black rounded-2xl shadow-brand-lg hover:shadow-brand-hover tracking-tight"
            >
              {bookingMode === 'AUTO_ASSIGN' ? t('Find Expert Now') : t('Confirm & Book')}
            </Button>

            <div className="mt-5 flex items-center justify-center gap-2 text-[11px] font-black text-neutral-400 uppercase tracking-widest bg-neutral-50 dark:bg-dark-800/50 py-2 rounded-xl">
              <Zap size={14} fill="currentColor" className="text-warning-500" />
              <span>{t('Zero cancellation fee within 5 minutes')}</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
