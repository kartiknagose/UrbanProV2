import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { PublicRoute, WorkerRoute, CustomerRoute, AdminRoute } from './ProtectedRoute';
import { LoadingOverlay } from '../components/common';

// Lazy load all pages for better performance (Code Splitting)
const LandingPage = lazy(() => import('../pages/public/LandingPage').then(m => ({ default: m.LandingPage })));
const SystemStatusPage = lazy(() => import('../pages/public/SystemStatusPage').then(m => ({ default: m.SystemStatusPage })));
const NotFoundPage = lazy(() => import('../pages/public/NotFoundPage').then(m => ({ default: m.NotFoundPage })));

// Auth
const LoginPage = lazy(() => import('../pages/auth/LoginPage').then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('../pages/auth/RegisterPage').then(m => ({ default: m.RegisterPage })));
const VerifyEmailPage = lazy(() => import('../pages/auth/VerifyEmailPage').then(m => ({ default: m.VerifyEmailPage })));
const ForgotPasswordPage = lazy(() => import('../pages/auth/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('../pages/auth/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })));

// Public / Legal
const ServicesPage = lazy(() => import('../pages/services/ServicesPage').then(m => ({ default: m.ServicesPage })));
const ServiceDetailPage = lazy(() => import('../pages/services/ServiceDetailPage').then(m => ({ default: m.ServiceDetailPage })));
const AboutPage = lazy(() => import('../pages/public/AboutPage').then(m => ({ default: m.AboutPage })));
const ContactPage = lazy(() => import('../pages/public/ContactPage').then(m => ({ default: m.ContactPage })));
const HowItWorksPage = lazy(() => import('../pages/public/HowItWorksPage').then(m => ({ default: m.HowItWorksPage })));
const PricingPage = lazy(() => import('../pages/public/PricingPage').then(m => ({ default: m.PricingPage })));
const SecurityPage = lazy(() => import('../pages/public/SecurityPage').then(m => ({ default: m.SecurityPage })));
const FaqPage = lazy(() => import('../pages/public/FaqPage').then(m => ({ default: m.FaqPage })));
const BlogPage = lazy(() => import('../pages/public/BlogPage').then(m => ({ default: m.BlogPage })));
const CareersPage = lazy(() => import('../pages/public/CareersPage').then(m => ({ default: m.CareersPage })));
const PrivacyPage = lazy(() => import('../pages/legal/PrivacyPage').then(m => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import('../pages/legal/TermsPage').then(m => ({ default: m.TermsPage })));
const CookiesPage = lazy(() => import('../pages/legal/CookiesPage').then(m => ({ default: m.CookiesPage })));

// Customer
const CustomerProfilePage = lazy(() => import('../pages/profile/CustomerProfilePage').then(m => ({ default: m.CustomerProfilePage })));
const CustomerDashboardPage = lazy(() => import('../pages/customer/CustomerDashboardPage').then(m => ({ default: m.CustomerDashboardPage })));
const CustomerBookingsPage = lazy(() => import('../pages/customer/CustomerBookingsPage').then(m => ({ default: m.CustomerBookingsPage })));
const CustomerBookingDetailPage = lazy(() => import('../pages/customer/CustomerBookingDetailPage').then(m => ({ default: m.CustomerBookingDetailPage })));
const CustomerReviewsPage = lazy(() => import('../pages/customer/CustomerReviewsPage').then(m => ({ default: m.CustomerReviewsPage })));

// Worker
const WorkerProfilePage = lazy(() => import('../pages/profile/WorkerProfilePage').then(m => ({ default: m.WorkerProfilePage })));
const WorkerDashboardPage = lazy(() => import('../pages/worker/WorkerDashboardPage').then(m => ({ default: m.WorkerDashboardPage })));
const WorkerServicesPage = lazy(() => import('../pages/worker/WorkerServicesPage').then(m => ({ default: m.WorkerServicesPage })));
const WorkerBookingsPage = lazy(() => import('../pages/worker/WorkerBookingsPage').then(m => ({ default: m.WorkerBookingsPage })));
const WorkerBookingDetailPage = lazy(() => import('../pages/worker/WorkerBookingDetailPage').then(m => ({ default: m.WorkerBookingDetailPage })));
const WorkerAvailabilityPage = lazy(() => import('../pages/worker/WorkerAvailabilityPage').then(m => ({ default: m.WorkerAvailabilityPage })));
const WorkerVerificationPage = lazy(() => import('../pages/worker/WorkerVerificationPage').then(m => ({ default: m.WorkerVerificationPage })));
const WorkerReviewsPage = lazy(() => import('../pages/worker/WorkerReviewsPage').then(m => ({ default: m.WorkerReviewsPage })));

// Admin
const AdminDashboardPage = lazy(() => import('../pages/admin/AdminDashboardPage').then(m => ({ default: m.AdminDashboardPage })));
const AdminServicesPage = lazy(() => import('../pages/admin/AdminServicesPage').then(m => ({ default: m.AdminServicesPage })));
const AdminWorkersPage = lazy(() => import('../pages/admin/AdminWorkersPage').then(m => ({ default: m.AdminWorkersPage })));
const AdminBookingsPage = lazy(() => import('../pages/admin/AdminBookingsPage').then(m => ({ default: m.AdminBookingsPage })));
const AdminUsersPage = lazy(() => import('../pages/admin/AdminUsersPage').then(m => ({ default: m.AdminUsersPage })));
const AdminVerificationPage = lazy(() => import('../pages/admin/AdminVerificationPage').then(m => ({ default: m.AdminVerificationPage })));

/**
 * AppRoutes Component
 * 
 * Central routing configuration for the entire application
 * Organized by access level: Public, Customer, Worker, Admin
 */
export function AppRoutes() {
  return (
    <Suspense fallback={<LoadingOverlay />}>
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
        <Route path="/profile" element={<CustomerRoute><CustomerProfilePage /></CustomerRoute>} />
        <Route path="/profile/setup" element={<Navigate to="/profile" replace />} />
        <Route path="/bookings" element={<CustomerRoute><CustomerBookingsPage /></CustomerRoute>} />
        <Route path="/bookings/:id" element={<CustomerRoute><CustomerBookingDetailPage /></CustomerRoute>} />
        <Route path="/reviews" element={<CustomerRoute><CustomerReviewsPage /></CustomerRoute>} />
        <Route path="/dashboard" element={<CustomerRoute><CustomerDashboardPage /></CustomerRoute>} />

        {/* Worker Routes */}
        <Route path="/worker/profile" element={<WorkerRoute><WorkerProfilePage /></WorkerRoute>} />
        <Route path="/worker/profile/setup" element={<Navigate to="/worker/profile" replace />} />
        <Route path="/worker/setup-profile" element={<Navigate to="/worker/profile" replace />} />
        <Route path="/worker/dashboard" element={<WorkerRoute><WorkerDashboardPage /></WorkerRoute>} />
        <Route path="/worker/services" element={<WorkerRoute><WorkerServicesPage /></WorkerRoute>} />
        <Route path="/worker/bookings" element={<WorkerRoute><WorkerBookingsPage /></WorkerRoute>} />
        <Route path="/worker/bookings/:id" element={<WorkerRoute><WorkerBookingDetailPage /></WorkerRoute>} />
        <Route path="/worker/availability" element={<WorkerRoute><WorkerAvailabilityPage /></WorkerRoute>} />
        <Route path="/worker/verification" element={<WorkerRoute><WorkerVerificationPage /></WorkerRoute>} />
        <Route path="/worker/reviews" element={<WorkerRoute><WorkerReviewsPage /></WorkerRoute>} />

        {/* Admin Routes */}
        <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
        <Route path="/admin/services" element={<AdminRoute><AdminServicesPage /></AdminRoute>} />
        <Route path="/admin/bookings" element={<AdminRoute><AdminBookingsPage /></AdminRoute>} />
        <Route path="/admin/users" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
        <Route path="/admin/verification" element={<AdminRoute><AdminVerificationPage /></AdminRoute>} />

        {/* 404 - Wildcard */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

