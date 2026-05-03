// AuthLayout — glassmorphic brand panel, animated stats, responsive

import { motion as Motion } from 'framer-motion';
import { Shield, Star, Users } from 'lucide-react';
import { Navbar } from './Navbar';

/**
 * AuthLayout — split-screen for all auth pages
 */
export function AuthLayout({ children, title, subtitle }) {
  const stats = [
    { value: '50K+', label: 'Customers',    icon: Users },
    { value: '8K+',  label: 'Professionals', icon: Shield },
    { value: '4.9★', label: 'Avg Rating',   icon: Star },
  ];

  return (
    <div className="auth-redesign-shell min-h-screen flex flex-col bg-neutral-50 dark:bg-dark-950">
      <Navbar showBrand={true} />

      <div className="flex flex-1 min-h-0 bg-neutral-50 dark:bg-dark-950">

        {/* ── Left Panel — Brand Visual ─────────────────────────────────── */}
        <div className="hidden lg:flex flex-1 relative overflow-hidden items-center justify-center p-12">
          {/* Background gradient */}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(145deg, #0f766e 0%, #0ea5e9 38%, #f59e0b 76%, #ea580c 100%)' }} />

          {/* Animated orb accents */}
          <Motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-[-20%] right-[-10%] w-[70%] h-[70%] rounded-full blur-[100px] bg-sky-300"
          />
          <Motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.35, 0.2] }}
            transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
            className="absolute bottom-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full blur-[100px] bg-amber-400"
          />

          {/* Decorative rings */}
          <div className="absolute top-8   right-8  w-48 h-48 rounded-full border border-white/8" />
          <div className="absolute bottom-8 left-8  w-64 h-64 rounded-full border border-white/8" />
          <div className="absolute top-1/3 right-12 w-28 h-28 rounded-full border border-white/8" />

          {/* Content */}
          <div className="relative z-10 max-w-lg text-white">
            {/* Logo */}
            <Motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex items-center gap-3 mb-10"
            >
              <div className="w-11 h-11 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/30 shadow-lg shadow-black/20">
                <span className="inline-block text-white font-black text-xl" style={{ transform: 'rotate(-30deg)' }}>E</span>
              </div>
              <span className="text-2xl font-black tracking-tight">ExpertsHub</span>
            </Motion.div>

            <Motion.h1
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl xl:text-5xl font-black mb-5 leading-tight tracking-tight"
            >
              {title || 'Your trusted home services platform'}
            </Motion.h1>
            <Motion.p
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg text-white/70 mb-10 leading-relaxed"
            >
              {subtitle || 'Connect with verified professionals for all your home service needs.'}
            </Motion.p>

            {/* Stats */}
            <Motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="grid grid-cols-3 gap-3"
            >
              {stats.map((stat) => {
                const I = stat.icon;
                return (
                  <div key={stat.label} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4 text-center">
                    <I size={16} className="mx-auto mb-1.5 text-white/60" />
                    <div className="text-2xl font-black mb-0.5">{stat.value}</div>
                    <div className="text-xs text-white/60 font-medium">{stat.label}</div>
                  </div>
                );
              })}
            </Motion.div>
          </div>
        </div>

        {/* ── Right Panel — Form ────────────────────────────────────────── */}
        <div className="flex-1 flex items-center justify-center p-6 sm:p-10 relative bg-white dark:bg-dark-950">
          {/* Subtle background glow */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[80px] opacity-40 bg-sky-100 dark:bg-sky-500/10" />
            <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full blur-[60px] opacity-35 bg-amber-100 dark:bg-amber-500/10" />
          </div>

          <div className="w-full max-w-md relative z-10">
            {/* Mobile Logo */}
            <div className="flex lg:hidden items-center gap-2.5 mb-8">
              <div className="w-9 h-9 bg-gradient-to-br from-brand-500 to-accent-500 rounded-xl flex items-center justify-center shadow-brand-sm">
                <span className="inline-block text-white font-black text-base" style={{ transform: 'rotate(-30deg)' }}>E</span>
              </div>
              <span className="text-xl font-black gradient-text">ExpertsHub</span>
            </div>

            {children}
          </div>
        </div>
      </div>
      </div>
  );
}
