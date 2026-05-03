// Navbar — frosted glass, animated active indicator, premium typography

import { useMemo, useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  Menu, X, Briefcase, Settings, Users, Tag, Mail,
  LogOut, LogIn, UserPlus, Sun, Moon, LayoutGrid,
  ChevronDown, Globe
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';
import { Avatar } from '../common/Avatar';
import { Button } from '../ui/Button';
import { NotificationDropdown } from '../features/notifications/NotificationDropdown';

export function Navbar({ onOpenSidebar = () => {}, sidebarOffset = '', showBrand = true }) {
  const { user, isAuthenticated, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const userMenuRef = useRef(null);
  const langMenuRef = useRef(null);

  // Detect scroll for enhanced frosted effect
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close menus on route change
  useEffect(() => {
    const timer = window.setTimeout(() => { setMobileMenuOpen(false); setUserMenuOpen(false); }, 0);
    return () => window.clearTimeout(timer);
  }, [location.pathname]);

  useEffect(() => {
    if (!userMenuOpen && !langMenuOpen) return;
    const handler = (e) => { 
      if (userMenuOpen && userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false); 
      if (langMenuOpen && langMenuRef.current && !langMenuRef.current.contains(e.target)) setLangMenuOpen(false); 
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [userMenuOpen, langMenuOpen]);

  const publicLinks = [
    { name: t('Services'),    href: '/services',    icon: Briefcase },
    { name: t('Simple Process'),href: '/how-it-works', icon: Settings },
    { name: t('Coupons'),     href: '/pricing',      icon: Tag },
    { name: t('Users'),       href: '/about',        icon: Users },
    { name: t('Contact'),     href: '/contact',      icon: Mail },
  ];

  const handleLogout = async () => { await logout(); navigate('/login'); setMobileMenuOpen(false); };
  const closeMobileMenu = () => setMobileMenuOpen(false);

  const userMenuItems = useMemo(() => {
    switch (user?.role) {
      case 'WORKER': return [
        { label: t('Dashboard'),    href: '/worker/dashboard' },
        { label: t('My Profile'),   href: '/worker/profile' },
        { label: t('My Reviews'),   href: '/worker/reviews' },
        { label: t('Verification'), href: '/worker/verification' },
      ];
      case 'ADMIN': return [{ label: t('Dashboard'), href: '/admin/dashboard' }];
      default: return [
        { label: t('Dashboard'),  href: '/customer/dashboard' },
        { label: t('My Profile'), href: '/customer/profile' },
        { label: t('My Bookings'),href: '/customer/bookings' },
      ];
    }
  }, [user?.role, t]);

  const isLinkActive    = (href) => location.pathname === href || location.pathname.startsWith(href + '/');

  return (
    <nav
      className={[
        'sticky top-0 z-40 border-b transition-all duration-300',
        scrolled
          ? 'backdrop-blur-2xl shadow-lg shadow-black/5 bg-white/80 dark:bg-dark-900/85 border-neutral-200/80 dark:border-dark-700'
          : 'backdrop-blur-xl bg-white/70 dark:bg-dark-900/70 border-neutral-200/60 dark:border-dark-700/60',
        sidebarOffset,
      ].join(' ')}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* ── Logo ────────────────────────────────────────────────────── */}
          {showBrand ? (
            <Link
              to={isAuthenticated
                ? (user?.role === 'CUSTOMER' ? '/customer/dashboard' : user?.role === 'WORKER' ? '/worker/dashboard' : '/admin/dashboard')
                : '/'
              }
              className="flex items-center gap-2.5 shrink-0 group"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-accent-500 rounded-xl flex items-center justify-center shadow-md shadow-brand-500/30 group-hover:shadow-brand-500/50 transition-shadow duration-200">
                <span className="inline-block text-white font-black text-lg leading-none" style={{ transform: 'rotate(-30deg)' }}>E</span>
              </div>
              <span className="text-xl font-black gradient-text tracking-tight">
                ExpertsHub
              </span>
            </Link>
          ) : (
            <div className="w-8 h-8" />
          )}

          {/* ── Desktop Nav Links ────────────────────────────────────────── */}
          <div className="hidden md:flex items-center gap-0.5">
            {(!isAuthenticated ? publicLinks : []).map((link) => {
              const active = isLinkActive(link.href);
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  className={[
                    'relative px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200',
                    active
                      ? 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-dark-800',
                  ].join(' ')}
                >
                  {link.name}
                  {active && (
                    <Motion.span
                      layoutId="nav-active-indicator"
                      className="absolute bottom-1 left-3 right-3 h-0.5 rounded-full bg-gradient-to-r from-brand-500 to-accent-500"
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* ── Right Actions ────────────────────────────────────────────── */}
          <div className="flex items-center gap-0.5">

            {/* Sidebar toggle (desktop) */}
            {isAuthenticated && (
              <button
                type="button"
                onClick={onOpenSidebar}
                className="hidden md:inline-flex p-2 rounded-xl transition-colors text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-dark-800"
                aria-label="Open sidebar"
              >
                <LayoutGrid size={20} />
              </button>
            )}

            {/* Notifications */}
            {isAuthenticated && <NotificationDropdown />}

            {/* Language toggle */}
            <div className="relative hidden md:block" ref={langMenuRef}>
              <button
                onClick={() => setLangMenuOpen(!langMenuOpen)}
                className="flex items-center gap-1 p-2 rounded-xl transition-colors text-neutral-500 dark:text-neutral-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-neutral-100 dark:hover:bg-dark-800 uppercase text-xs font-black"
                aria-label="Toggle language"
              >
                <Globe size={18} />
                {i18n.language}
              </button>
              <AnimatePresence>
                {langMenuOpen && (
                  <Motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-32 rounded-xl border shadow-xl py-1.5 z-50 bg-white dark:bg-dark-800 border-neutral-200 dark:border-dark-700"
                  >
                    {[
                      { code: 'en', name: 'English' },
                      { code: 'hi', name: 'हिंदी' },
                      { code: 'mr', name: 'मराठी' },
                      { code: 'ta', name: 'தமிழ்' },
                      { code: 'te', name: 'తెలుగు' }
                    ].map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => { i18n.changeLanguage(lang.code); setLangMenuOpen(false); }}
                        className={`w-full text-left px-4 py-2 text-sm font-semibold transition-colors ${i18n.language === lang.code ? 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20' : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-dark-700'}`}
                      >
                        {lang.name}
                      </button>
                    ))}
                  </Motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl transition-colors text-neutral-500 dark:text-neutral-400 hover:text-brand-600 dark:hover:text-yellow-400 hover:bg-neutral-100 dark:hover:bg-dark-800"
              aria-label="Toggle theme"
            >
              <AnimatePresence mode="wait">
                <Motion.span
                  key={isDark ? 'sun' : 'moon'}
                  initial={{ rotate: -90, opacity: 0, scale: 0.7 }}
                  animate={{ rotate: 0, opacity: 1, scale: 1 }}
                  exit={{ rotate: 90, opacity: 0, scale: 0.7 }}
                  transition={{ duration: 0.2 }}
                >
                  {isDark ? <Sun size={20} /> : <Moon size={20} />}
                </Motion.span>
              </AnimatePresence>
            </button>

            {/* Desktop Auth */}
            <div className="hidden md:flex items-center gap-2 ml-1">
              {isAuthenticated ? (
                <div className="relative" ref={userMenuRef}>
                  {/* Avatar trigger */}
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen((o) => !o)}
                    className={[
                      'flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full border-2 transition-all duration-200',
                      userMenuOpen
                        ? 'border-brand-400 dark:border-brand-400 bg-brand-50 dark:bg-brand-500/10'
                        : 'border-neutral-200 dark:border-dark-700 hover:border-brand-300 dark:hover:border-brand-500/50 hover:bg-neutral-50 dark:hover:bg-dark-800',
                    ].join(' ')}
                    aria-label="User menu"
                    aria-expanded={userMenuOpen}
                  >
                    <Avatar name={user?.name} src={user?.profilePhotoUrl} size="sm" />
                    <span className="text-sm font-semibold max-w-[80px] truncate text-neutral-700 dark:text-neutral-300">
                      {user?.name?.split(' ')[0]}
                    </span>
                    <Motion.span animate={{ rotate: userMenuOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown size={14} className="text-neutral-400" />
                    </Motion.span>
                  </button>

                  {/* Dropdown */}
                  <AnimatePresence>
                    {userMenuOpen && (
                      <Motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                        className="absolute right-0 mt-2.5 w-60 rounded-2xl border shadow-2xl py-2 z-50 bg-white dark:bg-dark-800 border-neutral-200 dark:border-dark-700 overflow-hidden"
                      >
                        {/* Profile header */}
                        <div className="px-4 py-3 border-b border-neutral-100 dark:border-dark-700">
                          <div className="flex items-center gap-3">
                            <Avatar name={user?.name} src={user?.profilePhotoUrl} size="md" />
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate">{user?.name || 'User'}</p>
                              <p className="text-xs text-neutral-400 truncate">{user?.email}</p>
                            </div>
                          </div>
                          <span className="inline-flex mt-2 text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-brand-50 dark:bg-brand-500/20 text-brand-600 dark:text-brand-300 border border-brand-200 dark:border-brand-500/30">
                            {user?.role === 'CUSTOMER' ? t('Customer') : user?.role === 'WORKER' ? t('Professional') : t('Administrator')}
                          </span>
                        </div>

                        {/* Nav items */}
                        <div className="py-1.5">
                          {userMenuItems.map((item) => (
                            <Link
                              key={item.href}
                              to={item.href}
                              onClick={() => setUserMenuOpen(false)}
                              className="flex items-center px-4 py-2.5 text-sm font-medium transition-colors text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-dark-700 hover:text-neutral-900 dark:hover:text-neutral-100"
                            >
                              {item.label}
                            </Link>
                          ))}
                        </div>

                        <div className="border-t pt-1.5 border-neutral-100 dark:border-dark-700">
                          <button
                            type="button"
                            onClick={handleLogout}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-error-600 hover:bg-error-50 dark:hover:bg-error-500/10 transition-colors"
                          >
                            <LogOut size={15} />
                            {t('Logout')}
                          </button>
                        </div>
                      </Motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <>
                  <Button variant="ghost" size="sm" icon={LogIn} onClick={() => navigate('/login')}>
                    {t('Login')}
                  </Button>
                  <Button variant="gradient" size="sm" icon={UserPlus} onClick={() => navigate('/register')}>
                    {t('Sign Up')}
                  </Button>
                </>
              )}
            </div>

            {/* Mobile sidebar toggle for authenticated users */}
            {isAuthenticated ? (
              <button
                type="button"
                onClick={onOpenSidebar}
                className="md:hidden p-2 rounded-xl transition-colors text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-dark-800 ml-1"
                aria-label="Open sidebar"
              >
                <LayoutGrid size={22} />
              </button>
            ) : (
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-xl transition-colors text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-dark-800 ml-1"
                aria-label="Toggle mobile menu"
                aria-expanded={mobileMenuOpen}
              >
                <AnimatePresence mode="wait">
                  {mobileMenuOpen ? (
                    <Motion.span key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
                      <X size={22} />
                    </Motion.span>
                  ) : (
                    <Motion.span key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
                      <Menu size={22} />
                    </Motion.span>
                  )}
                </AnimatePresence>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile Menu ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <Motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="md:hidden border-t overflow-hidden border-neutral-200 dark:border-dark-700 bg-white/95 dark:bg-dark-900/95 backdrop-blur-2xl"
          >
            <div className="px-4 py-4 space-y-1">
              {/* Public links */}
              {(!isAuthenticated ? publicLinks : []).map((link) => {
                const Icon = link.icon;
                const active = isLinkActive(link.href);
                return (
                  <Link
                    key={link.href}
                    to={link.href}
                    onClick={closeMobileMenu}
                    className={[
                      'flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all duration-200',
                      active
                        ? 'bg-brand-50 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400'
                        : 'text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-50 dark:hover:bg-dark-800',
                    ].join(' ')}
                  >
                    <Icon size={18} />
                    {link.name}
                  </Link>
                );
              })}

              {/* Theme toggle */}
              <button
                onClick={() => { toggleTheme(); closeMobileMenu(); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-50 dark:hover:bg-dark-800"
              >
                {isDark ? <Sun size={18} /> : <Moon size={18} />}
                {isDark ? t('Light Mode') : t('Dark Mode')}
              </button>

              {/* Language toggle mobile */}
              <div className="flex border border-neutral-200 dark:border-dark-700 rounded-xl overflow-hidden mt-2 p-1 bg-neutral-50 dark:bg-dark-800">
                {[
                  { code: 'en', name: 'EN' },
                  { code: 'hi', name: 'HI' },
                  { code: 'mr', name: 'MR' },
                  { code: 'ta', name: 'TA' },
                  { code: 'te', name: 'TE' }
                ].map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => { i18n.changeLanguage(lang.code); }}
                    className={`flex-1 flex items-center justify-center py-2 text-xs font-extrabold uppercase rounded-lg transition-all ${i18n.language === lang.code ? 'bg-white shadow text-brand-600 dark:bg-dark-900 dark:text-brand-400' : 'text-neutral-500 dark:text-neutral-400'}`}
                  >
                    {lang.name}
                  </button>
                ))}
              </div>

              {/* Auth UX on mobile */}
              {isAuthenticated ? (
                <div className="pt-3 mt-3 border-t space-y-1 border-neutral-100 dark:border-dark-700">
                  <div className="flex items-center gap-3 px-4 py-2 mb-1">
                    <Avatar name={user?.name} src={user?.profilePhotoUrl} size="md" />
                    <div>
                      <p className="font-bold text-sm text-neutral-900 dark:text-neutral-100">{user?.name}</p>
                      <p className="text-xs text-neutral-400">{user?.role === 'CUSTOMER' ? t('Customer') : user?.role === 'WORKER' ? t('Professional') : t('Administrator')}</p>
                    </div>
                  </div>
                  {userMenuItems.map((item) => (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={closeMobileMenu}
                      className="flex items-center px-4 py-3 rounded-xl font-semibold transition-all text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-50 dark:hover:bg-dark-800"
                    >
                      {item.label}
                    </Link>
                  ))}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all text-error-600 hover:bg-error-50 dark:hover:bg-error-500/10"
                  >
                    <LogOut size={18} />
                    {t('Logout')}
                  </button>
                </div>
              ) : (
                <div className="pt-3 mt-3 border-t space-y-2 border-neutral-100 dark:border-dark-700">
                  <Button fullWidth variant="ghost" icon={LogIn} onClick={() => { navigate('/login'); closeMobileMenu(); }}>{t('Login')}</Button>
                  <Button fullWidth variant="gradient" icon={UserPlus} onClick={() => { navigate('/register'); closeMobileMenu(); }}>{t('Sign Up')}</Button>
                </div>
              )}
            </div>
          </Motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
