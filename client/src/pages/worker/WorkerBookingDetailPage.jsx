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
    PlayCircle,
    ShieldCheck,
    Phone,
    Mail,
    FileText,
    MessageCircle,
    ExternalLink,
    XCircle,
    AlertCircle,
    ShieldAlert
} from 'lucide-react';
import { MainLayout } from '../../components/layout/MainLayout';
import {
    Card,
    CardHeader,
    CardTitle,
    Button,
    Badge,
    PageHeader,
    AsyncState,
    Modal,
    Input,
    ImageUpload
} from '../../components/common';
import { useTheme } from '../../context/ThemeContext';
import { getBookingById, verifyBookingStart, verifyBookingCompletion, cancelBooking, updateBookingStatus } from '../../api/bookings';
import { uploadBookingPhoto } from '../../api/uploads';
import { queryKeys } from '../../utils/queryKeys';
import { getBookingStatusVariant } from '../../utils/statusHelpers';
import { UserMiniProfile } from '../../components/features/bookings/UserMiniProfile';
import { resolveProfilePhotoUrl } from '../../utils/profilePhoto';
import { useState } from 'react';
import { toast } from 'sonner';

export function WorkerBookingDetailPage() {
    const { id } = useParams();
    const { isDark } = useTheme();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
    const [otpAction, setOtpAction] = useState(null); // 'start' or 'complete'
    const [otpCode, setOtpCode] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    // Cancellation State
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState('');

    const { data, isLoading, isError, error, refetch } = useQuery({
        queryKey: queryKeys.bookings.detail(id),
        queryFn: () => getBookingById(id),
    });

    const booking = data?.booking;

    const verifyStartMutation = useMutation({
        mutationFn: ({ bookingId, otp }) => verifyBookingStart(bookingId, otp),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.bookings.detail(id) });
            setIsOtpModalOpen(false);
            setOtpCode('');
            setSelectedFile(null);
            toast.success('Job started successfully!');
        },
        onError: (error) => {
            const errorMsg = error.response?.data?.error || error.response?.data?.message || 'Invalid OTP';
            toast.error(errorMsg);
        },
    });

    const verifyCompleteMutation = useMutation({
        mutationFn: ({ bookingId, otp }) => verifyBookingCompletion(bookingId, otp),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.bookings.detail(id) });
            setIsOtpModalOpen(false);
            setOtpCode('');
            setSelectedFile(null);
            toast.success('Job completed successfully!');
            // Navigate to dashboard after small delay to let user see success
            setTimeout(() => navigate('/worker/dashboard'), 1500);
        },
        onError: (error) => {
            const errorMsg = error.response?.data?.error || error.response?.data?.message || 'Invalid OTP';
            toast.error(errorMsg);
        },
    });

    const statusMutation = useMutation({
        mutationFn: ({ status }) => updateBookingStatus(id, { status }),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.bookings.detail(id) });
            toast.success(`Job ${variables.status === 'CONFIRMED' ? 'accepted' : 'updated'} successfully!`);
        },
        onError: (_) => {
            toast.error('Failed to update status');
        }
    });

    const cancelMutation = useMutation({
        mutationFn: () => cancelBooking(id, cancelReason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.bookings.detail(id) });
            toast.success('Job cancelled/rejected successfully');
            setIsCancelModalOpen(false);
            setCancelReason('');
        },
        onError: (err) => {
            toast.error(err?.response?.data?.error || 'Failed to cancel job');
        }
    });

    const openCancelModal = (e) => {
        if (e) e.stopPropagation();
        setCancelReason('');
        setIsCancelModalOpen(true);
    };

    const handleCancelSubmit = () => {
        if (!cancelReason.trim()) return;
        cancelMutation.mutate();
    };

    const handleOtpSubmit = async () => {
        if (!selectedFile) {
            toast.error(`Please upload a ${otpAction === 'start' ? 'BEFORE' : 'AFTER'} photo as proof.`);
            return;
        }

        if (!otpCode || otpCode.length < 4) {
            toast.error('Please enter a valid OTP');
            return;
        }

        setIsUploading(true);
        try {
            const type = otpAction === 'start' ? 'BEFORE' : 'AFTER';
            await uploadBookingPhoto(selectedFile, id, type);

            if (otpAction === 'start') {
                verifyStartMutation.mutate({ bookingId: id, otp: otpCode });
            } else if (otpAction === 'complete') {
                verifyCompleteMutation.mutate({ bookingId: id, otp: otpCode });
            }
        } catch (_) {
            toast.error('Failed to upload photo proof. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    const openOtpModal = (action) => {
        setOtpAction(action);
        setOtpCode('');
        setSelectedFile(null);
        setIsOtpModalOpen(true);
    };

    return (
        <MainLayout>
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-32 lg:pb-10">
                <Button
                    variant="ghost"
                    onClick={() => navigate('/worker/dashboard')}
                    className="mb-6 -ml-4 text-gray-500 hover:text-brand-600 transition-colors"
                    icon={ArrowLeft}
                >
                    Return to Dashboard
                </Button>

                <AsyncState
                    isLoading={isLoading}
                    isError={isError}
                    error={error}
                    onRetry={refetch}
                >
                    {booking &&
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                            {/* Main Content Area */}
                            <div className="lg:col-span-3 space-y-6">
                                {/* Header Card */}
                                <div className="space-y-4">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div>
                                            <div className="flex items-center gap-3 mb-1">
                                                <h1 className={`text-3xl font-black tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                    Job #{booking.id}
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
                                            {booking.status === 'PENDING' && (
                                                <>
                                                    <Button
                                                        size="md"
                                                        icon={CheckCircle}
                                                        onClick={() => statusMutation.mutate({ status: 'CONFIRMED' })}
                                                        loading={statusMutation.isPending}
                                                        className="bg-brand-600 hover:bg-brand-700 text-white shadow-lg px-6 h-12 rounded-xl font-bold"
                                                    >
                                                        Accept Job
                                                    </Button>
                                                    <Button
                                                        size="md"
                                                        variant="ghost"
                                                        icon={XCircle}
                                                        onClick={openCancelModal}
                                                        loading={cancelMutation.isPending}
                                                        className="text-error-500 hover:bg-error-50 h-12 px-6 rounded-xl font-bold"
                                                    >
                                                        Reject
                                                    </Button>
                                                </>
                                            )}
                                            {booking.status === 'CONFIRMED' && (
                                                <>
                                                    <Button
                                                        size="md"
                                                        icon={PlayCircle}
                                                        onClick={() => openOtpModal('start')}
                                                        className="bg-brand-600 hover:bg-brand-700 text-white shadow-lg px-6 h-12 rounded-xl font-bold"
                                                    >
                                                        Start Job
                                                    </Button>
                                                    <Button
                                                        size="md"
                                                        variant="ghost"
                                                        icon={XCircle}
                                                        onClick={openCancelModal}
                                                        loading={cancelMutation.isPending}
                                                        className="text-error-500 hover:bg-error-50 h-12 px-6 rounded-xl font-bold"
                                                    >
                                                        Cancel Job
                                                    </Button>
                                                </>
                                            )}
                                            {booking.status === 'IN_PROGRESS' && (
                                                <Button
                                                    size="md"
                                                    icon={CheckCircle}
                                                    onClick={() => openOtpModal('complete')}
                                                    className="bg-green-600 hover:bg-green-700 text-white shadow-lg px-6 h-12 rounded-xl font-bold"
                                                >
                                                    Complete Job
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Service Lifecycle Timeline (More Compact) */}
                                    <div className={`p-5 rounded-2xl border shadow-sm ${isDark ? 'bg-dark-800/40 border-dark-700' : 'bg-white border-gray-100'}`}>
                                        <div className="flex flex-col gap-4">
                                            {booking.status === 'CANCELLED' && booking.cancellationReason && (
                                                <div className={`p-4 rounded-xl flex items-start gap-4 border ${isDark ? 'bg-error-950/20 border-error-900/40' : 'bg-error-50 border-error-100'}`}>
                                                    <AlertCircle size={20} className="text-error-500 shrink-0 mt-1" />
                                                    <div className="space-y-1">
                                                        <p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-error-400/70' : 'text-error-600/70'}`}>
                                                            Cancellation Reason
                                                        </p>
                                                        <p className={`text-sm font-bold leading-relaxed ${isDark ? 'text-error-300' : 'text-error-800'}`}>
                                                            {booking.cancellationReason}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="flex items-center justify-between relative max-w-xl mx-auto px-2">
                                                <div className={`absolute top-1/2 left-0 w-full h-[1px] -translate-y-1/2 z-0 ${isDark ? 'bg-dark-700' : 'bg-gray-100'}`}></div>

                                                {['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].map((s, i) => {
                                                    const statuses = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'];
                                                    const isPassed = statuses.indexOf(booking.status) >= i;
                                                    const isActive = booking.status === s;

                                                    return (
                                                        <div key={s} className="flex flex-col items-center z-10">
                                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all duration-500 ${isPassed
                                                                ? 'bg-brand-600 border-brand-400 text-white shadow-md shadow-brand-500/20'
                                                                : isDark ? 'bg-dark-900 border-dark-700 text-dark-500' : 'bg-white border-gray-200 text-gray-300'
                                                                } ${isActive ? 'ring-4 ring-brand-500/10 scale-110' : ''}`}>
                                                                {isPassed ? <CheckCircle size={16} /> : <div className="w-1 h-1 rounded-full bg-current" />}
                                                            </div>
                                                            <span className={`text-[8px] font-black mt-2 uppercase tracking-tight ${isPassed ? 'text-brand-500' : 'text-gray-400'}`}>
                                                                {s}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Assignment Details Card (Grid for compactness) */}
                                    <Card className="overflow-hidden border-none ring-1 ring-black/5 dark:ring-white/10 shadow-lg">
                                        <div className="p-6 space-y-6">
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                <div className="flex items-start gap-3">
                                                    <div className={`p-2 rounded-lg shrink-0 ${isDark ? 'bg-brand-900/20 text-brand-400' : 'bg-brand-50 text-brand-600'}`}>
                                                        <Calendar size={18} />
                                                    </div>
                                                    <div>
                                                        <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Appointment</span>
                                                        <div className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                            {new Date(booking.scheduledAt || booking.scheduledDate).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                                                        </div>
                                                        <div className="flex items-center gap-1 text-[10px] font-bold text-blue-500">
                                                            <Clock size={12} />
                                                            {new Date(booking.scheduledAt || booking.scheduledDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-start gap-3">
                                                    <div className={`p-2 rounded-lg shrink-0 ${isDark ? 'bg-success-900/20 text-success-400' : 'bg-success-50 text-success-600'}`}>
                                                        <MapPin size={18} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Location</span>
                                                        <span className={`text-sm font-bold block truncate ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                                                            {booking.address || booking.addressDetails}
                                                        </span>
                                                        <Button variant="link" size="sm" className="p-0 h-auto text-[10px] text-brand-500 font-bold flex items-center gap-1">
                                                            Open Maps <ExternalLink size={10} />
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div className="md:text-right lg:text-left">
                                                    <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Estimated Payout</span>
                                                    <div className={`text-2xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                        ₹{booking.totalPrice || booking.estimatedPrice || booking.service?.basePrice || 0}
                                                    </div>
                                                    <Badge variant="outline" className="text-[8px] font-black uppercase bg-success-50 text-success-700 border-success-200">Guaranteed</Badge>
                                                </div>
                                            </div>

                                            {booking.notes && (
                                                <div className={`p-4 rounded-xl border-l-4 border-l-brand-500 ${isDark ? 'bg-dark-900/50 border-dark-700' : 'bg-gray-50 border-gray-100'}`}>
                                                    <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 pointer-events-none opacity-50">Customer Notes</span>
                                                    <p className={`text-sm font-medium italic ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                                        &ldquo;{booking.notes}&rdquo;
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </Card>
                                </div>
                            </div>

                            {/* Sidebar Area */}
                            <div className="space-y-6">
                                <Card className="border-none ring-1 ring-black/5 dark:ring-white/10 shadow-xl overflow-hidden sticky top-8">
                                    <div className={`p-3 border-b ${isDark ? 'bg-dark-900/50 border-dark-700' : 'bg-gray-50 border-gray-100'}`}>
                                        <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 text-center flex items-center justify-center gap-2">
                                            <User size={12} /> Contact Client
                                        </h3>
                                    </div>
                                    <div className="p-5">
                                        <div className="flex flex-col items-center text-center mb-6">
                                            <div className="relative mb-3">
                                                {booking.customer?.profilePhotoUrl ? (
                                                    <img
                                                        src={resolveProfilePhotoUrl(booking.customer.profilePhotoUrl)}
                                                        alt=""
                                                        className="w-20 h-20 rounded-2xl object-cover ring-4 ring-brand-500/10 shadow-lg"
                                                    />
                                                ) : (
                                                    <div className="w-20 h-20 rounded-2xl bg-brand-500/10 flex items-center justify-center text-brand-500 text-2xl font-black shadow-inner">
                                                        {booking.customer?.name?.charAt(0) || '?'}
                                                    </div>
                                                )}
                                                <div className="absolute -bottom-2 -right-2 bg-success-500 border-4 border-white dark:border-dark-800 w-6 h-6 rounded-full" />
                                            </div>
                                            <h4 className={`text-lg font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>{booking.customer?.name}</h4>
                                            <div className="flex items-center gap-1 mt-1">
                                                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-[10px]">
                                                    ★ {booking.customer?.rating || '0.0'}
                                                </Badge>
                                                <span className="text-[10px] font-bold text-gray-400 uppercase">({booking.customer?.totalReviews || 0} Reviews)</span>
                                            </div>
                                        </div>

                                        {booking.status !== 'PENDING' ? (
                                            <div className="space-y-4">
                                                <div className={`p-3 rounded-xl border ${isDark ? 'bg-dark-900/30 border-dark-700' : 'bg-gray-50 border-gray-100'}`}>
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <Phone size={14} className="text-brand-500" />
                                                        <span className={`text-xs font-bold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                            {booking.customer?.mobile}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <Mail size={14} className="text-brand-500" />
                                                        <span className={`text-xs font-bold truncate ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                            {booking.customer?.email}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="primary"
                                                        icon={Phone}
                                                        className="rounded-xl font-bold h-10"
                                                        onClick={() => window.location.href = `tel:${booking.customer.mobile}`}
                                                    >
                                                        Call
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        icon={MessageCircle}
                                                        className="rounded-xl font-bold h-10"
                                                        onClick={() => window.location.href = `sms:${booking.customer.mobile}`}
                                                    >
                                                        SMS
                                                    </Button>
                                                </div>
                                                <Button
                                                    fullWidth
                                                    variant="ghost"
                                                    size="sm"
                                                    icon={Mail}
                                                    className="h-10 rounded-xl font-bold text-gray-500"
                                                    onClick={() => window.location.href = `mailto:${booking.customer.email}`}
                                                >
                                                    Email Client
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="text-center p-4 rounded-xl bg-gray-50 dark:bg-dark-900/50 border border-dashed border-gray-200 dark:border-dark-700">
                                                <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Contact Hidden</p>
                                                <p className="text-[10px] leading-tight text-gray-500">Confirm the job to see client contact details.</p>
                                            </div>
                                        )}
                                    </div>
                                </Card>

                            </div>
                        </div>
                    }
                </AsyncState>
            </div>

            {/* Mobile Sticky Action Bar */}
            {booking && !isLoading && !isError && (
                <div className={`lg:hidden fixed bottom-0 left-0 right-0 z-40 p-4 pb-8 border-t backdrop-blur-xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] ${isDark ? 'bg-dark-900/80 border-dark-700' : 'bg-white/80 border-gray-100'}`}>
                    <div className="flex gap-3">
                        {booking.status === 'PENDING' && (
                            <>
                                <Button
                                    fullWidth
                                    size="lg"
                                    icon={CheckCircle}
                                    onClick={() => statusMutation.mutate({ status: 'CONFIRMED' })}
                                    loading={statusMutation.isPending}
                                    className="bg-brand-600 text-white rounded-2xl font-black h-14"
                                >
                                    Accept
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={openCancelModal}
                                    className="text-error-500 font-black px-4"
                                >
                                    Reject
                                </Button>
                            </>
                        )}
                        {booking.status === 'CONFIRMED' && (
                            <>
                                <Button
                                    fullWidth
                                    size="lg"
                                    icon={PlayCircle}
                                    onClick={() => openOtpModal('start')}
                                    className="bg-brand-600 text-white rounded-2xl font-black h-14"
                                >
                                    Start Job
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={openCancelModal}
                                    className="text-error-500 font-black px-4"
                                >
                                    Cancel
                                </Button>
                            </>
                        )}
                        {booking.status === 'IN_PROGRESS' && (
                            <div className="flex flex-col w-full gap-3">
                                <Button
                                    fullWidth
                                    size="lg"
                                    icon={CheckCircle}
                                    onClick={() => openOtpModal('complete')}
                                    className="bg-green-600 text-white rounded-2xl font-black h-14 shadow-lg shadow-green-500/20"
                                >
                                    Finish Job
                                </Button>
                            </div>
                        )}
                        {['COMPLETED', 'CANCELLED', 'REJECTED'].includes(booking.status) && (
                            <Button
                                fullWidth
                                variant="ghost"
                                onClick={() => navigate('/worker/dashboard')}
                                className="text-gray-500 font-black h-14"
                                icon={ArrowLeft}
                            >
                                Back to Dashboard
                            </Button>
                        )}
                    </div>
                </div>
            )}

            {/* Verification Modal (Now a Bottom Sheet on mobile) */}
            <Modal
                isOpen={isOtpModalOpen}
                onClose={() => setIsOtpModalOpen(false)}
                title={otpAction === 'start' ? 'Start Verification' : 'Completion Verification'}
                size="sm"
            >
                <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-2 custom-scrollbar">
                    <div className={`p-4 rounded-2xl border ${isDark ? 'bg-brand-900/10 border-brand-800' : 'bg-brand-50 border-brand-100'}`}>
                        <p className={`text-sm font-black uppercase tracking-widest ${isDark ? 'text-brand-300' : 'text-brand-800'}`}>
                            Step 1: Visual Proof
                        </p>
                        <p className={`text-xs mt-1 ${isDark ? 'text-brand-400' : 'text-brand-600'}`}>
                            Please upload a photo of the {otpAction === 'start' ? 'work area' : 'finished result'}.
                        </p>
                    </div>

                    <ImageUpload
                        label={otpAction === 'start' ? "Before photo" : "After photo"}
                        onUpload={setSelectedFile}
                        value={selectedFile}
                    />

                    <div className={`border-t pt-6 ${isDark ? 'border-dark-700' : 'border-gray-100'}`}>
                        <p className={`text-sm font-black uppercase tracking-widest mb-4 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                            Step 2: Customer OTP
                        </p>
                        <Input
                            placeholder="0 0 0 0"
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value)}
                            className="text-center text-4xl tracking-[1rem] font-black h-20 rounded-2xl border-2 focus:border-brand-500"
                            maxLength={4}
                            inputMode="numeric"
                            pattern="[0-9]*"
                        />
                        <p className="text-[10px] text-center mt-3 text-gray-500 font-bold uppercase tracking-widest">Ask customer for the 4-digit code</p>
                    </div>

                    <div className="flex gap-3 pt-4 sticky bottom-0 bg-inherit pb-2">
                        <Button variant="ghost" fullWidth onClick={() => setIsOtpModalOpen(false)}>Cancel</Button>
                        <Button
                            fullWidth
                            size="lg"
                            onClick={handleOtpSubmit}
                            loading={verifyStartMutation.isPending || verifyCompleteMutation.isPending || isUploading}
                            disabled={!selectedFile || otpCode.length < 4}
                            className="bg-brand-600 text-white shadow-xl shadow-brand-500/20"
                        >
                            Verify & Proceed
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Cancellation Modal */}
            <Modal
                isOpen={isCancelModalOpen}
                onClose={() => setIsCancelModalOpen(false)}
                title="Reason for Cancellation"
                size="sm"
            >
                <div className="space-y-4">
                    <div className={`p-4 rounded-xl flex items-center gap-4 bg-error-50 dark:bg-error-950/20 text-error-600`}>
                        <ShieldAlert size={24} />
                        <p className="text-sm font-bold leading-tight">Please provide a reason for cancelling or rejecting this job.</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase text-gray-500 tracking-widest pl-1">Cancellation Reason</label>
                        <Input
                            placeholder="e.g., Scheduling conflict, out of specialized tools..."
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            className="h-12 text-sm"
                            autoFocus
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <Button
                            fullWidth
                            variant="ghost"
                            onClick={() => setIsCancelModalOpen(false)}
                        >
                            Go Back
                        </Button>
                        <Button
                            fullWidth
                            className="bg-error-600 text-white hover:bg-error-700"
                            onClick={handleCancelSubmit}
                            disabled={!cancelReason.trim()}
                            loading={cancelMutation.isPending}
                        >
                            Confirm Cancellation
                        </Button>
                    </div>
                </div>
            </Modal>
        </MainLayout>
    );
}
