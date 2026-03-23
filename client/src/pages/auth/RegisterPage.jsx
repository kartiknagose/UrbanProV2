// RegisterPage — refactored to use AuthLayout, premium role switcher

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, User, Briefcase, ArrowRight, Phone, CheckCircle } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Button } from '../../components/common';
import { FormField } from '../../components/common/forms';
import { useAuth } from '../../hooks/useAuth';
import { toastSuccess, toastErrorFromResponse } from '../../utils/notifications';
import { usePageTitle } from '../../hooks/usePageTitle';

const registerSchema = z.object({
  name:            z.string().min(2, 'Name must be at least 2 characters'),
  email:           z.string().email('Please enter a valid email'),
  mobile:          z.string().min(10, 'Mobile must be at least 10 digits').regex(/^[0-9]+$/, 'Must be only digits'),
  password:        z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(8, 'Please confirm your password'),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export function RegisterPage() {
  usePageTitle('Sign Up');
  const { register: registerUser, registerAsWorker, error: authError, clearError } = useAuth();
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const initialRole = new URLSearchParams(routerLocation.search).get('role') === 'worker' ? 'WORKER' : 'CUSTOMER';
  const [role, setRole] = useState(initialRole);
  const [serverError, setServerError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data) => {
    setServerError('');
    clearError();
    setSubmittedEmail(data.email);
    const userData = { name: data.name, email: data.email, mobile: data.mobile, password: data.password, role };
    const result = role === 'WORKER' ? await registerAsWorker(userData) : await registerUser(userData);
    if (!result.success) {
      setServerError(result.error || 'Registration failed. Please try again.');
      toastErrorFromResponse({ message: result.error || 'Registration failed' });
      return;
    }
    toastSuccess('Account created! Check your email to verify.');
    setIsSuccess(true);
  };

  const handleRoleChange = (newRole) => {
    setRole(newRole);
    setServerError('');
    clearError();
  };

  const roleTitle = role === 'WORKER'
    ? 'Join as a Professional'
    : 'Join as a Customer';

  const roleSubtitle = role === 'WORKER'
    ? 'Expand your business and find clients on India\'s top services platform.'
    : 'Get access to top-rated home service professionals near you.';

  return (
    <AuthLayout title={roleTitle} subtitle={roleSubtitle}>

      {/* Success Screen */}
      <AnimatePresence mode="wait">
        {isSuccess ? (
          <Motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="w-20 h-20 bg-gradient-to-br from-success-100 to-success-200 dark:from-success-500/20 dark:to-success-600/20 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-success-200 dark:border-success-500/30">
              <Mail size={36} className="text-success-600 dark:text-success-400" />
            </div>
            <h2 className="text-3xl font-bold mb-3 text-neutral-900 dark:text-white">Check your inbox!</h2>
            <p className="text-neutral-500 dark:text-neutral-400 mb-8 leading-relaxed">
              We&apos;ve sent a verification link to <span className="font-bold text-neutral-700 dark:text-neutral-200">{submittedEmail}</span>.
              Please click the link to verify and activate your account.
            </p>
            <div className="p-4 rounded-2xl bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/30 text-sm text-brand-700 dark:text-brand-300 mb-8">
              <strong>Tip:</strong> If you don&apos;t see the email, check your spam folder.
            </div>
            <Button fullWidth variant="gradient" size="lg" className="h-14 font-bold rounded-2xl" onClick={() => navigate('/login')}>
              Go to Login
            </Button>
          </Motion.div>
        ) : (
          <Motion.div key="form" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            {/* Header */}
            <div className="mb-7">
              <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-1.5 tracking-tight">Create Account</h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Sign up for free — no card required</p>
            </div>

            {/* Role Switcher */}
            <div className="flex bg-neutral-100 dark:bg-dark-800 p-1 rounded-xl mb-7 border border-neutral-200 dark:border-dark-700">
              {[
                { id: 'CUSTOMER', label: 'Customer', icon: User },
                { id: 'WORKER',   label: 'Professional', icon: Briefcase },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleRoleChange(id)}
                  className={[
                    'relative flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200',
                    role === id
                      ? 'bg-white dark:bg-dark-700 text-brand-600 dark:text-brand-400 shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200',
                  ].join(' ')}
                >
                  {role === id && (
                    <Motion.span
                      layoutId="role-indicator"
                      className="absolute inset-0 bg-white dark:bg-dark-700 rounded-lg shadow-sm -z-10"
                    />
                  )}
                  <Icon size={15} />
                  {label}
                </button>
              ))}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                name="name"
                label="Full Name"
                placeholder="John Doe"
                icon={User}
                required
                error={errors.name?.message}
                {...register('name')}
              />
              <FormField
                name="email"
                label="Email Address"
                type="email"
                placeholder="you@example.com"
                icon={Mail}
                required
                error={errors.email?.message}
                {...register('email', { onChange: () => { setServerError(''); clearError(); } })}
              />
              <FormField
                name="mobile"
                label="Mobile Number"
                type="tel"
                placeholder="9876543210"
                icon={Phone}
                required
                error={errors.mobile?.message}
                hint="10-digit mobile number without country code"
                {...register('mobile')}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  name="password"
                  label="Password"
                  type="password"
                  placeholder="Min 8 chars"
                  icon={Lock}
                  required
                  error={errors.password?.message}
                  {...register('password')}
                />
                <FormField
                  name="confirmPassword"
                  label="Confirm Password"
                  type="password"
                  placeholder="Repeat password"
                  icon={Lock}
                  required
                  error={errors.confirmPassword?.message}
                  {...register('confirmPassword')}
                />
              </div>

              {/* Server error */}
              <AnimatePresence>
                {(serverError || authError) && (
                  <Motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="p-4 rounded-2xl bg-error-50 dark:bg-error-500/10 border border-error-200 dark:border-error-500/30 text-sm font-medium text-error-700 dark:text-error-400"
                  >
                    {serverError || authError}
                  </Motion.div>
                )}
              </AnimatePresence>

              <Button
                type="submit"
                fullWidth
                size="lg"
                variant="gradient"
                loading={isSubmitting}
                className="h-14 text-base font-bold mt-2 rounded-2xl shadow-xl shadow-brand-500/20"
              >
                {role === 'WORKER' ? 'Join as Professional' : 'Create Free Account'}
              </Button>

              <div className="text-center border-t pt-5 border-neutral-200 dark:border-dark-700">
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="font-bold text-brand-600 hover:text-brand-500 dark:text-brand-400 inline-flex items-center gap-1 transition-colors"
                  >
                    Sign in <ArrowRight size={13} />
                  </button>
                </p>
              </div>

              {/* Benefits checklist */}
              <div className="pt-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-3">
                  What you get:
                </p>
                <div className="space-y-1.5">
                  {(role === 'WORKER'
                    ? ['Set your own rates & schedule', 'Get paid securely & on time', 'Build your reputation & reviews']
                    : ['100% verified professionals', 'Transparent pricing upfront', 'Secure escrow payments']
                  ).map((item) => (
                    <div key={item} className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                      <CheckCircle size={12} className="text-success-500 shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </form>
          </Motion.div>
        )}
      </AnimatePresence>
    </AuthLayout>
  );
}
