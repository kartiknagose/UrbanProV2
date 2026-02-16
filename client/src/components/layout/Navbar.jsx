// Main navigation bar component
// Adapts based on user role (Customer, Worker, Admin) and authentication state

import { useMemo, useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu,
  X,
  Home,
  Briefcase,
  Calendar,
  User,
  LogOut,
  LogIn,
  UserPlus,
  Sun,
  Moon,
  Settings,
  Users,
  Star,
  Clock,
  ShieldCheck,
  Tag,
  Mail,
  LayoutGrid,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';
import { resolveProfilePhotoUrl } from '../../utils/profilePhoto';
import { Button } from '../common';

/**
 * Navbar Component
 * Role-based navigation with mobile responsiveness
 */
export function Navbar({ onOpenSidebar = () => { }, sidebarOffset = '', showBrand = true }) {
  const { user, isAuthenticated, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  // ISSUE-005: Close user dropdown when clicking outside
  useEffect(() => {
    if (!userMenuOpen) return;
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

  const publicLinks = [
    { name: 'Services', href: '/services', icon: Briefcase },
    { name: 'How It Works', href: '/how-it-works', icon: Settings },
    { name: 'Pricing', href: '/pricing', icon: Tag },
    { name: 'About', href: '/about', icon: Users },
    { name: 'Contact', href: '/contact', icon: Mail },
  ];

  // Handle logout
  const handleLogout = async () => {
    await logout();
    navigate('/login');
    setMobileMenuOpen(false);
  };

  // Close mobile menu when clicking a link
  const closeMobileMenu = () => setMobileMenuOpen(false);

  // Navigation links based on user role
  const getNavLinks = () => {
    if (!isAuthenticated) {
      return [];
    }

    switch (user?.role) {
      case 'CUSTOMER':
        return [
          { name: 'Dashboard', href: '/dashboard', icon: Home },
          { name: 'Services', href: '/services', icon: Briefcase },
          { name: 'My Bookings', href: '/bookings', icon: Calendar },
          { name: 'Reviews', href: '/reviews', icon: Star },
        ];

      case 'WORKER':
        return [
          { name: 'Dashboard', href: '/worker/dashboard', icon: Home },
          { name: 'My Services', href: '/worker/services', icon: Briefcase },
          { name: 'Bookings', href: '/worker/bookings', icon: Calendar },
          { name: 'Availability', href: '/worker/availability', icon: Clock },
          { name: 'Reviews', href: '/worker/reviews', icon: Star },
          { name: 'Verification', href: '/worker/verification', icon: ShieldCheck },
        ];

      case 'ADMIN':
        return [
          { name: 'Dashboard', href: '/admin/dashboard', icon: Home },
          { name: 'Services', href: '/admin/services', icon: Briefcase },
          { name: 'Workers', href: '/admin/workers', icon: Users },
          { name: 'Bookings', href: '/admin/bookings', icon: Calendar },
          { name: 'Users', href: '/admin/users', icon: User },
          { name: 'Verification', href: '/admin/verification', icon: ShieldCheck },
        ];

      default:
        return [];
    }
  };

  const navLinks = getNavLinks();

  const userMenuItems = useMemo(() => {
    switch (user?.role) {
      case 'WORKER':
        return [
          { label: 'Dashboard', href: '/worker/dashboard' },
          { label: 'My Profile', href: '/worker/profile' },
          { label: 'My Reviews', href: '/worker/reviews' },
          { label: 'Verification', href: '/worker/verification' },
        ];
      case 'ADMIN':
        return [
          { label: 'Dashboard', href: '/admin/dashboard' },
        ];
      case 'CUSTOMER':
      default:
        return [
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'My Profile', href: '/profile' },
          { label: 'My Bookings', href: '/bookings' },
        ];
    }
  }, [user?.role]);

  const profilePhotoUrl = resolveProfilePhotoUrl(user?.profilePhotoUrl);
  const profileInitial = (user?.name || 'U').slice(0, 1).toUpperCase();

  const underlineVariants = {
    rest: { scaleX: 0, opacity: 0 },
    hover: { scaleX: 1, opacity: 1 },
  };

  // Navbar theme styles
  const navbarStyles = isDark
    ? 'bg-dark-900/95 border-dark-700 shadow-lg shadow-black/20'
    : 'bg-white/95 border-gray-200 shadow-lg shadow-gray-200/50';

  const linkStyles = isDark
    ? 'text-gray-300 hover:text-brand-400 hover:bg-dark-800'
    : 'text-gray-700 hover:text-brand-600 hover:bg-gray-100';

  const mobileLinkStyles = isDark
    ? 'text-gray-300 hover:text-brand-400 hover:bg-dark-800 border-dark-700'
    : 'text-gray-700 hover:text-brand-600 hover:bg-gray-100 border-gray-200';

  return (
    <nav className={`sticky top-0 z-40 border-b backdrop-blur-md ${navbarStyles} ${sidebarOffset}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          {showBrand ? (
            <Link
              to={isAuthenticated ? (user?.role === 'CUSTOMER' ? '/dashboard' : user?.role === 'WORKER' ? '/worker/dashboard' : '/admin/dashboard') : '/'}
              className="flex items-center gap-2"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-accent-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">U</span>
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-brand-500 to-accent-500 bg-clip-text text-transparent">
                UrbanPro
              </span>
            </Link>
          ) : (
            <div className="w-8 h-8" />
          )}

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {(!isAuthenticated ? publicLinks : []).map((link) => {
              const Icon = link.icon;
              return (
                <motion.div
                  key={link.href}
                  initial="rest"
                  whileHover="hover"
                  animate="rest"
                  className="relative"
                >
                  <Link
                    to={link.href}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${linkStyles}`}
                  >
                    <Icon size={18} />
                    {link.name}
                  </Link>
                  <motion.span
                    variants={underlineVariants}
                    transition={{ duration: 0.2 }}
                    className="absolute left-3 right-3 -bottom-0.5 h-0.5 origin-left rounded-full bg-gradient-to-r from-brand-500 to-accent-500"
                  />
                </motion.div>
              );
            })}
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated && (
              <button
                type="button"
                onClick={onOpenSidebar}
                className={`p-2 rounded-lg transition-colors ${linkStyles}`}
                aria-label="Open sidebar"
              >
                <LayoutGrid size={20} />
              </button>
            )}
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg transition-colors ${linkStyles}`}
              aria-label="Toggle theme"
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {/* Auth Actions */}
            {isAuthenticated ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((open) => !open)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-full border transition-colors ${isDark ? 'border-dark-700 hover:bg-dark-800' : 'border-gray-200 hover:bg-gray-100'}`}
                  aria-label="Open user menu"
                >
                  {profilePhotoUrl ? (
                    <img
                      src={profilePhotoUrl}
                      alt="Profile"
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center text-white text-sm font-semibold">
                      {profileInitial}
                    </div>
                  )}
                  <ChevronDown size={16} className={isDark ? 'text-gray-300' : 'text-gray-600'} />
                </button>

                {userMenuOpen && (
                  <div
                    className={`absolute right-0 mt-2 w-56 rounded-xl border shadow-lg py-2 z-50 ${isDark ? 'bg-dark-900 border-dark-700' : 'bg-white border-gray-200'}`}
                  >
                    <div className="px-4 py-2 border-b border-inherit">
                      <p className="text-sm font-semibold">{user?.name || 'User'}</p>
                      <p className={isDark ? 'text-xs text-gray-400' : 'text-xs text-gray-500'}>{user?.role}</p>
                    </div>
                    <div className="py-2">
                      {userMenuItems.map((item) => (
                        <Link
                          key={item.href}
                          to={item.href}
                          onClick={() => setUserMenuOpen(false)}
                          className={`block px-4 py-2 text-sm transition-colors ${isDark ? 'text-gray-300 hover:bg-dark-800 hover:text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                    <div className="border-t border-inherit">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className={`w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors ${isDark ? 'text-gray-300 hover:bg-dark-800 hover:text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                      >
                        <LogOut size={16} />
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={LogIn}
                  onClick={() => navigate('/login')}
                >
                  Login
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={UserPlus}
                  onClick={() => navigate('/register')}
                >
                  Sign Up
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`md:hidden p-2 rounded-lg transition-colors ${linkStyles}`}
            aria-label="Toggle mobile menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`md:hidden border-t ${isDark ? 'border-dark-700' : 'border-gray-200'}`}
          >
            <div className="px-4 py-4 space-y-2">
              {/* Mobile Nav Links */}
              {(!isAuthenticated ? publicLinks : []).map((link) => {
                const Icon = link.icon;
                return (
                  <motion.div
                    key={link.href}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Link
                      to={link.href}
                      onClick={closeMobileMenu}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${mobileLinkStyles}`}
                    >
                      <Icon size={20} />
                      {link.name}
                    </Link>
                  </motion.div>
                );
              })}

              {/* Mobile Theme Toggle */}
              <button
                onClick={toggleTheme}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${mobileLinkStyles}`}
              >
                {isDark ? <Sun size={20} /> : <Moon size={20} />}
                {isDark ? 'Light Mode' : 'Dark Mode'}
              </button>

              {/* Mobile Auth Actions */}
              {isAuthenticated ? (
                <>
                  <div className="flex items-center gap-3 px-4 py-2">
                    {profilePhotoUrl ? (
                      <img
                        src={profilePhotoUrl}
                        alt="Profile"
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center text-white text-sm font-semibold">
                        {profileInitial}
                      </div>
                    )}
                    <div>
                      <p className={`text-sm font-semibold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                        {user?.name}
                      </p>
                      <p className={isDark ? 'text-xs text-gray-400' : 'text-xs text-gray-500'}>
                        {user?.role}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${mobileLinkStyles}`}
                  >
                    <LogOut size={20} />
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      navigate('/login');
                      closeMobileMenu();
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${mobileLinkStyles}`}
                  >
                    <LogIn size={20} />
                    Login
                  </button>
                  <button
                    onClick={() => {
                      navigate('/register');
                      closeMobileMenu();
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${mobileLinkStyles}`}
                  >
                    <UserPlus size={20} />
                    Sign Up
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
