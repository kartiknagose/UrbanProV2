// Worker Reviews Page - Two-Way Review System
// Workers can see customer feedback AND review customers

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Star, MessageSquare, User, Send, CheckCircle2, Sparkles, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MainLayout } from '../../components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardDescription, PageHeader } from '../../components/common';
import { Badge, Button, AsyncState } from '../../components/common';
import { useTheme } from '../../context/ThemeContext';
import { createReview, getReviewsAboutMe, getMyReviews, getPendingReviews } from '../../api/reviews';
import { queryKeys } from '../../utils/queryKeys';
import { StarRating, getRatingLabel } from '../../components/features/reviews/StarRating';


const ratingVariant = (rating) => {
  if (rating >= 4) return 'success';
  if (rating >= 3) return 'info';
  if (rating >= 2) return 'warning';
  return 'error';
};

export function WorkerReviewsPage() {
  const { isDark } = useTheme();
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState({});
  const [submitted, setSubmitted] = useState({});
  const [activeTab, setActiveTab] = useState('received');

  // Fetch reviews about me (from customers)
  const receivedQuery = useQuery({
    queryKey: queryKeys.reviews.workerReceived(),
    queryFn: getReviewsAboutMe,
  });

  // Fetch reviews I've written (about customers)
  const writtenQuery = useQuery({
    queryKey: queryKeys.reviews.workerWritten(),
    queryFn: getMyReviews,
  });

  // Fetch bookings pending my review
  const pendingQuery = useQuery({
    queryKey: queryKeys.reviews.workerPending(),
    queryFn: getPendingReviews,
  });

  const reviewMutation = useMutation({
    mutationFn: (payload) => createReview(payload),
    onSuccess: (_, variables) => {
      setSubmitted((prev) => ({ ...prev, [variables.bookingId]: true }));
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.reviews.workerReceived() });
        queryClient.invalidateQueries({ queryKey: queryKeys.reviews.workerWritten() });
        queryClient.invalidateQueries({ queryKey: queryKeys.reviews.workerPending() });
        queryClient.invalidateQueries({ queryKey: queryKeys.bookings.worker() });
        queryClient.invalidateQueries({ queryKey: ['worker-profile'] });
      }, 1500);
    },
  });

  const receivedReviews = receivedQuery.data?.reviews || [];
  const writtenReviews = writtenQuery.data?.reviews || [];
  const pendingBookings = pendingQuery.data?.bookings || [];
  const hasError = receivedQuery.isError || writtenQuery.isError || pendingQuery.isError;
  const loadError = receivedQuery.error || writtenQuery.error || pendingQuery.error;

  // Calculate average rating from received reviews
  const avgRating = receivedReviews.length > 0
    ? (receivedReviews.reduce((sum, r) => sum + r.rating, 0) / receivedReviews.length).toFixed(1)
    : '0.0';

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

  const isLoading = receivedQuery.isLoading || writtenQuery.isLoading || pendingQuery.isLoading;

  const tabs = [
    { id: 'received', label: 'Customer Feedback', count: receivedReviews.length },
    { id: 'pending', label: 'Review Customers', count: pendingBookings.length },
    { id: 'written', label: 'My Reviews', count: writtenReviews.length },
  ];

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <PageHeader
          title="Reviews"
          subtitle="View customer feedback and share your experience with customers."
        />

        <AsyncState
          isLoading={isLoading}
          isError={hasError}
          error={loadError}
        >
          <div className="space-y-8">

            {/* Rating Summary Card */}
            <div className={`rounded-2xl p-6 ${isDark
              ? 'bg-gradient-to-br from-brand-900/40 via-dark-800 to-dark-900 border border-dark-600'
              : 'bg-gradient-to-br from-brand-50 via-white to-yellow-50 border border-gray-100'
              }`}>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className={`text-5xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                    {avgRating}
                  </p>
                  <div className="flex items-center gap-0.5 mt-1 justify-center">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        size={14}
                        className={i < Math.round(Number(avgRating)) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                      />
                    ))}
                  </div>
                  <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {receivedReviews.length} review{receivedReviews.length !== 1 ? 's' : ''}
                  </p>
                </div>

                <div className="flex-1 space-y-1">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = receivedReviews.filter((r) => r.rating === star).length;
                    const pct = receivedReviews.length > 0 ? (count / receivedReviews.length) * 100 : 0;
                    return (
                      <div key={star} className="flex items-center gap-2 text-sm">
                        <span className={`w-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{star}</span>
                        <Star size={12} className="text-yellow-400 fill-yellow-400" />
                        <div className={`flex-1 h-2 rounded-full overflow-hidden ${isDark ? 'bg-dark-600' : 'bg-gray-200'}`}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8, delay: 0.1 * (5 - star) }}
                            className="h-full bg-yellow-400 rounded-full"
                          />
                        </div>
                        <span className={`w-6 text-right ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className={`flex rounded-xl overflow-hidden border ${isDark ? 'border-dark-600' : 'border-gray-200'}`}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors duration-200 flex items-center justify-center gap-2 ${activeTab === tab.id
                    ? isDark
                      ? 'bg-brand-600 text-white'
                      : 'bg-brand-500 text-white'
                    : isDark
                      ? 'bg-dark-800 text-gray-300 hover:bg-dark-700'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.id
                      ? 'bg-white/20 text-white'
                      : isDark ? 'bg-dark-600 text-gray-400' : 'bg-gray-100 text-gray-500'
                      }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Content based on active tab */}
            <AnimatePresence mode="wait">
              {/* Tab: Received Reviews */}
              {activeTab === 'received' && (
                <motion.div
                  key="received"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-4"
                >
                  {receivedReviews.length === 0 && (
                    <Card className="p-8 text-center">
                      <TrendingUp size={40} className="mx-auto text-brand-500 mb-3" />
                      <p className={isDark ? 'text-gray-300' : 'text-gray-600'}>
                        No reviews received yet. Complete bookings to get customer feedback!
                      </p>
                    </Card>
                  )}

                  {receivedReviews.map((review) => (
                    <Card key={review.id} className="overflow-hidden">
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isDark ? 'bg-brand-900/50 text-brand-400' : 'bg-brand-50 text-brand-600'
                              }`}>
                              <User size={18} />
                            </div>
                            <div>
                              <p className={`font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                                {review.reviewer?.name || 'Customer'}
                              </p>
                              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {review.booking?.service?.name || 'Service'} · {new Date(review.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <Badge variant={ratingVariant(review.rating)}>
                            <span className="flex items-center gap-1">
                              <Star size={12} className="fill-current" />
                              {review.rating}
                            </span>
                          </Badge>
                        </div>

                        {review.comment && (
                          <p className={`text-sm leading-relaxed ml-13 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                            "{review.comment}"
                          </p>
                        )}
                      </div>
                    </Card>
                  ))}
                </motion.div>
              )}

              {/* Tab: Pending Reviews (Review Customers) */}
              {activeTab === 'pending' && (
                <motion.div
                  key="pending"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-4"
                >
                  {pendingBookings.length === 0 && (
                    <Card className="p-8 text-center">
                      <CheckCircle2 size={40} className="mx-auto text-green-500 mb-3" />
                      <p className={isDark ? 'text-gray-300' : 'text-gray-600'}>
                        All caught up! No customers waiting for your review.
                      </p>
                    </Card>
                  )}

                  {pendingBookings.map((booking) => {
                    const draft = drafts[booking.id] || { rating: 5, comment: '' };
                    const isSubmitted = submitted[booking.id];

                    return (
                      <Card key={booking.id} className={`overflow-hidden transition-all duration-300 ${isSubmitted ? 'ring-2 ring-green-500/50' : ''
                        }`}>
                        <div className={`px-6 py-3 flex items-center justify-between ${isDark
                          ? 'bg-gradient-to-r from-accent-900/30 to-transparent border-b border-dark-600'
                          : 'bg-gradient-to-r from-accent-50 to-transparent border-b border-gray-100'
                          }`}>
                          <div>
                            <p className={`font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                              {booking.service?.name || `Service #${booking.serviceId}`}
                            </p>
                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              Customer: {booking.customer?.name || 'Customer'} · {new Date(booking.scheduledAt).toLocaleDateString()}
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
                              Thank you!
                            </p>
                          </motion.div>
                        ) : (
                          <div className="p-6 space-y-5">
                            <div>
                              <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                How was working with this customer?
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

                            <div>
                              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                Comment (optional)
                              </label>
                              <textarea
                                rows={2}
                                value={draft.comment}
                                onChange={(e) => updateDraft(booking.id, 'comment', e.target.value)}
                                placeholder="Was the customer polite? Was the address easy to find?"
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
                                size="sm"
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
                    );
                  })}
                </motion.div>
              )}

              {/* Tab: Reviews I've Written */}
              {activeTab === 'written' && (
                <motion.div
                  key="written"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-4"
                >
                  {writtenReviews.length === 0 && (
                    <Card className="p-6">
                      <p className={isDark ? 'text-gray-300' : 'text-gray-600'}>
                        You haven't submitted any reviews yet.
                      </p>
                    </Card>
                  )}

                  {writtenReviews.map((review) => (
                    <Card key={review.id} className="overflow-hidden">
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <p className={`font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                              {review.booking?.service?.name || 'Service'}
                            </p>
                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              Customer: {review.reviewee?.name || 'Customer'} · {new Date(review.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
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
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </AsyncState>
      </div>
    </MainLayout>
  );
}
