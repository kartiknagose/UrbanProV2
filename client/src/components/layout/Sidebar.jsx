// Sidebar — gradient active items, icon glow, premium collapse animation

import { NavLink } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  Home, Briefcase, Calendar, User, ShieldCheck, ShieldAlert,
  Clock, Star, Lock, ChevronLeft, ChevronRight, Search,
  LayoutDashboard, ClipboardList, MessageSquare, Gift, Shield,
  Activity, Tag, AlertTriangle, Users, Wallet, X, Heart, Medal, Crown, Flag,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { Avatar } from '../common/Avatar';

const navConfig = {
  CUSTOMER: [
    { label: 'Dashboard',        to: '/customer/dashboard',        icon: Home },
    { label: 'Browse Services',  to: '/services',                  icon: Briefcase },
    { label: 'My Bookings',      to: '/customer/bookings',         icon: Calendar },
    { label: 'Messages',         to: '/messages',                  icon: MessageSquare },
    { label: 'My Reviews',       to: '/customer/reviews',          icon: Star },
    { label: 'My Favorites',     to: '/customer/favorites',        icon: Heart },
    { label: 'Profile Hub',      to: '/customer/profile',          icon: User },
  ],
  WORKER: [
    { label: 'Dashboard',          to: '/worker/dashboard',            icon: LayoutDashboard },
    { label: 'Browse Services',    to: '/services',                    icon: Search },
    { label: 'My Services',        to: '/worker/services',             icon: Briefcase },
    { label: 'Bookings',           to: '/worker/bookings',             icon: ClipboardList },
    { label: 'Messages',           to: '/messages',                    icon: MessageSquare },
    { label: 'Availability',       to: '/worker/availability',         icon: Clock },
    { label: 'Reviews',            to: '/worker/reviews',              icon: Star },
    { label: 'Earnings',           to: '/worker/earnings',             icon: Wallet },
    { label: 'Verification',       to: '/worker/verification',         icon: ShieldCheck },
  ],
  ADMIN: [
    { label: 'Dashboard',       to: '/admin/dashboard',      icon: LayoutDashboard },
    { label: 'Analytics',       to: '/admin/analytics',      icon: Activity },
    { label: 'Services',        to: '/admin/services',       icon: Briefcase },
    { label: 'Bookings',        to: '/admin/bookings',       icon: Calendar },
    { label: 'Users',           to: '/admin/users',          icon: User },
    { label: 'Workers',         to: '/admin/workers',        icon: Users },
    { label: 'Verification',    to: '/admin/verification',   icon: ShieldCheck },
    { label: 'Fraud Detection', to: '/admin/fraud',          icon: ShieldAlert },
    { label: 'Reports',         to: '/admin/reports',        icon: Flag },
    { label: 'Coupons',         to: '/admin/coupons',        icon: Tag },
    { label: 'SOS Alerts',      to: '/admin/sos-alerts',     icon: AlertTriangle, highlight: true },
  ],
};

export function Sidebar({ isOpen, isCollapsed, onClose, onToggleCollapse }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const links = navConfig[user?.role] || [];

  const getRoleLabel = (role) => {
    switch (role) {
      case 'CUSTOMER': return t('Customer');
      case 'WORKER': return t('Professional');
      case 'ADMIN': return t('Administrator');
      default: return role;
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-40 lg:hidden bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Sidebar panel */}
      <Motion.aside
        animate={{ width: isCollapsed ? 72 : 256 }}
        initial={false}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        className={[
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r',
          'bg-white dark:bg-dark-900 border-neutral-200 dark:border-dark-700/80',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          'transition-transform duration-300 lg:transition-none',
        ].join(' ')}
      >
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className={`flex items-center h-16 border-b px-4 shrink-0 border-neutral-100 dark:border-dark-700/80 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          {isCollapsed ? (
            <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-accent-500 rounded-xl flex items-center justify-center shadow-brand-sm">
              <span className="inline-block text-white font-black text-sm" style={{ transform: 'rotate(-30deg)' }}>E</span>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-accent-500 rounded-xl flex items-center justify-center shadow-brand-sm">
                <span className="inline-block text-white font-black text-sm" style={{ transform: 'rotate(-30deg)' }}>E</span>
              </div>
              <span className="font-black text-lg gradient-text tracking-tight">ExpertsHub</span>
            </div>
          )}

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden lg:flex p-1.5 rounded-lg transition-colors text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-dark-800"
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-lg transition-colors text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-dark-800"
              aria-label="Close sidebar"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <NavLink to={user?.role === 'WORKER' ? '/worker/profile' : '/customer/profile'} onClick={onClose} className={`px-3 py-3 border-b border-neutral-100 dark:border-dark-700/80 hover:bg-neutral-50 dark:hover:bg-dark-800 transition-colors block ${isCollapsed ? 'flex justify-center' : ''}`}>
          <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
            <div className="relative shrink-0">
              <Avatar name={user?.name} src={user?.profilePhotoUrl} size="md" className="ring-2 ring-brand-500/30 rounded-xl" />
              {/* Online indicator */}
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success-500 border-2 border-white dark:border-dark-900" />
            </div>

            <AnimatePresence>
              {!isCollapsed && (
                <Motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.18 }}
                  className="min-w-0"
                >
                  <p className="text-sm font-bold truncate text-neutral-900 dark:text-neutral-100">
                    {user?.name || 'User'}
                  </p>
                  <p className="text-xs font-medium text-neutral-400 dark:text-neutral-500">
                    {getRoleLabel(user?.role)}
                  </p>
                </Motion.div>
              )}
            </AnimatePresence>
          </div>
        </NavLink>

        {/* ── Navigation ───────────────────────────────────────────────── */}
        <nav className={`flex-1 overflow-y-auto scrollbar-thin py-3 ${isCollapsed ? 'px-2' : 'px-2.5'}`}>
          <div className="space-y-0.5">
            {links.map((item) => {
              const Icon = item.icon;

              if (item.disabled) {
                return (
                  <div
                    key={item.to}
                    title={isCollapsed ? `${item.label} (coming soon)` : undefined}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm opacity-40 cursor-not-allowed ${isCollapsed ? 'justify-center' : ''} text-neutral-400`}
                  >
                    <Icon size={18} />
                    {!isCollapsed && (
                      <>
                        <span className="flex-1">{t(item.label)}</span>
                        <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-neutral-100 dark:bg-dark-800 text-neutral-400">
                          <Lock size={9} /> Soon
                        </span>
                      </>
                    )}
                  </div>
                );
              }

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onClose}
                  title={isCollapsed ? item.label : undefined}
                  className={({ isActive }) => {
                    const base = `relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${isCollapsed ? 'justify-center' : ''}`;

                    if (item.highlight) return `${base} text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-500/10`;

                    if (isActive) return `${base} bg-gradient-to-r from-brand-50 dark:from-brand-500/20 to-accent-50/40 dark:to-accent-500/10 text-brand-700 dark:text-brand-300`;

                    return `${base} text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-dark-800`;
                  }}
                >
                  {({ isActive }) => (
                    <>
                      {/* Active left bar */}
                      {isActive && !isCollapsed && (
                        <Motion.span
                          layoutId="sidebar-active-bar"
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-gradient-to-b from-brand-500 to-accent-500"
                        />
                      )}
                      {/* Icon */}
                      <span className={[
                        'transition-colors duration-200',
                        isActive ? 'text-brand-500' : item.highlight ? 'text-error-500' : '',
                      ].join(' ')}>
                        <Icon size={18} />
                      </span>
                      {/* Label */}
                      <AnimatePresence>
                        {!isCollapsed && (
                          <Motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                          >
                             {t(item.label)}
                          </Motion.span>
                        )}
                      </AnimatePresence>
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        </nav>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <AnimatePresence>
          {!isCollapsed && (
            <Motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-4 py-3 border-t border-neutral-100 dark:border-dark-700/80"
            >
              <p className="text-[11px] text-center text-neutral-400 dark:text-neutral-600 font-medium">
                ExpertsHub © {new Date().getFullYear()}
              </p>
            </Motion.div>
          )}
        </AnimatePresence>
      </Motion.aside>
    </>
  );
}
