// Customer Reviews Page - Two-Way Review System
// Customers can review workers for completed bookings

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Star, MessageSquare, Send, CheckCircle2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MainLayout } from '../../components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardDescription, PageHeader } from '../../components/common';
import { Badge, Button, AsyncState } from '../../components/common';
import { useTheme } from '../../context/ThemeContext';
import { createReview, getMyReviews, getPendingReviews } from '../../api/reviews';
import { queryKeys } from '../../utils/queryKeys';
import { StarRating, getRatingLabel } from '../../components/features/reviews/StarRating';


export function CustomerReviewsPage() {
  const { isDark } = useTheme();
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
        queryClient.invalidateQueries({ queryKey: ['profile'] });
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

  const isLoading = pendingQuery.isLoading || reviewsQuery.isLoading;

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <PageHeader
          title="Reviews"
          subtitle="Share your experience to help the community make better choices."
        />

        <AsyncState
          isLoading={isLoading}
          isError={hasError}
          error={loadError}
        >
          <div className="space-y-10">

            {/* Pending Reviews Section */}
            <section>
              <div className="flex items-center gap-2 mb-5">
                <Sparkles size={20} className="text-yellow-500" />
                <h2 className={`text-xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                  Pending Reviews ({pendingBookings.length})
                </h2>
              </div>

              {pendingBookings.length === 0 && (
                <Card className="p-8 text-center">
                  <CheckCircle2 size={40} className="mx-auto text-green-500 mb-3" />
                  <p className={isDark ? 'text-gray-300' : 'text-gray-600'}>
                    All caught up! No bookings waiting for your review.
                  </p>
                </Card>
              )}

              <AnimatePresence>
                {pendingBookings.map((booking) => {
                  const draft = drafts[booking.id] || { rating: 5, comment: '' };
                  const isSubmitted = submitted[booking.id];

                  return (
                    <motion.div
                      key={booking.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="mb-4"
                    >
                      <Card className={`overflow-hidden transition-all duration-300 ${isSubmitted ? 'ring-2 ring-green-500/50' : ''
                        }`}>
                        {/* Header Strip */}
                        <div className={`px-6 py-3 flex items-center justify-between ${isDark
                          ? 'bg-gradient-to-r from-brand-900/40 to-transparent border-b border-dark-600'
                          : 'bg-gradient-to-r from-brand-50 to-transparent border-b border-gray-100'
                          }`}>
                          <div>
                            <p
                              className={`font-black uppercase text-sm cursor-pointer hover:text-brand-500 transition-colors ${isDark ? 'text-gray-100' : 'text-gray-900'}`}
                              onClick={() => navigate(`/bookings/${booking.id}`)}
                            >
                              {booking.service?.name || `Service #${booking.serviceId}`}
                            </p>
                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              Worker: {booking.workerProfile?.user?.name || 'Worker'} · {new Date(booking.scheduledAt).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge variant="success">Completed</Badge>
                        </div>

                        {isSubmitted ? (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="p-8 text-center"
                          >
                            <CheckCircle2 size={48} className="mx-auto text-green-500 mb-3" />
                            <p className={`font-semibold text-lg ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                              Thank you for your review!
                            </p>
                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              Your feedback helps workers improve their service.
                            </p>
                          </motion.div>
                        ) : (
                          <div className="p-6 space-y-5">
                            {/* Star Rating */}
                            <div>
                              <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                How was the service?
                              </label>
                              <div className="flex items-center gap-4">
                                <StarRating
                                  value={draft.rating}
                                  onChange={(val) => updateDraft(booking.id, 'rating', val)}
                                />
                                <span className={`text-sm font-medium ${draft.rating >= 4 ? 'text-green-500' :
                                  draft.rating >= 3 ? 'text-blue-500' :
                                    draft.rating >= 2 ? 'text-yellow-500' : 'text-red-500'
                                  }`}>
                                  {getRatingLabel(draft.rating)}
                                </span>
                              </div>
                            </div>

                            {/* Comment */}
                            <div>
                              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                Share your experience (optional)
                              </label>
                              <textarea
                                rows={3}
                                value={draft.comment}
                                onChange={(e) => updateDraft(booking.id, 'comment', e.target.value)}
                                placeholder="What went well? Any suggestions for improvement?"
                                className={`w-full px-4 py-3 rounded-xl border transition-all duration-200 focus:outline-none focus:ring-2 resize-none ${isDark
                                  ? 'bg-dark-800 border-dark-600 text-gray-100 placeholder-gray-500 focus:border-brand-500 focus:ring-brand-500/30'
                                  : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:ring-brand-500/30'
                                  }`}
                              />
                            </div>

                            {reviewMutation.isError && (
                              <p className="text-sm text-red-500">
                                {reviewMutation.error?.response?.data?.error || 'Failed to submit review.'}
                              </p>
                            )}

                            <div className="flex justify-end">
                              <Button
                                icon={Send}
                                loading={reviewMutation.isPending}
                                onClick={() => handleSubmit(booking.id)}
                              >
                                Submit Review
                              </Button>
                            </div>
                          </div>
                        )}
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </section>

            {/* Past Reviews Section */}
            <section>
              <div className="flex items-center gap-2 mb-5">
                <MessageSquare size={20} className="text-brand-500" />
                <h2 className={`text-xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                  Your Past Reviews ({reviews.length})
                </h2>
              </div>

              {reviews.length === 0 && (
                <Card className="p-6">
                  <p className={isDark ? 'text-gray-300' : 'text-gray-600'}>
                    You haven't submitted any reviews yet.
                  </p>
                </Card>
              )}

              <div className="space-y-4">
                {reviews.map((review) => (
                  <motion.div
                    key={review.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <Card className="overflow-hidden">
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <p className={`font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                              {review.booking?.service?.name || 'Service'}
                            </p>
                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              To: {review.reviewee?.name || 'Worker'} · {new Date(review.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                size={16}
                                className={i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 dark:text-gray-600'}
                              />
                            ))}
                          </div>
                        </div>

                        {review.comment && (
                          <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                            "{review.comment}"
                          </p>
                        )}
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </section>
          </div>
        </AsyncState>
      </div>
    </MainLayout>
  );
}
