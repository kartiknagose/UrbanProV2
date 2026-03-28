// AppRoutes — centralized routing configuration with lazy loading
// HMR Refresh Trigger - Standard Imports Reinstated
import { lazy, Suspense, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { PublicRoute, WorkerRoute, CustomerRoute, AdminRoute, ProtectedRoute } from './ProtectedRoute';
import { LoadingOverlay } from '../components/common';
import { useAuth } from '../hooks/useAuth';

// Lazy load all pages for better performance (Code Splitting)
const LandingPage = lazy(() => import('../pages/public/LandingPage.jsx').then(m => ({ default: m.LandingPage })));
const SystemStatusPage = lazy(() => import('../pages/public/SystemStatusPage.jsx').then(m => ({ default: m.SystemStatusPage })));
const NotFoundPage = lazy(() => import('../pages/public/NotFoundPage.jsx').then(m => ({ default: m.NotFoundPage })));

// Auth
const LoginPage = lazy(() => import('../pages/auth/LoginPage.jsx').then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('../pages/auth/RegisterPage.jsx').then(m => ({ default: m.RegisterPage })));
const VerifyEmailPage = lazy(() => import('../pages/auth/VerifyEmailPage.jsx').then(m => ({ default: m.VerifyEmailPage })));
const ForgotPasswordPage = lazy(() => import('../pages/auth/ForgotPasswordPage.jsx').then(m => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('../pages/auth/ResetPasswordPage.jsx').then(m => ({ default: m.ResetPasswordPage })));

// Public / Legal
const ServicesPage = lazy(() => import('../pages/services/ServicesPage.jsx').then(m => ({ default: m.ServicesPage })));
const ServiceDetailPage = lazy(() => import('../pages/services/ServiceDetailPage.jsx').then(m => ({ default: m.ServiceDetailPage })));
const AboutPage = lazy(() => import('../pages/public/AboutPage.jsx').then(m => ({ default: m.AboutPage })));
const ContactPage = lazy(() => import('../pages/public/ContactPage.jsx').then(m => ({ default: m.ContactPage })));
const HowItWorksPage = lazy(() => import('../pages/public/HowItWorksPage.jsx').then(m => ({ default: m.HowItWorksPage })));
const PricingPage = lazy(() => import('../pages/public/PricingPage.jsx').then(m => ({ default: m.PricingPage })));
const SecurityPage = lazy(() => import('../pages/public/SecurityPage.jsx').then(m => ({ default: m.SecurityPage })));
const FaqPage = lazy(() => import('../pages/public/FaqPage.jsx').then(m => ({ default: m.FaqPage })));
const BlogPage = lazy(() => import('../pages/public/BlogPage.jsx').then(m => ({ default: m.BlogPage })));
const CareersPage = lazy(() => import('../pages/public/CareersPage.jsx').then(m => ({ default: m.CareersPage })));
const PrivacyPage = lazy(() => import('../pages/legal/PrivacyPage.jsx').then(m => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import('../pages/legal/TermsPage.jsx').then(m => ({ default: m.TermsPage })));
const CookiesPage = lazy(() => import('../pages/legal/CookiesPage.jsx').then(m => ({ default: m.CookiesPage })));

// Customer
const CustomerProfilePage = lazy(() => import('../pages/profile/CustomerProfilePage.jsx').then(m => ({ default: m.CustomerProfilePage })));
const CustomerDashboardPage = lazy(() => import('../pages/customer/CustomerDashboardPage.jsx').then(m => ({ default: m.CustomerDashboardPage })));
const CustomerWalletPage = lazy(() => import('../pages/customer/CustomerWalletPage.jsx').then(m => ({ default: m.CustomerWalletPage })));
const CustomerReferralsPage = lazy(() => import('../pages/customer/CustomerReferralsPage.jsx').then(m => ({ default: m.CustomerReferralsPage })));
const CustomerBookingsPage = lazy(() => import('../pages/customer/CustomerBookingsPage.jsx').then(m => ({ default: m.CustomerBookingsPage })));
const CustomerBookingDetailPage = lazy(() => import('../pages/customer/CustomerBookingDetailPage.jsx').then(m => ({ default: m.CustomerBookingDetailPage })));
const CustomerReviewsPage = lazy(() => import('../pages/customer/CustomerReviewsPage.jsx').then(m => ({ default: m.CustomerReviewsPage })));
const CustomerFavoritesPage = lazy(() => import('../pages/customer/CustomerFavoritesPage.jsx').then(m => ({ default: m.CustomerFavoritesPage })));
const CustomerLoyaltyPage = lazy(() => import('../pages/customer/CustomerLoyaltyPage.jsx').then(m => ({ default: m.CustomerLoyaltyPage })));
const CustomerProPlusPage = lazy(() => import('../pages/customer/CustomerProPlusPage.jsx').then(m => ({ default: m.CustomerProPlusPage })));
const BookingWizardPage = lazy(() => import('../pages/customer/BookingWizardPage.jsx').then(m => ({ default: m.BookingWizardPage })));
const MessagesPage = lazy(() => import('../pages/profile/MessagesPage.jsx').then(m => ({ default: m.MessagesPage })));
const NotificationPreferencesPage = lazy(() => import('../pages/profile/NotificationPreferencesPage.jsx').then(m => ({ default: m.NotificationPreferencesPage })));

// Worker
const WorkerProfilePage = lazy(() => import('../pages/profile/WorkerProfilePage.jsx').then(m => ({ default: m.WorkerProfilePage })));
const WorkerDashboardPage = lazy(() => import('../pages/worker/WorkerDashboardPage.jsx').then(m => ({ default: m.WorkerDashboardPage }))); 
const WorkerServicesPage = lazy(() => import('../pages/worker/WorkerServicesPage.jsx').then(m => ({ default: m.WorkerServicesPage })));
const WorkerBookingsPage = lazy(() => import('../pages/worker/WorkerBookingsPage.jsx').then(m => ({ default: m.WorkerBookingsPage })));
const WorkerBookingDetailPage = lazy(() => import('../pages/worker/WorkerBookingDetailPage.jsx').then(m => ({ default: m.WorkerBookingDetailPage })));
const WorkerAvailabilityPage = lazy(() => import('../pages/worker/WorkerAvailabilityPage.jsx').then(m => ({ default: m.WorkerAvailabilityPage })));
const WorkerVerificationPage = lazy(() => import('../pages/worker/WorkerVerificationPage.jsx').then(m => ({ default: m.WorkerVerificationPage })));
const WorkerReviewsPage = lazy(() => import('../pages/worker/WorkerReviewsPage.jsx').then(m => ({ default: m.WorkerReviewsPage })));
const WorkerEarningsPage = lazy(() => import('../pages/worker/WorkerEarningsPage.jsx').then(m => ({ default: m.WorkerEarningsPage })));

// Safety
const EmergencyContactsPage = lazy(() => import('../pages/safety/EmergencyContactsPage.jsx').then(m => ({ default: m.EmergencyContactsPage })));

// Admin
const AdminDashboardPage = lazy(() => import('../pages/admin/AdminDashboardPage.jsx').then(m => ({ default: m.AdminDashboardPage })));
const AdminServicesPage = lazy(() => import('../pages/admin/AdminServicesPage.jsx').then(m => ({ default: m.AdminServicesPage })));
const AdminWorkersPage = lazy(() => import('../pages/admin/AdminWorkersPage.jsx').then(m => ({ default: m.AdminWorkersPage })));
const AdminBookingsPage = lazy(() => import('../pages/admin/AdminBookingsPage.jsx').then(m => ({ default: m.AdminBookingsPage })));
const AdminUsersPage = lazy(() => import('../pages/admin/AdminUsersPage.jsx').then(m => ({ default: m.AdminUsersPage })));
const AdminVerificationPage = lazy(() => import('../pages/admin/AdminVerificationPage.jsx').then(m => ({ default: m.AdminVerificationPage })));
const AdminSOSAlertsPage = lazy(() => import('../pages/admin/AdminSOSAlertsPage.jsx').then(m => ({ default: m.AdminSOSAlertsPage })));
const AdminAnalyticsPage = lazy(() => import('../pages/admin/AdminAnalyticsPage.jsx').then(m => ({ default: m.AdminAnalyticsPage })));
const AdminFraudPage = lazy(() => import('../pages/admin/AdminFraudPage.jsx').then(m => ({ default: m.AdminFraudPage })));
const AdminCouponsPage = lazy(() => import('../pages/admin/AdminCouponsPage.jsx').then(m => ({ default: m.AdminCouponsPage })));
const AdminAIAuditPage = lazy(() => import('../pages/admin/AdminAIAuditPage.jsx').then(m => ({ default: m.AdminAIAuditPage })));

function RoutePrefetcher() {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const prefetched = useRef(new Set());

  useEffect(() => {
    let timeoutId;
    let idleId;

    const run = () => {
      const jobs = [];

      if (!isAuthenticated && !prefetched.current.has('public-core')) {
        jobs.push(import('../pages/auth/LoginPage.jsx'));
        jobs.push(import('../pages/auth/RegisterPage.jsx'));
        jobs.push(import('../pages/services/ServicesPage.jsx'));
        prefetched.current.add('public-core');
      }

      if (isAuthenticated && user?.role === 'CUSTOMER' && !prefetched.current.has('customer-core')) {
        jobs.push(import('../pages/customer/CustomerDashboardPage.jsx'));
        jobs.push(import('../pages/customer/CustomerBookingsPage.jsx'));
        jobs.push(import('../pages/profile/MessagesPage.jsx'));
        prefetched.current.add('customer-core');
      }

      if (isAuthenticated && user?.role === 'WORKER' && !prefetched.current.has('worker-core')) {
        jobs.push(import('../pages/worker/WorkerDashboardPage.jsx'));
        jobs.push(import('../pages/worker/WorkerBookingsPage.jsx'));
        jobs.push(import('../pages/profile/MessagesPage.jsx'));
        prefetched.current.add('worker-core');
      }

      if (isAuthenticated && user?.role === 'ADMIN' && !prefetched.current.has('admin-core')) {
        jobs.push(import('../pages/admin/AdminDashboardPage.jsx'));
        jobs.push(import('../pages/admin/AdminBookingsPage.jsx'));
        jobs.push(import('../pages/admin/AdminUsersPage.jsx'));
        jobs.push(import('../pages/admin/AdminAIAuditPage.jsx'));
        prefetched.current.add('admin-core');
      }

      if (jobs.length > 0) {
        void Promise.allSettled(jobs);
      }
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(run, { timeout: 1500 });
    } else {
      timeoutId = setTimeout(run, 250);
    }

    return () => {
      if (idleId && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isAuthenticated, user?.role, location.pathname]);

  return null;
}

/**
 * AppRoutes Component
 * 
 * Central routing configuration for the entire application
 * Organized by access level: Public, Customer, Worker, Admin
 */
export function AppRoutes() {
  return (
    <Suspense fallback={<LoadingOverlay />}>
      <RoutePrefetcher />
      <Routes>
        {/* ===== PUBLIC ROUTES (No authentication required) ===== */}
        <Route path="/" element={<PublicRoute><LandingPage /></PublicRoute>} />

        {/* Auth Routes - Redirect to dashboard if already logged in */}
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
        <Route path="/reset-password" element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />

        <Route path="/register-worker" element={<Navigate to="/register?role=worker" replace />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/services/:id" element={<ServiceDetailPage />} />
        <Route path="/system-status" element={<SystemStatusPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/security" element={<SecurityPage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/cookies" element={<CookiesPage />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/careers" element={<CareersPage />} />

        {/* Customer Routes */}
        <Route path="/customer/profile" element={<CustomerRoute><CustomerProfilePage /></CustomerRoute>} />
        <Route path="/customer/dashboard" element={<CustomerRoute><CustomerDashboardPage /></CustomerRoute>} />
        <Route path="/customer/wallet" element={<CustomerRoute><CustomerWalletPage /></CustomerRoute>} />
        <Route path="/customer/referrals" element={<CustomerRoute><CustomerReferralsPage /></CustomerRoute>} />
        <Route path="/customer/bookings" element={<CustomerRoute><CustomerBookingsPage /></CustomerRoute>} />
        <Route path="/customer/bookings/wizard" element={<CustomerRoute><BookingWizardPage /></CustomerRoute>} />
        <Route path="/customer/bookings/:id" element={<CustomerRoute><CustomerBookingDetailPage /></CustomerRoute>} />
        <Route path="/customer/reviews" element={<CustomerRoute><CustomerReviewsPage /></CustomerRoute>} />
        <Route path="/customer/favorites" element={<CustomerRoute><CustomerFavoritesPage /></CustomerRoute>} />
        <Route path="/customer/loyalty" element={<CustomerRoute><CustomerLoyaltyPage /></CustomerRoute>} />
        <Route path="/customer/proplus" element={<CustomerRoute><CustomerProPlusPage /></CustomerRoute>} />
        <Route path="/customer/safety/contacts" element={<CustomerRoute><EmergencyContactsPage /></CustomerRoute>} />
        <Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
        <Route path="/notifications/preferences" element={<ProtectedRoute><NotificationPreferencesPage /></ProtectedRoute>} />

        {/* Worker Routes */}
        <Route path="/worker/dashboard" element={<WorkerRoute><WorkerDashboardPage /></WorkerRoute>} />
        <Route path="/worker/verification" element={<WorkerRoute><WorkerVerificationPage /></WorkerRoute>} />
        <Route path="/worker/onboarding" element={<WorkerRoute><Navigate to="/worker/verification" replace /></WorkerRoute>} />
        <Route path="/worker/profile/setup" element={<WorkerRoute><Navigate to="/worker/verification" replace /></WorkerRoute>} />
        <Route path="/worker/profile" element={<WorkerRoute><WorkerProfilePage /></WorkerRoute>} />
        <Route path="/worker/services" element={<WorkerRoute><WorkerServicesPage /></WorkerRoute>} />
        <Route path="/worker/bookings" element={<WorkerRoute><WorkerBookingsPage /></WorkerRoute>} />
        <Route path="/worker/bookings/:id" element={<WorkerRoute><WorkerBookingDetailPage /></WorkerRoute>} />
        <Route path="/worker/availability" element={<WorkerRoute><WorkerAvailabilityPage /></WorkerRoute>} />
        <Route path="/worker/reviews" element={<WorkerRoute><WorkerReviewsPage /></WorkerRoute>} />
        <Route path="/worker/earnings" element={<WorkerRoute><WorkerEarningsPage /></WorkerRoute>} />
        <Route path="/worker/safety/contacts" element={<WorkerRoute><EmergencyContactsPage /></WorkerRoute>} />

        {/* Admin Routes */}
        <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
        <Route path="/admin/services" element={<AdminRoute><AdminServicesPage /></AdminRoute>} />
        <Route path="/admin/bookings" element={<AdminRoute><AdminBookingsPage /></AdminRoute>} />
        <Route path="/admin/users" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
        <Route path="/admin/workers" element={<AdminRoute><AdminWorkersPage /></AdminRoute>} />
        <Route path="/admin/verification" element={<AdminRoute><AdminVerificationPage /></AdminRoute>} />
        <Route path="/admin/sos-alerts" element={<AdminRoute><AdminSOSAlertsPage /></AdminRoute>} />
        <Route path="/admin/analytics" element={<AdminRoute><AdminAnalyticsPage /></AdminRoute>} />
        <Route path="/admin/fraud" element={<AdminRoute><AdminFraudPage /></AdminRoute>} />
        <Route path="/admin/coupons" element={<AdminRoute><AdminCouponsPage /></AdminRoute>} />
        <Route path="/admin/ai-audit" element={<AdminRoute><AdminAIAuditPage /></AdminRoute>} />

        {/* 404 - Wildcard */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

