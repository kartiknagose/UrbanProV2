// Worker Reviews Page - Premium Dual Review Interface

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Star, MessageSquare, User, Send, CheckCircle2, TrendingUp, History } from 'lucide-react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../components/layout/MainLayout';
import { Card, PageHeader, Badge, Button, AsyncState, Textarea, Avatar } from '../../components/common';
import { createReview, getReviewsAboutMe, getMyReviews, getPendingReviews } from '../../api/reviews';
import { queryKeys } from '../../utils/queryKeys';
import { StarRating } from '../../components/features/reviews/StarRating';
import { getRatingLabel } from '../../utils/rating';
import { getPageLayout } from '../../constants/layout';
import { usePageTitle } from '../../hooks/usePageTitle';

const formatReviewDate = (value, locale) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
};

export function WorkerReviewsPage() {
  const { t } = useTranslation();
  usePageTitle(t('Reviews'));
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState({});
  const [submitted, setSubmitted] = useState({});
  const [activeTab, setActiveTab] = useState('received');

  const receivedQuery = useQuery({ queryKey: queryKeys.reviews.workerReceived(), queryFn: getReviewsAboutMe });
  const writtenQuery = useQuery({ queryKey: queryKeys.reviews.workerWritten(), queryFn: getMyReviews });
  const pendingQuery = useQuery({ queryKey: queryKeys.reviews.workerPending(), queryFn: getPendingReviews });

  const reviewMutation = useMutation({
    mutationFn: (payload) => createReview(payload),
    onSuccess: (_, variables) => {
      setSubmitted((prev) => ({ ...prev, [variables.bookingId]: true }));
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.reviews.workerReceived() });
        queryClient.invalidateQueries({ queryKey: queryKeys.reviews.workerWritten() });
        queryClient.invalidateQueries({ queryKey: queryKeys.reviews.workerPending() });
        queryClient.invalidateQueries({ queryKey: queryKeys.bookings.worker() });
        queryClient.invalidateQueries({ queryKey: queryKeys.worker.profile() });
      }, 1500);
    },
  });

  const receivedReviews = receivedQuery.data?.reviews || [];
  const writtenReviews = writtenQuery.data?.reviews || [];
  const pendingBookings = pendingQuery.data?.bookings || [];
  const hasError = receivedQuery.isError || writtenQuery.isError || pendingQuery.isError;
  const loadError = receivedQuery.error || writtenQuery.error || pendingQuery.error;
  const isLoading = receivedQuery.isLoading || writtenQuery.isLoading || pendingQuery.isLoading;

  const avgRating = receivedReviews.length > 0
    ? (receivedReviews.reduce((sum, r) => sum + r.rating, 0) / receivedReviews.length).toFixed(1)
    : '0.0';

  const updateDraft = (bookingId, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [bookingId]: { rating: prev[bookingId]?.rating || 5, comment: prev[bookingId]?.comment || '', [field]: value },
    }));
  };

  const handleSubmit = (bookingId) => {
    const draft = drafts[bookingId] || { rating: 5, comment: '' };
    reviewMutation.mutate({ bookingId, rating: Number(draft.rating || 5), comment: draft.comment });
  };

  const tabs = [
    { id: 'received', label: t('Customer Feedback'), count: receivedReviews.length, icon: Star },
    { id: 'pending', label: t('Rate Customers'), count: pendingBookings.length, icon: MessageSquare, alert: pendingBookings.length > 0 },
    { id: 'written', label: t('Sent Reviews'), count: writtenReviews.length, icon: History },
  ];

  return (
    <MainLayout>
      <div className={getPageLayout('default')}>
        <PageHeader title={t("Reviews Overview")} subtitle={t("Read your feedback and evaluate the customers you served.")} />

        <AsyncState isLoading={isLoading} isError={hasError} error={loadError} onRetry={() => { receivedQuery.refetch(); writtenQuery.refetch(); pendingQuery.refetch(); }}>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
            
            {/* Main Content Area */}
            <div className="space-y-8">
              
              {/* Tab Navigation */}
              <div role="tablist" aria-label="Review segments" className="p-1.5 flex flex-wrap gap-2 rounded-2xl bg-neutral-100/50 dark:bg-dark-800/30 border border-neutral-200/50 dark:border-dark-700 w-fit">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActiveTab(tab.id)}
                      className={`relative flex items-center gap-3 px-6 py-3 rounded-2xl text-sm font-bold uppercase tracking-wider transition-all duration-500 ${
                        isActive
                          ? 'bg-white dark:bg-dark-950 text-brand-600 dark:text-brand-400 shadow-xl shadow-brand-500/5 border border-neutral-100 dark:border-dark-800'
                          : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                      }`}
                    >
                      <Icon size={18} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'animate-pulse' : ''} />
                      {tab.label}
                      {tab.count > 0 && (
                        <span className={`ml-1 flex items-center justify-center min-w-[24px] h-6 px-2 rounded-lg text-[10px] font-bold ${
                          isActive ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30' : 'bg-neutral-200/50 text-neutral-500 dark:bg-dark-700'
                        }`}>
                          {tab.count}
                        </span>
                      )}
                      {tab.alert && !isActive && (
                        <span className="absolute top-0 right-0 -mt-1 -mr-1 w-3 h-3 bg-error-500 rounded-full animate-ping shadow-sm" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Dynamic Content Panel */}
              <AnimatePresence mode="wait">
                
                {activeTab === 'received' && (
                  <Motion.div key="received" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.02 }} className="space-y-6">
                    {receivedReviews.length === 0 ? (
                      <Card className="p-20 text-center bg-neutral-50/50 dark:bg-dark-900/30 border-dashed border-2 border-neutral-200 dark:border-dark-800 rounded-[3rem]">
                        <div className="w-20 h-20 rounded-[2.5rem] bg-neutral-100 dark:bg-dark-800 flex items-center justify-center mx-auto mb-6 shadow-inner">
                          <TrendingUp size={40} className="text-neutral-300 dark:text-dark-600" />
                        </div>
                        <h3 className="font-bold text-2xl text-neutral-900 dark:text-white mb-2">{t('No feedback yet')}</h3>
                        <p className="text-neutral-500 font-medium max-w-sm mx-auto leading-relaxed">{t('Complete high-quality jobs to start receiving 5-star reviews from Indian customers.')}</p>
                      </Card>
                    ) : (
                      <div className="space-y-6">
                        {receivedReviews.map((review) => (
                          <Card key={review.id} className="p-8 transition-all hover:translate-x-1 duration-500 bg-white dark:bg-dark-900 shadow-sm border-neutral-100 dark:border-dark-800 rounded-[2.5rem] relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/5 dark:bg-brand-500/10 rounded-bl-[4rem] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="flex flex-col sm:flex-row gap-6 items-start justify-between relative z-10">
                              <div className="flex items-center gap-5">
                                <Avatar name={review.reviewer?.name} size="lg" className="ring-4 ring-neutral-50 dark:ring-dark-800 shadow-lg" />
                                <div>
                                  <p className="font-bold text-xl text-neutral-900 dark:text-white leading-tight uppercase tracking-tight">
                                    {review.reviewer?.name || t('Verified Customer')}
                                  </p>
                                  <p className="text-sm font-medium text-brand-500 mt-1 flex items-center gap-2">
                                    <span className="opacity-60">{review.booking?.service?.name || t('Service Job')}</span>
                                    <span className="w-1 h-1 rounded-full bg-neutral-300" />
                                    <span className="text-neutral-400 font-bold uppercase tracking-widest text-[10px]">{formatReviewDate(review.createdAt)}</span>
                                  </p>
                                </div>
                              </div>
                              <div className="bg-success-50 dark:bg-success-500/5 px-5 py-2.5 rounded-2xl border border-success-100 dark:border-success-500/20 shadow-inner flex items-center gap-2 group-hover:scale-110 transition-transform">
                                <Star size={18} className="fill-success-500 text-success-500" />
                                <span className="font-bold text-lg text-success-700 dark:text-success-400">{review.rating}.0</span>
                              </div>
                            </div>
                            {review.comment && (
                              <div className="mt-6 relative">
                                <p className="text-base font-medium leading-relaxed text-neutral-700 dark:text-neutral-300 bg-neutral-50/50 dark:bg-dark-950/50 p-6 rounded-[2rem] rounded-tl-none border border-neutral-100 dark:border-dark-800 italic relative z-10">
                                  "{review.comment}"
                                </p>
                                <div className="absolute -left-2 top-0 w-10 h-10 bg-neutral-50/50 dark:bg-dark-950/50 -z-0" />
                              </div>
                            )}
                          </Card>
                        ))}
                      </div>
                    )}
                  </Motion.div>
                )}

                {activeTab === 'pending' && (
                  <Motion.div key="pending" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
                    {pendingBookings.length === 0 ? (
                      <Card className="p-20 text-center bg-neutral-50/50 dark:bg-dark-900/30 border-dashed border-2 border-neutral-200 dark:border-dark-800 rounded-[3rem]">
                        <div className="w-20 h-20 rounded-full bg-success-50 dark:bg-success-500/10 flex items-center justify-center mx-auto mb-6 shadow-inner">
                          <CheckCircle2 size={40} className="text-success-500" />
                        </div>
                        <h3 className="font-bold text-2xl text-neutral-900 dark:text-white mb-2">{t('Queue Empty')}</h3>
                        <p className="text-neutral-500 font-medium max-w-sm mx-auto">{t('You are all caught up! You have rated all your past customers.')}</p>
                      </Card>
                    ) : (
                      pendingBookings.map((booking) => {
                        const draft = drafts[booking.id] || { rating: 5, comment: '' };
                        const isSubmitted = submitted[booking.id];

                        return (
                          <Card key={booking.id} className={`overflow-hidden transition-all duration-700 shadow-2xl border-none rounded-[3rem] ${isSubmitted ? 'scale-[0.95] opacity-50 backdrop-blur-xl' : ''} bg-white dark:bg-dark-900`}>
                             <div className="px-8 py-6 flex flex-wrap items-center justify-between gap-4 bg-neutral-50/50 dark:bg-dark-950/50 border-b border-neutral-100 dark:border-dark-800">
                               <div className="flex items-center gap-4">
                                 <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-600 flex items-center justify-center shadow-inner">
                                   <User size={24} />
                                 </div>
                                 <div>
                                   <p className="font-bold text-lg text-neutral-900 dark:text-white leading-tight uppercase tracking-tight">{t('Rate your client')}: {booking.customer?.name || t('Customer')}</p>
                                   <p className="text-xs font-bold uppercase tracking-widest text-neutral-400 mt-1">
                                     {booking.service?.name} • ID #{booking.id}
                                   </p>
                                 </div>
                               </div>
                               <Badge variant="neutral" size="sm" className="rounded-lg uppercase tracking-widest font-bold font-mono">NEEDS_INPUT</Badge>
                             </div>

                            {isSubmitted ? (
                               <div className="p-16 text-center">
                                 <Motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 10 }}>
                                   <CheckCircle2 size={64} className="mx-auto text-success-500 mb-4" />
                                 </Motion.div>
                                 <p className="font-bold text-2xl text-neutral-900 dark:text-white">{t('Rating Logged Successfully')}</p>
                               </div>
                            ) : (
                               <div className="p-8 space-y-8">
                                 <div className="bg-neutral-50/50 dark:bg-dark-950/50 p-8 rounded-[2rem] border border-neutral-100 dark:border-dark-800">
                                   <label className="block text-sm font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-widest mb-6 text-center">{t('Overall Experience')}</label>
                                  <div className="flex flex-col items-center gap-6">
                                    <StarRating value={draft.rating} onChange={(val) => updateDraft(booking.id, 'rating', val)} size="lg" />
                                     <span className={`text-sm font-bold uppercase tracking-[0.2em] px-6 py-2 rounded-full shadow-lg transition-all duration-500 transform ${
                                       draft.rating >= 4 ? 'bg-success-500 text-white shadow-success-500/20' :
                                       draft.rating >= 3 ? 'bg-brand-500 text-white shadow-brand-500/20' :
                                       'bg-error-500 text-white shadow-error-500/20'
                                     }`}>
                                       {t(getRatingLabel(draft.rating))}
                                     </span>
                                  </div>
                                </div>
                                 <div className="px-4">
                                   <Textarea label={t("Private Notes (Optional)")} rows={3} value={draft.comment} onChange={(e) => updateDraft(booking.id, 'comment', e.target.value)} placeholder={t("E.g., Easy to work with, prompt payment. Highly recommended customer.")}
                                     className="rounded-[2rem] p-6 focus:ring-4 focus:ring-brand-500/10 border-2"
                                   />
                                 </div>
                                 {reviewMutation.isError && <p className="text-sm font-bold text-error-500 px-4">{reviewMutation.error?.response?.data?.error || t('Submission failed. Please check your connection.')}</p>}
                                 <div className="flex justify-center pt-2 px-4 pb-4">
                                   <Button size="lg" variant="gradient" className="w-full h-16 rounded-3xl font-bold uppercase tracking-widest text-base shadow-2xl shadow-brand-500/30" icon={Send} loading={reviewMutation.isPending} onClick={() => handleSubmit(booking.id)}>{t('Post Review for Client')}</Button>
                                 </div>
                              </div>
                            )}
                          </Card>
                        );
                      })
                    )}
                  </Motion.div>
                )}

                {activeTab === 'written' && (
                  <Motion.div key="written" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.02 }} className="space-y-6">
                    {writtenReviews.length === 0 ? (
                      <Card className="p-20 text-center bg-neutral-50/50 dark:bg-dark-900/30 border-dashed border-2 border-neutral-200 dark:border-dark-800 rounded-[3rem]">
                        <div className="w-20 h-20 rounded-full bg-neutral-100 dark:bg-dark-800 flex items-center justify-center mx-auto mb-6 shadow-inner">
                          <History size={40} className="text-neutral-300 dark:text-dark-600" />
                        </div>
                        <h3 className="font-bold text-2xl text-neutral-900 dark:text-white mb-2">{t('No history')}</h3>
                        <p className="text-neutral-500 font-medium max-w-sm mx-auto">{t('Ratings you give to customers will appear here in chronological order.')}</p>
                      </Card>
                    ) : (
                      writtenReviews.map((review) => (
                        <Card key={review.id} className="p-6 border-neutral-100 dark:border-dark-800 rounded-[2rem] bg-white dark:bg-dark-900 hover:shadow-xl transition-all duration-500 group">
                          <div className="flex items-start justify-between gap-4 mb-4">
                             <div className="flex items-center gap-4">
                               <div className="w-12 h-12 rounded-2xl bg-neutral-50 dark:bg-dark-950 flex items-center justify-center text-neutral-400 group-hover:text-brand-500 transition-colors">
                                 <User size={24} />
                               </div>
                               <div>
                                 <p className="font-bold text-lg text-neutral-900 dark:text-white leading-tight uppercase tracking-tight">
                                   {t('You rated')} {review.reviewee?.name || t('Customer')}
                                 </p>
                                <p className="text-xs font-bold uppercase tracking-widest text-neutral-400 mt-1">
                                  {review.booking?.service?.name} • {formatReviewDate(review.createdAt, undefined)}
                                </p>
                               </div>
                             </div>
                            <div className="flex gap-1.5 shrink-0 bg-neutral-50 dark:bg-dark-950 p-2.5 rounded-2xl border border-neutral-100 dark:border-dark-800 shadow-inner">
                              {[...Array(5)].map((_, i) => (
                                <Star key={i} size={14} className={i < review.rating ? 'fill-warning-400 text-warning-400' : 'text-neutral-200 dark:text-dark-800'} />
                              ))}
                            </div>
                          </div>
                          {review.comment && (
                            <div className="bg-neutral-50/50 dark:bg-dark-950/50 p-5 rounded-2xl border border-neutral-100 dark:border-dark-800 italic text-sm text-neutral-600 dark:text-neutral-400 font-medium">
                              "{review.comment}"
                            </div>
                          )}
                        </Card>
                      ))
                    )}
                  </Motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Sidebar Rating Card */}
            <div className="order-first lg:order-last">
              <div className="sticky top-24">
                <Card className="relative overflow-hidden border-none shadow-2xl rounded-[3rem] group">
                  <div className="absolute inset-0 bg-neutral-900 dark:bg-dark-950 z-0" />
                  <div className="absolute inset-0 bg-gradient-to-br from-brand-600/90 to-accent-600/90 opacity-90 z-1" />
                  <div className="absolute -top-10 -right-10 w-64 h-64 bg-white/20 rounded-full blur-[80px] z-2" />
                  <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-brand-500/30 rounded-full blur-[60px] z-2" />
                  
                  <div className="relative z-10 p-10 text-center text-white">
                     <p className="text-sm font-bold uppercase tracking-[0.3em] text-white/60 mb-4">{t('Profile Score')}</p>
                     <div className="text-8xl font-black mb-4 drop-shadow-2xl">{avgRating}</div>
                    <div className="flex justify-center gap-2 mb-6">
                       {[...Array(5)].map((_, i) => (
                         <Star key={i} size={24} className={i < Math.round(Number(avgRating)) ? 'fill-yellow-400 text-yellow-400 drop-shadow-lg scale-110' : 'text-white/20'} />
                       ))}
                    </div>
                     <p className="text-base font-bold text-white/80 uppercase tracking-widest">{t('Trust Rating')}</p>
                     <p className="text-xs font-medium text-white/50 mt-1">{t('Based on')} {receivedReviews.length} {t('verified reviews')}</p>
                   </div>

                  {/* Micro stat bars */}
                  <div className="relative z-10 px-10 pb-10 pt-2 space-y-4">
                    {[5, 4, 3, 2, 1].map((star) => {
                      const count = receivedReviews.filter((r) => r.rating === star).length;
                      const pct = receivedReviews.length > 0 ? (count / receivedReviews.length) * 100 : 0;
                      return (
                        <div key={star} className="flex items-center gap-4 text-xs font-bold text-white/70">
                          <span className="w-3 text-right">{star}</span>
                          <Star size={12} className="fill-white/70 shrink-0" />
                          <div className="flex-1 h-2 rounded-full overflow-hidden bg-black/40 shadow-inner">
                            <Motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, ease: 'easeOut' }} className="h-full bg-gradient-to-r from-yellow-500 to-yellow-300 rounded-full shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
                          </div>
                          <span className="w-4 text-right font-mono opacity-60 font-black">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>
            </div>

          </div>
        </AsyncState>
      </div>
    </MainLayout>
  );
}
