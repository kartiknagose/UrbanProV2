import { Star, Phone, Mail, User } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { resolveProfilePhotoUrl } from '../../../utils/profilePhoto';

/**
 * UserMiniProfile Component
 * Used to introduce Customer to Worker and vice-versa in the Booking context.
 * 
 * @param {object} user - The user object (customer or worker.user)
 * @param {string} label - e.g., "Assigned Worker" or "Customer"
 * @param {boolean} showContact - Whether to show mobile/email
 */
export function UserMiniProfile({ user, label, showContact = false }) {
    const { isDark } = useTheme();

    if (!user) return null;

    const profilePhotoUrl = resolveProfilePhotoUrl(user.profilePhotoUrl);
    const profileInitial = (user.name || 'U').slice(0, 1).toUpperCase();
    const rating = Number(user.rating || 0).toFixed(1);
    const totalReviews = user.totalReviews || 0;

    return (
        <div className={`p-3 rounded-xl border transition-all ${isDark ? 'bg-dark-800/30 border-dark-700/50' : 'bg-gray-50/30 border-gray-100'
            }`}>
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    {/* Avatar */}
                    <div className="shrink-0">
                        {profilePhotoUrl ? (
                            <img
                                src={profilePhotoUrl}
                                alt={user.name}
                                className="w-10 h-10 rounded-lg object-cover border border-brand-500/10"
                            />
                        ) : (
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center text-white text-base font-bold shadow-sm">
                                {profileInitial}
                            </div>
                        )}
                    </div>

                    {/* Info */}
                    <div className="min-w-0">
                        <p className={`text-[10px] font-black uppercase tracking-widest leading-none mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            {label}
                        </p>
                        <h4 className={`font-bold text-sm truncate leading-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                            {user.name}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <Star size={10} className="fill-yellow-400 text-yellow-400 shrink-0" />
                            <span className={`text-[11px] font-black ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {rating}
                            </span>
                            <span className={`text-[10px] font-medium ${isDark ? 'text-gray-550' : 'text-gray-400'}`}>
                                ({totalReviews})
                            </span>
                        </div>
                    </div>
                </div>

                {showContact && (
                    <div className="flex items-center gap-2 pr-1">
                        <a
                            href={`tel:${user.mobile}`}
                            title={`Call ${user.name}`}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isDark ? 'bg-brand-900/30 text-brand-400 hover:bg-brand-900/50' : 'bg-brand-50 text-brand-600 hover:bg-brand-100'}`}
                        >
                            <Phone size={14} />
                        </a>
                        <a
                            href={`mailto:${user.email}`}
                            title={`Email ${user.name}`}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isDark ? 'bg-accent-900/30 text-accent-400 hover:bg-accent-900/50' : 'bg-accent-50 text-accent-600 hover:bg-accent-100'}`}
                        >
                            <Mail size={14} />
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}
