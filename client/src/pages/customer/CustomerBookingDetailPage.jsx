import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Calendar,
    MapPin,
    Clock,
    User,
    Briefcase,
    ArrowLeft,
    CheckCircle,
    XCircle,
    ShieldAlert,
    AlertCircle,
    Phone,
    Mail,
    Info,
    ChevronRight,
    Search,
    CreditCard
} from 'lucide-react';

import { MainLayout } from '../../components/layout/MainLayout';
import { Card, Badge, Button, AsyncState, Modal, Input } from '../../components/common';
import { useTheme } from '../../context/ThemeContext';
import { getBookingById, cancelBooking, payBooking } from '../../api/bookings';
import { queryKeys } from '../../utils/queryKeys';
import { getBookingStatusVariant, getPaymentStatusVariant } from '../../utils/statusHelpers';
import { UserMiniProfile } from '../../components/features/bookings/UserMiniProfile';
import { useState } from 'react';
import { toast } from 'sonner';

export function CustomerBookingDetailPage() {
    const { id: bookingId } = useParams();
    const navigate = useNavigate();
    const { isDark } = useTheme();
    const queryClient = useQueryClient();

    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState('');

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: queryKeys.bookings.detail(bookingId),
        queryFn: () => getBookingById(bookingId),
        refetchInterval: (data) => {
            // Polling is useful for customers to see worker acceptance or progress
            if (['PENDING', 'IN_PROGRESS'].includes(data?.booking?.status)) return 10000;
            return false;
        }
    });

    const booking = data?.booking;

    const cancelMutation = useMutation({
        mutationFn: (reason) => cancelBooking(bookingId, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.bookings.detail(bookingId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.bookings.customer() });
            toast.success('Booking cancelled successfully');
            setIsCancelModalOpen(false);
        },
        onError: (error) => {
            toast.error(error.response?.data?.error || 'Failed to cancel booking');
        }
    });

    const payMutation = useMutation({
        mutationFn: () => payBooking(bookingId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.bookings.detail(bookingId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.bookings.customer() });
            toast.success('Payment successful! Thank you.');
        },
        onError: (error) => {
            toast.error(error.response?.data?.error || 'Payment failed');
        }
    });

    const handleCancelSubmit = () => {
        if (!cancelReason.trim()) return;
        cancelMutation.mutate(cancelReason);
    };

    if (isLoading) return <MainLayout><div className="flex items-center justify-center min-h-[60vh]"><AsyncState isLoading={true} /></div></MainLayout>;
    if (isError) return <MainLayout><div className="max-w-4xl mx-auto p-10"><AsyncState isError={true} onRetry={refetch} /></div></MainLayout>;
    if (!booking) return <MainLayout><div className="max-w-4xl mx-auto p-10"><AsyncState isEmpty={true} emptyTitle="Booking not found" /></div></MainLayout>;

    return (
        <MainLayout>
            <div className={`max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-32 lg:pb-10 min-h-screen`}>
                <Button
                    variant="ghost"
                    onClick={() => navigate('/bookings')}
                    className="mb-6 group hover:pl-2 transition-all"
                >
                    <ArrowLeft size={18} className="mr-2 group-hover:-translate-x-1 transition-transform" />
                    Back to Bookings
                </Button>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Main Content Area */}
                    <div className="lg:col-span-3 space-y-6">
                        {/* Header Card */}
                        <div className="space-y-4">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <h1 className={`text-3xl font-black tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                            Booking #{booking.id}
                                        </h1>
                                        <Badge variant={getBookingStatusVariant(booking.status)} className="px-2 py-0.5 text-[10px] font-black uppercase">
                                            {booking.status}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Briefcase size={16} className="text-brand-500" />
                                        <p className={`text-lg font-bold ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                            {booking.service?.name}
                                        </p>
                                    </div>
                                </div>

                                <div className="hidden lg:flex items-center gap-2">
                                    {booking.status === 'COMPLETED' && booking.paymentStatus !== 'PAID' && (
                                        <Button
                                            size="md"
                                            icon={CreditCard}
                                            onClick={() => payMutation.mutate()}
                                            loading={payMutation.isPending}
                                            className="bg-brand-600 hover:bg-brand-700 text-white shadow-lg px-6 h-12 rounded-xl font-bold"
                                        >
                                            Pay Now
                                        </Button>
                                    )}
                                    {['PENDING', 'CONFIRMED'].includes(booking.status) && (
                                        <Button
                                            size="md"
                                            variant="ghost"
                                            icon={XCircle}
                                            onClick={() => setIsCancelModalOpen(true)}
                                            className="text-error-500 hover:bg-error-50 h-12 px-6 rounded-xl font-bold"
                                        >
                                            Cancel Booking
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Service Status Banner */}
                            <div className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${isDark ? 'bg-dark-800/50 border-dark-700' : 'bg-white border-gray-100 shadow-sm'}`}>
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isDark ? 'bg-brand-900/30 text-brand-400' : 'bg-brand-50 text-brand-600'}`}>
                                        <ShieldAlert size={24} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest leading-none mb-1">Live Status</p>
                                        <h3 className={`text-sm font-black ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                                            {booking.status === 'PENDING' ? 'Awaiting professional acceptance' :
                                                booking.status === 'CONFIRMED' ? 'Professional is assigned and ready' :
                                                    booking.status === 'IN_PROGRESS' ? 'Service is currently in progress' :
                                                        booking.status === 'COMPLETED' ? 'Job finished successfully' :
                                                            'Booking has been cancelled'}
                                        </h3>
                                    </div>
                                </div>
                                {booking.status === 'IN_PROGRESS' && (
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-green-500 animate-ping"></div>
                                        <span className="text-[10px] font-black uppercase text-green-500">Live</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Booking Details Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Card className="p-4 border-none ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-lg">
                                        <Calendar size={18} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Scheduled Date</p>
                                        <p className="font-bold">{new Date(booking.scheduledAt || booking.scheduledDate).toLocaleDateString([], { dateStyle: 'full' })}</p>
                                        <p className="text-xs text-gray-500 font-medium">Professional will arrive approximately at this time.</p>
                                    </div>
                                </div>
                            </Card>

                            <Card className="p-4 border-none ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-purple-50 dark:bg-purple-900/20 text-purple-500 rounded-lg">
                                        <Clock size={18} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Time Slot</p>
                                        <p className="font-bold">{new Date(booking.scheduledAt || booking.scheduledDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                        <p className="text-xs text-gray-500 font-medium">Duration depends on service scope.</p>
                                    </div>
                                </div>
                            </Card>

                            <Card className="p-4 border-none ring-1 ring-black/5 dark:ring-white/10 shadow-sm md:col-span-2">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-green-50 dark:bg-green-900/20 text-green-500 rounded-lg">
                                        <MapPin size={18} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Service Address</p>
                                        <p className="font-bold">{booking.addressDetails || booking.address}</p>
                                        {booking.landmark && <p className="text-xs text-gray-500">Landmark: {booking.landmark}</p>}
                                    </div>
                                </div>
                            </Card>
                        </div>

                        {/* Customer Notes */}
                        {booking.notes && (
                            <div className={`p-5 rounded-2xl border-l-4 border-brand-500 ${isDark ? 'bg-brand-500/5' : 'bg-brand-50/50'}`}>
                                <div className="flex items-center gap-2 mb-2">
                                    <Info size={16} className="text-brand-500" />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-brand-600">Your Instructions</p>
                                </div>
                                <p className={`text-sm italic font-medium leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>"{booking.notes}"</p>
                            </div>
                        )}
                    </div>

                    {/* Sidebar Area */}
                    <div className="space-y-6">
                        {/* Worker Info */}
                        <section>
                            <h3 className={`text-xs font-black uppercase tracking-widest mb-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                Service Professional
                            </h3>
                            {booking.workerProfile ? (
                                <div className="space-y-3">
                                    <UserMiniProfile
                                        user={booking.workerProfile.user}
                                        label="Assigned Worker"
                                        showContact={['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(booking.status)}
                                    />

                                    {/* Contact Professional Quick Actions */}
                                    {['CONFIRMED', 'IN_PROGRESS'].includes(booking.status) && (
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

                                    {booking.status === 'IN_PROGRESS' && (
                                        <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/50">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                                <p className="text-[10px] font-black uppercase text-green-600">On-site now</p>
                                            </div>
                                            <p className="text-xs font-medium text-green-700 dark:text-green-400">Professional is currently performing the service.</p>
                                        </div>
                                    )}
                                </div>
                            ) : booking.status === 'PENDING' ? (
                                <div className={`p-6 rounded-2xl border border-dashed flex flex-col items-center justify-center text-center py-10 transition-all ${isDark ? 'bg-brand-950/10 border-brand-800' : 'bg-brand-50/50 border-brand-100'}`}>
                                    <Search className="text-brand-500 mb-3 animate-bounce" size={32} />
                                    <h4 className="font-black text-sm text-brand-600 uppercase tracking-tighter">Matching in Progress</h4>
                                    <p className="text-[10px] text-brand-400 font-bold max-w-[150px] mt-1 leading-snug">We are finding the best professional for your request.</p>
                                </div>
                            ) : (
                                <div className={`p-5 rounded-2xl border border-dashed flex items-center justify-center ${isDark ? 'bg-dark-800/20 border-dark-700' : 'bg-gray-50 border-gray-100'}`}>
                                    <p className="text-xs font-medium text-gray-500 italic">No professional assigned</p>
                                </div>
                            )}
                        </section>

                        {/* OTP Security Banner */}
                        <section>
                            <h3 className={`text-xs font-black uppercase tracking-widest mb-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                Security Verification
                            </h3>
                            {((booking.status === 'CONFIRMED' && booking.startOtp) || (booking.status === 'IN_PROGRESS' && booking.completionOtp)) ? (
                                <div className={`relative px-5 py-6 rounded-2xl border flex flex-col items-center justify-center text-center overflow-hidden transition-all duration-500 ${booking.status === 'CONFIRMED' ? (isDark ? 'bg-brand-950/30 border-brand-800 shadow-lg shadow-brand-500/10' : 'bg-white border-brand-200 shadow-xl') : (isDark ? 'bg-success-950/30 border-success-800 shadow-lg shadow-green-500/10' : 'bg-white border-success-200 shadow-xl')}`}>
                                    <div className="relative z-10 w-full">
                                        <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${booking.status === 'CONFIRMED' ? 'text-brand-500' : 'text-green-500'}`}>
                                            {booking.status === 'CONFIRMED' ? 'Share to Start Job' : 'Share to Complete Job'}
                                        </p>
                                        <div className="relative inline-block group">
                                            <p className={`text-5xl font-black tracking-[0.2em] font-mono py-2 ${isDark ? 'text-white' : 'text-gray-900 group-hover:text-brand-600'}`}>
                                                {booking.status === 'CONFIRMED' ? booking.startOtp : booking.completionOtp}
                                            </p>
                                            <div className={`h-1.5 w-full rounded-full transition-all duration-500 opacity-20 ${booking.status === 'CONFIRMED' ? 'bg-brand-500' : 'bg-green-500'}`} />
                                        </div>
                                        <p className="text-[10px] text-gray-500 mt-4 font-bold flex items-center justify-center gap-1.5">
                                            <ShieldAlert size={12} className={booking.status === 'CONFIRMED' ? 'text-brand-500' : 'text-green-500'} />
                                            Only share with the assigned professional
                                        </p>
                                    </div>
                                    <ShieldAlert className={`absolute -right-6 -top-6 w-32 h-32 opacity-5 ${booking.status === 'CONFIRMED' ? 'text-brand-500' : 'text-green-500'}`} />
                                </div>
                            ) : (
                                <div className={`p-8 rounded-2xl border border-dashed text-center flex flex-col items-center gap-2 ${isDark ? 'bg-dark-800/20 border-dark-700' : 'bg-gray-50/50 border-gray-100'}`}>
                                    <Info className="text-gray-300" size={24} />
                                    <p className="text-xs font-semibold text-gray-400">Security codes will appear here once ready.</p>
                                </div>
                            )}
                        </section>

                        {/* Payment Info */}
                        <Card className="p-5 border-none bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-xl shadow-brand-500/20">
                            <h3 className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Billing Summary</h3>
                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-3xl font-black">₹{booking.totalPrice || booking.estimatedPrice}</p>
                                    <p className="text-[10px] font-bold opacity-80 uppercase tracking-tighter">
                                        Payment: {booking.paymentStatus || 'PENDING'}
                                    </p>
                                </div>
                                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                                    <CreditCard size={20} />
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>

            {/* Mobile Sticky Action Bar */}
            {booking && !isLoading && !isError && (
                <div className={`lg:hidden fixed bottom-0 left-0 right-0 z-40 p-4 pb-8 border-t backdrop-blur-xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] ${isDark ? 'bg-dark-900/80 border-dark-700' : 'bg-white/80 border-gray-100'}`}>
                    <div className="flex gap-3">
                        {booking.status === 'COMPLETED' && booking.paymentStatus !== 'PAID' ? (
                            <Button
                                fullWidth
                                size="lg"
                                icon={CreditCard}
                                onClick={() => payMutation.mutate()}
                                loading={payMutation.isPending}
                                className="bg-brand-600 text-white rounded-2xl font-black h-14"
                            >
                                Pay Now
                            </Button>
                        ) : ['PENDING', 'CONFIRMED'].includes(booking.status) ? (
                            <>
                                <Button
                                    fullWidth
                                    size="lg"
                                    variant="outline"
                                    onClick={() => navigate('/services')}
                                    className="border-gray-200 dark:border-dark-700 text-gray-600 dark:text-gray-300 rounded-2xl font-black h-14"
                                >
                                    Modify
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={() => setIsCancelModalOpen(true)}
                                    className="text-error-500 font-black px-6"
                                >
                                    Cancel
                                </Button>
                            </>
                        ) : booking.status === 'IN_PROGRESS' ? (
                            <div className="flex flex-col w-full gap-3">
                                <div className="p-3 bg-brand-50 dark:bg-brand-900/20 rounded-xl flex items-center justify-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
                                    <span className="text-[10px] font-black uppercase text-brand-600 tracking-widest">Service in Progress</span>
                                </div>
                            </div>
                        ) : (
                            <Button
                                fullWidth
                                variant="ghost"
                                onClick={() => navigate('/dashboard')}
                                className="text-gray-500 font-black h-14"
                                icon={ArrowLeft}
                            >
                                Back to Home
                            </Button>
                        )}
                    </div>
                </div>
            )}

            {/* Cancellation Modal (Bottom Sheet on mobile) */}
            <Modal
                isOpen={isCancelModalOpen}
                onClose={() => setIsCancelModalOpen(false)}
                title="Cancel Booking"
                size="sm"
            >
                <div className="space-y-4">
                    <div className={`p-4 rounded-xl flex items-center gap-4 bg-error-50 dark:bg-error-950/20 text-error-600`}>
                        <AlertCircle size={32} />
                        <p className="text-sm font-bold leading-tight">Are you sure you want to cancel? This may affect your service reliability rating.</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase text-gray-500 tracking-widest pl-1">Reason for cancellation</label>
                        <Input
                            placeholder="e.g., Booked by mistake, no longer needed..."
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            className="h-12 text-sm font-medium"
                            autoFocus
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <Button
                            fullWidth
                            variant="ghost"
                            onClick={() => setIsCancelModalOpen(false)}
                            className="font-bold"
                        >
                            Wait, Keep it
                        </Button>
                        <Button
                            fullWidth
                            className="bg-error-600 text-white hover:bg-error-700 font-black uppercase tracking-widest"
                            onClick={handleCancelSubmit}
                            disabled={!cancelReason.trim()}
                            loading={cancelMutation.isPending}
                        >
                            Cancel Job
                        </Button>
                    </div>
                </div>
            </Modal>
        </MainLayout>
    );
}
