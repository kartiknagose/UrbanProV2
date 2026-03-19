import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, User, Star, ShieldCheck, MapPin, Hammer, Calendar, MessageSquare, Award, Clock, IndianRupee, Heart } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getWorkerPublicProfile } from '../../../api/workers';
import { resolveProfilePhotoUrl } from '../../../utils/profilePhoto';
import { useAuth } from '../../../hooks/useAuth';
import { Button, Badge, Spinner } from '../../common';
import { queryKeys } from '../../../utils/queryKeys';
import { checkFavoriteWorker, toggleFavoriteWorker } from '../../../api/growth';
import { toast } from 'sonner';
import { toFixedSafe } from '../../../utils/numberFormat';

const getSkillBadge = (completions) => {
    if (completions >= 100) return { label: "Master", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800" };
    if (completions >= 50) return { label: "Top Rated", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800" };
    if (completions >= 10) return { label: "Pro", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800" };
    if (completions >= 1) return { label: "Rising Star", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" };
    return null;
};

/**
 * WorkerProfileWindow
 * Displays detailed worker information in a floating, chat-style window.
 */
export function WorkerProfileWindow({ workerId, isOpen, onClose }) {
    const { isAuthenticated, user } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('overview');

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const { data, isLoading, isError } = useQuery({
        queryKey: queryKeys.worker.profileWindow(workerId),
        queryFn: () => getWorkerPublicProfile(workerId),
        enabled: !!workerId && isOpen,
    });

    // Favorite Status
    const { data: isFavorited } = useQuery({
        queryKey: ['favorite-check', workerId],
        queryFn: () => checkFavoriteWorker(workerId),
        enabled: !!workerId && isOpen && isAuthenticated && user?.role === 'CUSTOMER',
    });

    const favoriteMutation = useMutation({
        mutationFn: () => toggleFavoriteWorker(workerId),
        onSuccess: (res) => {
            queryClient.setQueryData(['favorite-check', workerId], res.favorited);
            queryClient.invalidateQueries({ queryKey: ['favorites'] });
            queryClient.invalidateQueries({ queryKey: ['favorite-ids'] });
            toast.success(res.favorited ? 'Added to favorites' : 'Removed from favorites');
        },
        onError: () => toast.error('Failed to update favorites'),
    });

    const profile = data?.profile;
    const services = data?.services || [];
    const reviews = profile?.user?.reviewsReceived || [];

    if (!isOpen) return null;

    const content = (
        <div className="fixed bottom-4 right-4 w-[360px] md:w-[420px] h-[600px] flex flex-col rounded-3xl shadow-2xl z-[9999] overflow-hidden border animate-in slide-in-from-bottom-4 duration-300 bg-white border-gray-200 shadow-brand-900/10 dark:bg-dark-950 dark:border-dark-700 dark:shadow-black/50">
            {/* Header */}
            <div className="px-5 py-4 border-b flex items-center justify-between shrink-0 bg-brand-600 text-white dark:bg-dark-900/80 dark:border-dark-700">
                <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-white/10 backdrop-blur-md">
                        <User size={18} className="text-white dark:text-brand-400" />
                    </div>
                    <span className="font-bold text-sm uppercase tracking-widest">Expert Profile</span>
                </div>
                <div className="flex items-center gap-2">
                    {isAuthenticated && user?.role === 'CUSTOMER' && profile && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                favoriteMutation.mutate();
                            }}
                            className="p-2 rounded-full transition-all hover:bg-black/10 active:scale-90 text-white"
                            title={isFavorited ? "Remove from favorites" : "Save to favorites"}
                            disabled={favoriteMutation.isPending}
                        >
                            <Heart size={20} fill={isFavorited ? 'currentColor' : 'none'} className={isFavorited ? 'text-red-400' : ''} />
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full transition-all hover:bg-black/10 active:scale-90"
                        aria-label="Close profile"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4 opacity-50">
                        <Spinner size="lg" className="text-brand-500" />
                        <p className="text-xs font-bold uppercase tracking-[0.2em] animate-pulse">Retrieving Credentials...</p>
                    </div>
                ) : isError || !profile ? (
                    <div className="flex flex-col items-center justify-center h-full p-10 text-center gap-6">
                        <div className="w-20 h-20 rounded-full bg-error-50 dark:bg-error-900/20 flex items-center justify-center text-error-500">
                            <ShieldCheck size={40} />
                        </div>
                        <div>
                            <p className="text-lg font-bold tracking-tight">Profile Locked or Missing</p>
                            <p className="text-sm mt-1 opacity-60 text-gray-600 dark:text-gray-400">We could not fetch the verified details for this professional right now.</p>
                        </div>
                        <Button variant="outline" fullWidth onClick={onClose}>Close Window</Button>
                    </div>
                ) : (
                    <div className="flex flex-col h-full">
                        {/* Hero Section */}
                        <div className="p-6 pb-0 bg-gradient-to-b from-brand-50/50 to-transparent dark:from-dark-900 dark:to-transparent">
                            <div className="flex gap-5 items-start">
                                <div className="relative shrink-0">
                                    <div className="p-1 rounded-2xl bg-white dark:bg-dark-800 shadow-xl">
                                        <img
                                            src={resolveProfilePhotoUrl(profile.user?.profilePhotoUrl)}
                                            alt={profile.user?.name}
                                            className="w-24 h-24 rounded-xl object-cover"
                                            onError={(e) => {
                                                e.target.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(profile.user?.name || 'Worker') + '&background=random';
                                            }}
                                        />
                                    </div>
                                    {profile.isVerified && (
                                        <div className="absolute -bottom-2 -right-2 bg-brand-500 text-white p-1.5 rounded-lg shadow-lg border-2 border-white dark:border-dark-950">
                                            <ShieldCheck size={16} fill="white" className="text-brand-500" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0 pt-1">
                                    <h3 className="text-2xl font-bold tracking-tight leading-tight truncate text-gray-900 dark:text-white">
                                        {profile.user?.name}
                                    </h3>
                                    <div className="flex flex-wrap items-center gap-3 mt-2">
                                        <div className="flex items-center text-yellow-500 gap-1 bg-yellow-500/10 px-2 py-0.5 rounded-lg">
                                            <Star size={14} fill="currentColor" />
                                            <span className="text-sm font-bold">{toFixedSafe(profile.user?.rating, 1, '4.9')}</span>
                                        </div>
                                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">• {profile.totalReviews || 0} Successful Jobs</span>
                                        {(() => {
                                            const badge = getSkillBadge(profile.totalReviews || 0);
                                            if (!badge) return null;
                                            return (
                                                <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase tracking-widest ${badge.color}`}>
                                                    {badge.label}
                                                </span>
                                            );
                                        })()}
                                    </div>
                                    <div className="mt-3 flex gap-2">
                                        {profile.isVerified && (
                                            <Badge variant="success" className="bg-green-500/10 text-green-600 dark:text-green-400 border-none font-bold text-[10px] uppercase tracking-widest px-2">
                                                Verified Professional
                                            </Badge>
                                        )}
                                        {profile.verificationLevel === 'PREMIUM' && (
                                            <Badge variant="info" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-none font-bold text-[10px] uppercase tracking-widest px-2">
                                                Premium Pro
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tabs Navigation */}
                        <div className="flex px-6 mt-6 border-b border-black/5 dark:border-white/5 gap-6">
                            {['overview', 'expertise', 'feedback'].map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`pb-3 text-[10px] font-bold uppercase tracking-[0.2em] transition-all relative ${activeTab === tab ? 'text-brand-500' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
                                >
                                    {tab}
                                    {activeTab === tab && (
                                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500" />
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Tab Content Rendering */}
                        <div className="p-6 space-y-6 flex-1">
                            {activeTab === 'overview' && (
                                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
                                    {/* Quick Stats Grid */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 rounded-2xl border bg-gray-50 border-gray-100 dark:bg-dark-900/50 dark:border-dark-700 ring-1 ring-black/5">
                                            <div className="flex items-center gap-2 mb-2 opacity-50">
                                                <Clock size={12} className="text-brand-500" />
                                                <p className="text-[10px] font-bold uppercase tracking-widest">Experience</p>
                                            </div>
                                            <p className="text-lg font-bold tracking-tight">{profile.experienceYears || '5+'} Years</p>
                                        </div>
                                        <div className="p-4 rounded-2xl border bg-gray-50 border-gray-100 dark:bg-dark-900/50 dark:border-dark-700 ring-1 ring-black/5">
                                            <div className="flex items-center gap-2 mb-2 opacity-50">
                                                <IndianRupee size={12} className="text-green-500" />
                                                <p className="text-[10px] font-bold uppercase tracking-widest">Base Rate</p>
                                            </div>
                                            <p className="text-lg font-bold tracking-tight text-brand-500 italic">₹{profile.hourlyRate}<span className="text-xs opacity-50 font-normal">/hr</span></p>
                                        </div>
                                    </div>

                                    {/* About Block */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-6 bg-brand-500 rounded-full" />
                                            <h4 className="text-[11px] font-bold uppercase text-gray-400 tracking-widest">About Professional</h4>
                                        </div>
                                        <p className="text-sm leading-relaxed font-medium text-gray-700 dark:text-gray-300">
                                            {profile.bio || "No biography provided. This professional is verified and background-checked for your safety."}
                                        </p>
                                    </div>

                                    {/* Availability & Area */}
                                    <div className="space-y-4 pt-2">
                                        <div className="flex items-center gap-3 text-xs font-bold text-gray-500">
                                            <MapPin size={14} className="text-brand-500" />
                                            <span>Available in {profile.city || 'Your Area'}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs font-bold text-gray-500">
                                            <Award size={14} className="text-blue-500" />
                                            <span>Background Verified by UrbanPro Safety Team</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'expertise' && (
                                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2">
                                            <Hammer size={16} className="text-brand-500" />
                                            <h4 className="text-[11px] font-bold uppercase text-gray-400 tracking-widest">Services Offered</h4>
                                        </div>
                                        {services.length > 0 ? (
                                            <div className="grid gap-3">
                                        {services.filter(s => s && s.service).map(({ service }) => (
                                                    <div key={service?.id} className="p-4 rounded-xl border flex items-center justify-between bg-white border-gray-100 shadow-sm dark:bg-dark-900/50 dark:border-dark-700 dark:shadow-none">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-2 h-2 rounded-full bg-brand-500" />
                                                            <span className="text-sm font-bold">{service?.name}</span>
                                                        </div>
                                                        <Badge variant="outline" className="text-[9px] font-bold uppercase">Active</Badge>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-xs italic text-gray-500">No specific services listed.</p>
                                        )}
                                    </div>

                                    <div className="p-5 rounded-2xl bg-brand-500/5 border border-brand-500/20 space-y-3">
                                        <h5 className="text-[10px] font-bold text-brand-600 uppercase tracking-widest flex items-center gap-2">
                                            <Calendar size={12} /> Availability
                                        </h5>
                                        <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                            {profile.city ? `Available in ${profile.city}` : 'Available in your area'}. Contact the professional for specific scheduling.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'feedback' && (
                                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2">
                                            <MessageSquare size={16} className="text-yellow-500" />
                                            <h4 className="text-[11px] font-bold uppercase text-gray-400 tracking-widest">Client Testimonials</h4>
                                        </div>
                                        {reviews.length > 0 ? (
                                            <div className="space-y-4">
                                                {reviews.slice(0, 3).map((review) => (
                                                    <div key={review.id} className="p-5 rounded-2xl border relative bg-gray-50 border-gray-100 dark:bg-dark-900 dark:border-dark-700">
                                                        <div className="flex justify-between items-start mb-3">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-8 h-8 rounded-lg bg-brand-500 text-white flex items-center justify-center font-bold text-xs">
                                                                    {review.reviewer?.name?.charAt(0) || 'U'}
                                                                </div>
                                                                <span className="text-xs font-bold">{review.reviewer?.name}</span>
                                                            </div>
                                                            <div className="flex gap-0.5 text-yellow-500">
                                                                {[...Array(5)].map((_, i) => <Star key={i} size={8} fill={i < review.rating ? "currentColor" : "none"} />)}
                                                            </div>
                                                        </div>
                                                        <p className="text-xs italic leading-relaxed opacity-70">"{review.comment}"</p>
                                                        <p className="text-[9px] font-bold text-gray-400 mt-3 absolute right-5 bottom-4 uppercase tracking-tighter">
                                                            {new Date(review.createdAt).toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="py-12 border-2 border-dashed border-gray-100 dark:border-dark-800 rounded-3xl flex flex-col items-center justify-center text-center">
                                                <Star size={32} className="text-gray-200 mb-2" />
                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">No reviews yet</p>
                                                <p className="text-[10px] text-gray-500 mt-1 max-w-[180px]">This worker's reputation is built through quality service.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Actions */}
            <div className="p-5 border-t shrink-0 bg-white shadow-[0_-10px_30px_rgba(0,0,0,0.05)] dark:border-dark-700 dark:bg-dark-900 dark:shadow-none">
                <div className="flex items-center gap-4">
                    <div className="hidden sm:block">
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Est. Price</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">₹{profile?.hourlyRate || '0'}</p>
                    </div>
                    <Button
                        fullWidth
                        size="lg"
                        disabled={services.length === 0}
                        className="bg-brand-600 text-white font-bold uppercase tracking-[0.2em] text-xs h-14 rounded-2xl shadow-xl shadow-brand-500/30 hover:scale-[1.02] active:scale-95 transition-all"
                        onClick={() => {
                            if (!isAuthenticated) {
                                onClose();
                                navigate('/login');
                                return;
                            }
                            // Navigate to first service this worker offers with worker pre-selected
                            const firstService = services[0]?.service;
                            if (firstService) {
                                onClose();
                                navigate(`/services/${firstService.id}?worker=${workerId}`);
                            }
                        }}
                    >
                        {services.length === 0 ? 'No Services Listed' : 'Book This Professional'}
                    </Button>
                </div>
            </div>
        </div>
    );

    return createPortal(content, document.body);
}

