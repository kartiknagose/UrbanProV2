// Sidebar navigation for authenticated users

import { NavLink } from 'react-router-dom';
import {
  Home,
  Briefcase,
  Calendar,
  User,
  ShieldCheck,
  Clock,
  Star,
  Lock,
  ChevronLeft,
  ChevronRight,
  Search,
  LayoutDashboard,
  ClipboardList,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';
import { resolveProfilePhotoUrl } from '../../utils/profilePhoto';

const navConfig = {
  CUSTOMER: [
    { label: 'Dashboard', to: '/dashboard', icon: Home },
    { label: 'Browse Services', to: '/services', icon: Briefcase },
    { label: 'My Bookings', to: '/bookings', icon: Calendar },
    { label: 'Reviews', to: '/reviews', icon: Star },
  ],
  WORKER: [
    { label: 'Dashboard', to: '/worker/dashboard', icon: LayoutDashboard },
    { label: 'Browse Services', to: '/services', icon: Search },
    { label: 'My Services', to: '/worker/services', icon: Briefcase },
    { label: 'Bookings', to: '/worker/bookings', icon: ClipboardList },
    { label: 'Availability', to: '/worker/availability', icon: Clock },
    { label: 'Reviews', to: '/worker/reviews', icon: Star },
    { label: 'Verification', to: '/worker/verification', icon: ShieldCheck },
  ],
  ADMIN: [
    { label: 'Dashboard', to: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Services', to: '/admin/services', icon: Briefcase },
    { label: 'Bookings', to: '/admin/bookings', icon: Calendar },
    { label: 'Users', to: '/admin/users', icon: User },
    { label: 'Verification', to: '/admin/verification', icon: ShieldCheck },
  ],
};

export function Sidebar({ isOpen, isCollapsed, onClose, onToggleCollapse }) {
  const { user } = useAuth();
  const { isDark } = useTheme();

  const links = navConfig[user?.role] || [];

  const sidebarStyles = isDark
    ? 'bg-dark-900 border-dark-700 text-gray-200'
    : 'bg-white border-gray-200 text-gray-800';

  const linkBase = isDark
    ? 'text-gray-300 hover:text-white hover:bg-dark-800'
    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100';

  const activeStyles = isDark
    ? 'bg-dark-800 text-white'
    : 'bg-gray-100 text-gray-900';

  const profilePhotoUrl = resolveProfilePhotoUrl(user?.profilePhotoUrl);
  const profileInitial = (user?.name || 'U').slice(0, 1).toUpperCase();

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 border-r transition-all duration-200 lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isCollapsed ? 'w-20' : 'w-64'} ${sidebarStyles}`}
    >
      <div
        className={`relative flex h-16 items-center border-b border-inherit ${isCollapsed ? 'justify-center px-2' : 'justify-between px-4'
          }`}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-accent-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">U</span>
          </div>
          {!isCollapsed && <span className="text-lg font-semibold">UrbanPro</span>}
        </div>
        <div className={`${isCollapsed ? 'absolute right-2' : ''} flex items-center gap-2`}>
          <button
            type="button"
            onClick={onToggleCollapse}
            className={`hidden lg:inline-flex p-1.5 rounded-md transition-colors ${isDark ? 'text-gray-300 hover:bg-dark-800' : 'text-gray-600 hover:bg-gray-100'
              }`}
            aria-label="Toggle sidebar"
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className={`lg:hidden px-3 py-1 text-sm font-medium rounded-md transition-colors ${isDark ? 'text-gray-400 hover:text-gray-200 hover:bg-dark-800' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
          >
            Close
          </button>
        </div>
      </div>

      <div className={`py-6 ${isCollapsed ? 'px-2' : 'px-4'}`}>
        <div className={`mb-6 flex ${isCollapsed ? 'flex-col items-center gap-2' : 'items-center gap-3'}`}>
          {profilePhotoUrl ? (
            <img
              src={profilePhotoUrl}
              alt="Profile"
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center text-white text-sm font-semibold">
              {profileInitial}
            </div>
          )}
          {!isCollapsed && (
            <div>
              <p className={isDark ? 'text-xs text-gray-400' : 'text-xs text-gray-500'}>Signed in as</p>
              <p className="font-semibold">{user?.name || 'User'}</p>
              <p className={isDark ? 'text-xs text-gray-400' : 'text-xs text-gray-500'}>{user?.role}</p>
            </div>
          )}
        </div>

        <nav className="space-y-1">
          {links.map((item) => {
            const Icon = item.icon;
            const isDisabled = item.disabled;
            if (isDisabled) {
              return (
                <div
                  key={item.to}
                  title="Coming soon"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm opacity-60 cursor-not-allowed ${isCollapsed ? 'justify-center' : ''
                    } ${linkBase}`}
                >
                  <Icon size={18} />
                  {!isCollapsed && (
                    <>
                      <span>{item.label}</span>
                      <span className="ml-auto flex items-center gap-1 text-xs">
                        <Lock size={12} />
                        Soon
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
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isCollapsed ? 'justify-center' : ''
                  } ${isActive ? activeStyles : linkBase}`
                }
                onClick={onClose}
              >
                <Icon size={18} />
                {!isCollapsed && item.label}
              </NavLink>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
