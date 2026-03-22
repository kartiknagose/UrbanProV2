import { useState, useMemo, useEffect } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
    Star,
    MapPin,
    ShieldCheck,
    MessageSquare,
    CheckCircle2,
    Zap,
    ChevronRight,
    Heart,
    Share2,
    IndianRupee,
    Hammer,
    User,
    ArrowLeft,
    Calendar,
    Award,
    Clock,
    Briefcase,
    ShieldAlert
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getWorkerPublicProfile } from '../../../api/workers';
import { getAllBookings } from '../../../api/bookings';
import { resolveProfilePhotoUrl } from '../../../utils/profilePhoto';
import { useAuth } from '../../../hooks/useAuth';
import { getVerificationLevelVariant } from '../../../utils/statusHelpers';
import { Button, Badge, Spinner } from '../../common';
import { MiniMap } from '../../features/location/MiniMap';
import { ChatToggle } from '../../features/chat/ChatWindow';
import { queryKeys } from '../../../utils/queryKeys';
import { toFixedSafe } from '../../../utils/numberFormat';

/**
 * WorkerProfileModern
 * A refined, professional, and standard-compliant profile view.
 * Focuses on clarity, trust signals, and high-readability.
 */
export function WorkerProfileModern({ workerId, onClose, onAction }) {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('overview');
    const [customerCoords, setCustomerCoords] = useState(null);

    useEffect(() => {
        if (typeof window !== 'undefined' && "geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                pos => setCustomerCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                () => { }, // ignore error
                { timeout: 5000 }
            );
        }
    }, []);

    const { data, isLoading, isError } = useQuery({
        queryKey: queryKeys.worker.profilePublic(workerId),
        queryFn: () => getWorkerPublicProfile(workerId),
        enabled: !!workerId,
    });

    const { data: bookingsData } = useQuery({
        queryKey: queryKeys.worker.bookingsWith(workerId),
        queryFn: () => getAllBookings(),
        enabled: !!user && !!workerId && user.role === 'CUSTOMER',
    });

    const profile = data?.profile;
    const services = data?.services || [];
    const reviews = profile?.user?.reviewsReceived || [];

    const formatReviewDate = (value) => {
        if (!value) return 'N/A';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString();
    };

    const activeBooking = useMemo(() => {
        if (!bookingsData?.bookings || !profile) return null;
        return bookingsData.bookings.find(b =>
            b.workerProfileId === profile.id &&
            ['CONFIRMED', 'IN_PROGRESS'].includes(b.status)
        );
    }, [bookingsData, profile]);

    const distance = useMemo(() => {
        if (!customerCoords || !profile?.baseLatitude) return null;
        const R = 6371; // km
        const dLat = (Number(profile.baseLatitude) - customerCoords.lat) * Math.PI / 180;
        const dLon = (Number(profile.baseLongitude) - customerCoords.lng) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(customerCoords.lat * Math.PI / 180) * Math.cos(Number(profile.baseLatitude) * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return (R * c).toFixed(1);
    }, [customerCoords, profile]);

    const isOnline = profile?.location?.isOnline || false;

    const stats = useMemo(() => [
        { label: 'Rating', value: toFixedSafe(profile?.user?.rating, 1, 'N/A'), icon: Star, color: 'text-yellow-500' },
        { label: 'Jobs Done', value: profile?.totalReviews || 0, icon: CheckCircle2, color: 'text-green-500' },
        { label: 'Exp', value: profile?.experienceYears ? `${profile.experienceYears} Yrs` : 'N/A', icon: Briefcase, color: 'text-blue-500' },
        { label: 'Response', value: isOnline ? 'Online Now' : '< 1hr', icon: Clock, color: isOnline ? 'text-success-500' : 'text-purple-500' }
    ], [profile, isOnline]);

    if (isLoading) return (
        <div className="h-full w-full flex items-center justify-center p-20">
            <Spinner size="lg" />
        </div>
    );

    if (isError || !profile) return (
        <div className="h-full w-full flex flex-col items-center justify-center p-12 text-center">
            <h2 className="text-xl font-bold mb-4">Worker Profile Unavailable</h2>
            <Button onClick={onClose} variant="primary">Go Back</Button>
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-gray-50 text-gray-900 dark:bg-dark-950 dark:text-white overflow-y-auto scrollbar-hide">

            {/* Header Section */}
            <header className="relative shrink-0">
                {/* Visual Cover */}
                <div className="h-32 md:h-48 w-full bg-brand-500/10 dark:bg-brand-900/30" />

                <div className="max-w-7xl mx-auto px-6 lg:px-12 -mt-16 md:-mt-20">
                    <div className="flex flex-col md:flex-row items-end gap-6 pb-8 border-b border-black/5 dark:border-white/5">
                        {/* Avatar */}
                        <div className="relative">
                            <div className="p-1 rounded-3xl bg-white dark:bg-dark-950 shadow-xl">
                                <img
                                    src={resolveProfilePhotoUrl(profile.user?.profilePhotoUrl)}
                                    alt={profile.user?.name}
                                    className="w-32 h-32 md:w-40 md:h-40 rounded-2xl object-cover shadow-inner"
                                />
                            </div>
                            {profile.verificationLevel && (
                                <div className="absolute -bottom-2 -right-2 bg-white dark:bg-dark-950 p-2 rounded-xl shadow-lg border-4 border-inherit">
                                    <Badge variant={getVerificationLevelVariant(profile.verificationLevel)} className="flex items-center gap-1">
                                        <ShieldCheck size={16} fill="currentColor" /> {profile.verificationLevel}
                                    </Badge>
                                </div>
                            )}
                        </div>

                        {/* Basic Info */}
                        <div className="flex-1 space-y-2 mb-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-3xl md:text-4xl font-black tracking-tight">{profile.user?.name}</h1>
                                <Badge variant={getVerificationLevelVariant(profile.verificationLevel)} className="h-6 flex items-center gap-1">
                                    <ShieldCheck size={12} fill="currentColor" /> {profile.verificationLevel || 'VERIFIED'}
                                </Badge>
                                {profile.verificationScore && (
                                    <Badge variant="info" className="h-6">
                                        Trust Score: {profile.verificationScore}
                                    </Badge>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-sm font-medium opacity-60">
                                <span className="flex items-center gap-1.5">
                                    <MapPin size={16} className="text-brand-500" />
                                    {profile.city || 'Available across India'}
                                    {distance && (
                                        <span className="ml-1 text-brand-500 font-bold">({distance} km away)</span>
                                    )}
                                </span>
                                <span>•</span>
                                <span className={`flex items-center gap-1.5 ${isOnline ? 'text-success-500' : ''}`}>
                                    <Zap size={16} className={isOnline ? 'text-success-500 animate-pulse' : 'text-warning-500'} />
                                    {isOnline ? 'Active & Ready' : (profile.verificationLevel === 'PREMIUM' ? 'Elite Professional' : 'Top Service Provider')}
                                </span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-3 mb-2">
                            {activeBooking && (
                                <ChatToggle bookingId={activeBooking.id} label="Message" />
                            )}
                            <div className="flex gap-2">
                                <Button variant="outline" size="icon" className="rounded-xl"><Share2 size={18} /></Button>
                                <Button variant="outline" size="icon" className="rounded-xl"><Heart size={18} /></Button>
                                <Button onClick={onClose} variant="ghost" className="md:hidden"><ArrowLeft size={18} /></Button>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Layout Grid */}
            <main className="max-w-7xl mx-auto w-full px-6 lg:px-12 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* Content Column (Left) */}
                <div className="lg:col-span-8 space-y-10">

                    {/* Stats Row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {stats.map((stat, i) => (
                            <div key={i} className="p-4 rounded-2xl border bg-white border-black/5 dark:bg-white/5 dark:border-white/5 flex items-center gap-4">
                                <div className={`p-2 rounded-xl bg-current/10 ${stat.color}`}>
                                    <stat.icon size={20} />
                                </div>
                                <div>
                                    <p className="text-xs font-bold opacity-40 uppercase tracking-wider">{stat.label}</p>
                                    <p className="text-lg font-black tracking-tight">{stat.value}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex items-center gap-8 border-b border-black/5 dark:border-white/5">
                        {['overview', 'services', 'reviews'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`pb-4 text-sm font-bold uppercase tracking-widest transition-all relative ${activeTab === tab ? 'text-brand-500' : 'opacity-40 hover:opacity-100'
                                    }`}
                            >
                                {tab}
                                {activeTab === tab && (
                                    <Motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500" />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    <AnimatePresence mode="wait">
                        <Motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="min-h-[300px]"
                        >
                            {activeTab === 'overview' && (
                                <div className="space-y-8">
                                    <section className="space-y-4">
                                        <h3 className="text-lg font-bold">Biography</h3>
                                        <p className="text-lg leading-relaxed opacity-70">
                                            {profile.bio || "Professional expert dedicated to providing exceptional service quality in every project."}
                                        </p>
                                    </section>

                                    <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="p-6 rounded-2xl border bg-white border-black/5 dark:bg-white/5 dark:border-white/5">
                                            <h4 className="font-bold flex items-center gap-2 mb-4"><Calendar size={18} className="text-brand-500" /> Availability</h4>
                                            <ul className="space-y-2 text-sm opacity-70">
                                                <li className="flex justify-between"><span>Mon - Fri</span> <span className="font-bold">08:00 AM - 06:00 PM</span></li>
                                                <li className="flex justify-between"><span>Saturday</span> <span className="font-bold">10:00 AM - 04:00 PM</span></li>
                                                <li className="flex justify-between text-error-500"><span>Sunday</span> <span>Closed</span></li>
                                            </ul>
                                        </div>
                                        <div className="p-6 rounded-2xl border bg-white border-black/5 dark:bg-white/5 dark:border-white/5">
                                            <h4 className="font-bold flex items-center gap-2 mb-4"><Award size={18} className="text-brand-500" /> Certifications</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {['Quality Assured', 'Background Checked', 'Licenced Pro'].map(c => (
                                                    <span key={c} className="px-3 py-1 bg-brand-500/10 text-brand-500 rounded-lg text-[10px] font-bold uppercase">{c}</span>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Location Service Area Card */}
                                        {Number.isFinite(Number(profile.baseLatitude)) && Number.isFinite(Number(profile.baseLongitude)) && (
                                            <div className="md:col-span-2 p-6 rounded-3xl border bg-white border-black/5 dark:bg-white/5 dark:border-white/5">
                                                <div className="flex items-center justify-between mb-4">
                                                    <h4 className="font-bold flex items-center gap-2"><MapPin size={18} className="text-brand-500" /> Service Coverage</h4>
                                                    <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest px-2">
                                                        {profile.serviceRadius || 10} KM Radius
                                                    </Badge>
                                                </div>
                                                <div className="rounded-2xl overflow-hidden border border-black/5 dark:border-white/5">
                                                    <MiniMap
                                                        lat={Number(profile.baseLatitude)}
                                                        lng={Number(profile.baseLongitude)}
                                                        height="240px"
                                                    />
                                                </div>
                                                <p className="mt-4 text-xs opacity-60 leading-relaxed italic">
                                                    * This professional operates within {profile.serviceRadius || 10}km of their service hub.
                                                    Base location is verified for logistics planning.
                                                </p>
                                            </div>
                                        )}
                                    </section>
                                </div>
                            )}

                            {activeTab === 'services' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {services.map(({ service }) => (
                                        <div
                                            key={service.id}
                                            className="p-6 rounded-2xl border flex items-center justify-between group transition-all bg-white border-black/5 hover:border-brand-500/30 dark:bg-white/5 dark:border-white/5 dark:hover:bg-white/10"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 rounded-xl bg-brand-500/10 text-brand-500">
                                                    <Hammer size={20} />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold">{service.name}</h4>
                                                    <p className="text-xs opacity-50">Expert Professional Service</p>
                                                </div>
                                            </div>
                                            <ChevronRight size={18} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all text-brand-500" />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {activeTab === 'reviews' && (
                                <div className="space-y-6">
                                    {reviews.length > 0 ? reviews.map((review) => (
                                        <div key={review.id} className="p-6 rounded-2xl border bg-white border-black/5 dark:bg-white/5 dark:border-white/5 space-y-4">
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-3">
                                                    <img
                                                        src={resolveProfilePhotoUrl(review.reviewer?.profilePhotoUrl)}
                                                        className="w-10 h-10 rounded-full object-cover"
                                                        alt={review.reviewer?.name}
                                                    />
                                                    <div>
                                                        <h5 className="font-bold text-sm">{review.reviewer?.name}</h5>
                                                        <div className="flex gap-0.5 text-warning-500">
                                                            {[...Array(5)].map((_, j) => <Star key={j} size={10} fill={j < review.rating ? "currentColor" : "none"} />)}
                                                        </div>
                                                    </div>
                                                </div>
                                                <span className="text-[10px] opacity-40 uppercase font-bold">{formatReviewDate(review.createdAt)}</span>
                                            </div>
                                            <p className="text-sm italic opacity-80 leading-relaxed">"{review.comment}"</p>
                                        </div>
                                    )) : (
                                        <div className="py-20 text-center opacity-30 flex flex-col items-center">
                                            <MessageSquare size={40} className="mb-4" />
                                            <p className="font-bold uppercase tracking-widest text-sm">No reviews yet</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </Motion.div>
                    </AnimatePresence>
                </div>

                {/* Sidebar Column (Right - Sticky) */}
                <aside className="lg:col-span-4">
                    <div className="sticky top-8 space-y-6">

                        {/* Highlights Card */}
                        <div className="p-8 rounded-3xl border shadow-xl bg-white border-black/5 dark:bg-dark-900 dark:border-white/10">
                            <div className="space-y-6">
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40">Starting from</span>
                                    <div className="flex items-baseline gap-1 mt-1">
                                        <span className="text-4xl font-black tracking-tight text-brand-500">₹{toFixedSafe(profile.hourlyRate, 0, '0')}</span>
                                        <span className="text-sm font-bold opacity-40 italic">/ hour</span>
                                    </div>
                                </div>

                                <div className="space-y-3 pt-4 border-t border-black/5 dark:border-white/5">
                                    <div className="flex items-center gap-3 text-sm font-medium">
                                        <div className="p-1.5 rounded-lg bg-green-500/10 text-green-500"><ShieldCheck size={16} /></div>
                                        <span>Fully Insured & Background Checked</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm font-medium">
                                        <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500"><Clock size={16} /></div>
                                        <span>Average response: &lt; 1 hour</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm font-medium">
                                        <div className="p-1.5 rounded-lg bg-yellow-500/10 text-yellow-500"><Star size={16} /></div>
                                        <span>Top 10% Professional on UrbanPro</span>
                                    </div>
                                </div>

                                <Button
                                    onClick={onAction}
                                    fullWidth
                                    size="lg"
                                    className="h-16 rounded-2xl text-sm font-bold uppercase tracking-widest shadow-lg shadow-brand-500/20"
                                >
                                    Book an Appointment
                                </Button>

                                <p className="text-[10px] text-center opacity-40 font-bold uppercase tracking-wider">
                                    No upfront payment required
                                </p>
                            </div>
                        </div>

                        {/* Badges/Trust Section */}
                        <div className="p-6 rounded-3xl border bg-gray-100 border-black/5 dark:bg-white/5 dark:border-white/5">
                            <h4 className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-4 text-center">Safety & Quality</h4>
                            <div className="flex justify-center gap-6">
                                <Award size={24} className="opacity-30 hover:opacity-100 transition-opacity" />
                                <IndianRupee size={24} className="opacity-30 hover:opacity-100 transition-opacity" />
                                <Hammer size={24} className="opacity-30 hover:opacity-100 transition-opacity" />
                                <MapPin size={24} className="opacity-30 hover:opacity-100 transition-opacity" />
                            </div>
                        </div>
                    </div>
                </aside>

            </main>

            {/* Mobile Sticky Booking Footer */}
            <div className="lg:hidden sticky bottom-0 left-0 right-0 p-4 border-t backdrop-blur-xl z-[100] bg-white/80 border-black/5 dark:bg-dark-950/80 dark:border-white/10">
                <div className="flex items-center justify-between gap-4 max-w-lg mx-auto">
                    <div>
                        <p className="text-[10px] font-bold uppercase opacity-40">Rate</p>
                        <p className="text-xl font-black">₹{toFixedSafe(profile.hourlyRate, 0, '0')}<span className="text-xs opacity-50 font-normal">/hr</span></p>
                    </div>
                    <Button onClick={onAction} className="flex-1 h-12 rounded-xl text-xs font-bold uppercase tracking-widest">
                        Book Now
                    </Button>
                </div>
            </div>
        </div>
    );
}
