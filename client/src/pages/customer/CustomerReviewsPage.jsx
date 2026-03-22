// CustomerReviewsPage - Premium review management

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Star, MessageSquare, Send, CheckCircle2, Sparkles, MapPin } from 'lucide-react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { MainLayout } from '../../components/layout/MainLayout';
import { Card, PageHeader, Badge, Button, AsyncState, Avatar } from '../../components/common';
import { createReview, getMyReviews, getPendingReviews } from '../../api/reviews';
import { queryKeys } from '../../utils/queryKeys';
import { StarRating } from '../../components/features/reviews/StarRating';
import { getRatingLabel } from '../../utils/rating';
import { getPageLayout } from '../../constants/layout';
import { usePageTitle } from '../../hooks/usePageTitle';

const formatReviewDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString();
};

export function CustomerReviewsPage() {
  usePageTitle('My Reviews');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState({});
  const [submitted, setSubmitted] = useState({});

  const pendingQuery = useQuery({
    queryKey: queryKeys.reviews.customerPending(),
    queryFn: getPendingReviews,
  });

  const reviewsQuery = useQuery({
    queryKey: queryKeys.reviews.customerWritten(),
    queryFn: getMyReviews,
  });

  const reviewMutation = useMutation({
    mutationFn: (payload) => createReview(payload),
    onSuccess: (_, variables) => {
      setSubmitted((prev) => ({ ...prev, [variables.bookingId]: true }));
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.reviews.customerPending() });
        queryClient.invalidateQueries({ queryKey: queryKeys.reviews.customerWritten() });
        queryClient.invalidateQueries({ queryKey: queryKeys.bookings.customer() });
        queryClient.invalidateQueries({ queryKey: queryKeys.profile.current() });
      }, 1500);
    },
  });

  const pendingBookings = pendingQuery.data?.bookings || [];
  const reviews = reviewsQuery.data?.reviews || [];
  const hasError = pendingQuery.isError || reviewsQuery.isError;
  const loadError = pendingQuery.error || reviewsQuery.error;

  const updateDraft = (bookingId, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [bookingId]: {
        rating: prev[bookingId]?.rating || 5,
        comment: prev[bookingId]?.comment || '',
        [field]: value,
      },
    }));
  };

  const handleSubmit = (bookingId) => {
    const draft = drafts[bookingId] || { rating: 5, comment: '' };
    reviewMutation.mutate({
      bookingId,
      rating: Number(draft.rating || 5),
      comment: draft.comment,
    });
  };

  return (
    <MainLayout>
      <div className={getPageLayout('narrow')}>
        <PageHeader
          title="My Reviews"
          subtitle="Share your feedback to help maintain our community standards."
        />

        <AsyncState
          isLoading={pendingQuery.isLoading || reviewsQuery.isLoading}
          isError={hasError}
          error={loadError}
          onRetry={() => {
            pendingQuery.refetch();
            reviewsQuery.refetch();
          }}
        >
          <div className="space-y-12">

            {/* Pending Reviews Section */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-warning-100 dark:bg-warning-500/20 text-warning-600 dark:text-warning-400 flex items-center justify-center">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-neutral-900 dark:text-white">Awaiting Review</h2>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Services that need your feedback</p>
                </div>
                {pendingBookings.length > 0 && (
                  <Badge variant="warning" size="sm" className="ml-auto" pulse>
                    {pendingBookings.length} Pending
                  </Badge>
                )}
              </div>

              {pendingBookings.length === 0 && (
                <Card className="p-10 text-center border-dashed border-2 bg-transparent shadow-none">
                  <CheckCircle2 size={48} className="mx-auto text-success-500 mb-4 opacity-50" />
                  <p className="font-bold text-neutral-900 dark:text-white mb-1">You're all caught up!</p>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">No pending reviews at the moment.</p>
                </Card>
              )}

              <AnimatePresence>
                {pendingBookings.map((booking) => {
                  const draft = drafts[booking.id] || { rating: 5, comment: '' };
                  const isSubmitted = submitted[booking.id];
                  const workerName = booking.workerProfile?.user?.name || 'Worker';

                  return (
                    <Motion.div
                      key={booking.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      className="mb-6"
                    >
                      <Card className={`overflow-hidden transition-all duration-300 ${isSubmitted ? 'ring-2 ring-success-500 ring-offset-2 dark:ring-offset-dark-900' : ''}`}>
                        
                        {/* Header Strip */}
                        <div className="px-6 py-4 flex items-center justify-between bg-neutral-50 dark:bg-dark-800/50 border-b border-neutral-100 dark:border-dark-700">
                          <div className="flex items-center gap-4">
                            <Avatar name={workerName} src={booking.workerProfile?.user?.profilePhotoUrl} size="md" />
                            <div>
                              <p
                                className="font-bold text-neutral-900 dark:text-white cursor-pointer hover:text-brand-500 transition-colors"
                                onClick={() => navigate(`/customer/bookings/${booking.id}`)}
                              >
                                {booking.service?.name || `Booking #${booking.id}`}
                              </p>
                              <p className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1 mt-0.5">
                                Completed by {workerName} on {formatReviewDate(booking.scheduledAt)}
                              </p>
                            </div>
                          </div>
                          <Badge variant="success">Completed</Badge>
                        </div>

                        {/* Body content */}
                        {isSubmitted ? (
                          <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-10 text-center">
                            <div className="w-16 h-16 rounded-full bg-success-100 dark:bg-success-500/20 flex items-center justify-center mx-auto mb-4">
                              <CheckCircle2 size={32} className="text-success-600 dark:text-success-400" />
                            </div>
                            <p className="font-black text-xl text-neutral-900 dark:text-white mb-2">Review Submitted!</p>
                            <p className="text-sm text-neutral-500 dark:text-neutral-400">Thank you for sharing your experience.</p>
                          </Motion.div>
                        ) : (
                          <div className="p-8">
                            <div className="mb-8">
                              <label className="block text-sm font-bold text-neutral-900 dark:text-white mb-4 text-center">
                                How would you rate {workerName}'s service?
                              </label>
                              <div className="flex flex-col items-center gap-3">
                                <StarRating value={draft.rating} onChange={(val) => updateDraft(booking.id, 'rating', val)} size="lg" />
                                <span className={`text-sm font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                                  draft.rating >= 4 ? 'bg-success-100 text-success-700 dark:bg-success-500/20 dark:text-success-400' :
                                  draft.rating >= 3 ? 'bg-info-100 text-info-700 dark:bg-info-500/20 dark:text-info-400' :
                                  draft.rating >= 2 ? 'bg-warning-100 text-warning-700 dark:bg-warning-500/20 dark:text-warning-400' : 'bg-error-100 text-error-700 dark:bg-error-500/20 dark:text-error-400'
                                }`}>
                                  {getRatingLabel(draft.rating)}
                                </span>
                              </div>
                            </div>

                            <div className="mb-6">
                              <label className="block text-sm font-bold text-neutral-900 dark:text-white mb-2">
                                Additional Comments (Optional)
                              </label>
                              <textarea
                                rows={3}
                                value={draft.comment}
                                onChange={(e) => updateDraft(booking.id, 'comment', e.target.value)}
                                placeholder="What went well? Highly recommend them?"
                                className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-dark-700 bg-neutral-50 dark:bg-dark-900 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all resize-none"
                              />
                            </div>

                            {reviewMutation.isError && (
                              <div className="mb-6 p-3 rounded-xl bg-error-50 dark:bg-error-500/10 text-error-600 dark:text-error-400 text-sm font-medium border border-error-100 dark:border-error-500/20">
                                {reviewMutation.error?.response?.data?.error || 'Failed to submit review. Please try again.'}
                              </div>
                            )}

                            <div className="flex justify-end">
                              <Button size="lg" icon={Send} iconPosition="right" loading={reviewMutation.isPending} onClick={() => handleSubmit(booking.id)}>
                                Post Review
                              </Button>
                            </div>
                          </div>
                        )}
                      </Card>
                    </Motion.div>
                  );
                })}
              </AnimatePresence>
            </section>

            {/* Past Reviews Section */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-neutral-900 dark:text-white">Past Reviews</h2>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Your feedback history</p>
                </div>
              </div>

              {reviews.length === 0 && (
                <Card className="p-8 text-center bg-transparent border-dashed">
                  <p className="text-neutral-500 dark:text-neutral-400 text-sm">
                    You haven't submitted any reviews yet.
                  </p>
                </Card>
              )}

              <div className="grid grid-cols-1 gap-4">
                {reviews.map((review) => (
                  <Motion.div key={review.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <Card className="p-6">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={review.reviewee?.name} src={review.reviewee?.profilePhotoUrl} size="sm" />
                          <div>
                            <p className="font-bold text-neutral-900 dark:text-white leading-tight">
                              {review.booking?.service?.name || 'Service'}
                            </p>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                              Reviewed {review.reviewee?.name || 'Worker'} on {formatReviewDate(review.createdAt)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 bg-neutral-50 dark:bg-dark-800 px-2.5 py-1 rounded-full border border-neutral-100 dark:border-dark-700">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              size={14}
                              className={i < review.rating ? 'fill-warning-400 text-warning-400' : 'text-neutral-200 dark:text-neutral-700'}
                            />
                          ))}
                        </div>
                      </div>

                      {review.comment && (
                        <div className="p-4 rounded-xl bg-neutral-50 dark:bg-dark-800/50 text-neutral-600 dark:text-neutral-300 text-sm leading-relaxed border border-neutral-100 dark:border-dark-700">
                          "{review.comment}"
                        </div>
                      )}
                    </Card>
                  </Motion.div>
                ))}
              </div>
            </section>

          </div>
        </AsyncState>
      </div>
    </MainLayout>
  );
}
