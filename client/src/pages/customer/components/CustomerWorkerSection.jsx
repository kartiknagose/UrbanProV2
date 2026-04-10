import { Phone, Mail, Search } from 'lucide-react';
import { Card, Button } from '../../../components/common';
import { UserMiniProfile } from '../../../components/features/bookings/UserMiniProfile';
import { ChatToggle } from '../../../components/features/chat/ChatWindow';
import { StarRating } from '../../../components/features/reviews/StarRating';
import { BookingReportCard } from '../../../components/features/safety/BookingReportCard';
import { SafetyGuidelinesCard } from '../../../components/features/safety/SafetyGuidelinesCard';

export function CustomerWorkerSection({ booking, user, activeReview, setActiveReview, reviewMutation }) {
    const isActive = ['CONFIRMED', 'IN_PROGRESS'].includes(booking.status);
    const canReview = booking.status === 'COMPLETED'
        && (booking.paymentStatus === 'PAID' || String(booking.paymentStatus).toUpperCase() === 'PAID')
        && !(booking.reviews || []).some(r => String(r.reviewerId || r.reviewer?.id) === String(user?.id));

    return (
        <section>
            <h3 className="text-xs font-black uppercase tracking-widest mb-3 text-gray-400 dark:text-gray-500">
                Service Professional
            </h3>
            {booking.workerProfile ? (
                <div className="space-y-3">
                    <UserMiniProfile
                        user={booking.workerProfile.user}
                        label="Assigned Worker"
                        showContact={isActive}
                    />

                    {isActive && (
                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <Button
                                variant="outline"
                                size="sm"
                                icon={Phone}
                                href={`tel:${booking.workerProfile.user?.mobile}`}
                                className="rounded-xl h-11 font-bold text-xs"
                            >
                                Call Worker
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                icon={Mail}
                                href={`mailto:${booking.workerProfile.user?.email}`}
                                className="rounded-xl h-11 font-bold text-xs"
                            >
                                Email
                            </Button>
                        </div>
                    )}

                    {isActive && booking.workerProfile && (
                        <div className="pt-2">
                            <ChatToggle bookingId={booking.id} label="Chat with Worker" />
                        </div>
                    )}

                    {canReview && (
                        <Card className="mt-4 p-4 border-none ring-1 ring-black/5 dark:ring-white/10 bg-brand-50/30 dark:bg-brand-900/10">
                            <h4 className="text-[10px] font-black uppercase text-brand-600 tracking-widest mb-3">Rate your experience</h4>
                            <div className="flex flex-col gap-4">
                                <StarRating
                                    value={activeReview.rating}
                                    onChange={(r) => setActiveReview(prev => ({ ...prev, rating: r }))}
                                />
                                <textarea
                                    className="w-full p-3 rounded-xl border-none ring-1 ring-black/5 dark:ring-white/10 bg-white dark:bg-dark-800 text-sm font-medium focus:ring-brand-500 transition-all outline-none"
                                    placeholder="How was the service? (Optional)"
                                    rows={3}
                                    value={activeReview.comment}
                                    onChange={(e) => setActiveReview(prev => ({ ...prev, comment: e.target.value }))}
                                />
                                <Button
                                    fullWidth
                                    disabled={!activeReview.rating}
                                    loading={reviewMutation.isPending}
                                    onClick={() => reviewMutation.mutate({
                                        bookingId: booking.id,
                                        rating: activeReview.rating,
                                        comment: activeReview.comment
                                    })}
                                    className="bg-brand-600 text-white font-black uppercase tracking-widest text-xs h-12 rounded-xl"
                                >
                                    Submit Feedback
                                </Button>
                            </div>
                        </Card>
                    )}

                    <BookingReportCard
                        booking={booking}
                        reporterRole="CUSTOMER"
                        className="mt-4"
                    />

                    {isActive && (
                        <SafetyGuidelinesCard
                            role="CUSTOMER"
                            className="mt-4"
                        />
                    )}

                    {booking.status === 'IN_PROGRESS' && (
                        <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/50">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" aria-hidden="true" />
                                <p className="text-2xs font-black uppercase text-green-600">On-site now</p>
                            </div>
                            <p className="text-xs font-medium text-green-700 dark:text-green-400">Professional is currently performing the service.</p>
                        </div>
                    )}
                </div>
            ) : booking.status === 'PENDING' ? (
                <div className="p-6 rounded-2xl border border-dashed flex flex-col items-center justify-center text-center py-10 transition-all bg-brand-50/50 border-brand-100 dark:bg-brand-950/10 dark:border-brand-800">
                    <Search className="text-brand-500 mb-3 animate-bounce" size={32} />
                    <h4 className="font-black text-sm text-brand-600 uppercase tracking-tighter">Matching in Progress</h4>
                    <p className="text-2xs text-brand-400 font-bold max-w-[150px] mt-1 leading-snug">We are finding the best professional for your request.</p>
                </div>
            ) : (
                <div className="p-5 rounded-2xl border border-dashed flex items-center justify-center bg-gray-50 border-gray-100 dark:bg-dark-800/20 dark:border-dark-700">
                    <p className="text-xs font-medium text-gray-500 italic">No professional assigned</p>
                </div>
            )}
        </section>
    );
}
