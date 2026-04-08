// Login page — uses AuthLayout, premium form design

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, LogIn, ArrowRight, CheckCircle } from 'lucide-react';
import { motion as Motion } from 'framer-motion';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Button } from '../../components/common';
import { FormField } from '../../components/common/forms';
import { useAuth } from '../../hooks/useAuth';
import { toastSuccess, toastErrorFromResponse } from '../../utils/notifications';
import { IMAGES } from '../../constants/images';
import { usePageTitle } from '../../hooks/usePageTitle';

const loginSchema = z.object({
  email:    z.string().email('Please enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export function LoginPage() {
  usePageTitle('Log In');
  const { login, error: authError, clearError } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const { email: defaultEmail, message: successMessage } = location.state || {};
  const [serverError, setServerError] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: { email: defaultEmail || '' },
  });

  const onSubmit = async (data) => {
    setServerError('');
    clearError();
    const result = await login(data);
    if (!result.success) { 
      setServerError(result.error || 'Login failed');
      toastErrorFromResponse({ message: result.error || 'Login failed' });
      return; 
    }
    toastSuccess('Login successful! Redirecting...');
    const role = result.user?.role;
    setTimeout(() => {
      if (role === 'ADMIN')  navigate('/admin/dashboard');
      else if (role === 'WORKER') navigate('/worker/dashboard');
      else navigate('/customer/dashboard');
    }, 100);
  };

  return (
    <AuthLayout
      title="Welcome back to ExpertsHub"
      subtitle="Manage your bookings, connect with professionals, or grow your service business — all in one place."
    >
      {/* Form header */}
      <Motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="mb-8"
      >
        <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2 tracking-tight">Sign In</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Enter your credentials to access your account
        </p>
      </Motion.div>

      {/* Success notice */}
      {successMessage && (
        <Motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-success-50 dark:bg-success-500/10 border border-success-200 dark:border-success-500/30 flex items-center gap-3 mb-6"
        >
          <CheckCircle size={16} className="text-success-600 dark:text-success-400 shrink-0" />
          <p className="text-sm font-medium text-success-700 dark:text-success-400">{successMessage}</p>
        </Motion.div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Email */}
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

        {/* Password */}
        <div className="space-y-1">
          <FormField
            name="password"
            label="Password"
            type="password"
            placeholder="Your password"
            icon={Lock}
            required
            error={errors.password?.message}
            {...register('password', { onChange: () => { setServerError(''); clearError(); } })}
          />
          <div className="flex justify-end pr-1">
            <button
              type="button"
              onClick={() => navigate('/forgot-password')}
              className="text-xs font-bold text-brand-600 hover:text-brand-500 dark:text-brand-400 transition-colors uppercase tracking-widest"
            >
              Forgot password?
            </button>
          </div>
        </div>

        {/* Server error */}
        {(serverError || authError) && (
          <Motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl bg-error-50 dark:bg-error-500/10 border border-error-200 dark:border-error-500/30 text-sm font-medium text-error-700 dark:text-error-400"
          >
            {serverError || authError}
          </Motion.div>
        )}

        {/* Submit */}
        <Button
          type="submit"
          fullWidth
          size="lg"
          variant="gradient"
          loading={isSubmitting}
          icon={LogIn}
          iconPosition="right"
          className="h-14 text-base font-bold rounded-2xl shadow-xl shadow-brand-500/20"
        >
          Sign In
        </Button>

        {/* Divider */}
        <div className="relative flex items-center gap-3 py-1">
          <div className="flex-1 h-px bg-neutral-200 dark:bg-dark-700" />
          <span className="text-xs text-neutral-400 font-medium">or</span>
          <div className="flex-1 h-px bg-neutral-200 dark:bg-dark-700" />
        </div>

        {/* Register link */}
        <div className="text-center">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Don&apos;t have an account?{' '}
            <button
              type="button"
              onClick={() => navigate('/register')}
              className="font-bold text-brand-600 hover:text-brand-500 dark:text-brand-400 transition-colors inline-flex items-center gap-1"
            >
              Create one free <ArrowRight size={13} />
            </button>
          </p>
        </div>
      </form>
    </AuthLayout>
  );
}
