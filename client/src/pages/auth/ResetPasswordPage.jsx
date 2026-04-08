// ResetPasswordPage — premium alerts, gradient button, strength hints

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Save, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { motion as Motion } from 'framer-motion';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Button } from '../../components/common';
import { FormField } from '../../components/common/forms';
import { resetPassword } from '../../api/auth';
import { toastSuccess, toastErrorFromResponse } from '../../utils/notifications';
import { usePageTitle } from '../../hooks/usePageTitle';

const schema = z.object({
  password:        z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export function ResetPasswordPage() {
  usePageTitle('Reset Password');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [serverError, setServerError] = useState('');
  const [success, setSuccess] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  const onSubmit = async (data) => {
    setServerError('');
    if (!token) {
      setServerError('Reset token is missing. Please use the link from your email.');
      toastErrorFromResponse({ message: 'Reset token is missing' });
      return;
    }
    try {
      await resetPassword({ token, password: data.password });
      toastSuccess('Password reset successfully! You can now log in.');
      setSuccess(true);
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to reset password. The link may have expired.';
      setServerError(message);
      toastErrorFromResponse(error);
    }
  };

  return (
    <AuthLayout
      title="Set your new password"
      subtitle="Choose a strong, unique password to keep your account secure."
    >
      <Motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8"
      >
        <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2 tracking-tight">
          {success ? 'Password Updated!' : 'Reset Password'}
        </h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {success ? 'Your password has been changed successfully.' : 'Create a new strong password for your account.'}
        </p>
      </Motion.div>

      {success ? (
        <Motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-20 h-20 bg-gradient-to-br from-success-100 to-success-200 dark:from-success-500/20 dark:to-success-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-success-200 dark:border-success-500/30">
            <CheckCircle size={36} className="text-success-600 dark:text-success-400" />
          </div>
          <p className="text-neutral-500 dark:text-neutral-400 mb-8 leading-relaxed">
            You can now sign in with your new password.
          </p>
          <Button fullWidth variant="gradient" size="lg" className="h-14 font-bold rounded-2xl" onClick={() => navigate('/login')}>
            Sign In Now
          </Button>
        </Motion.div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            name="password"
            label="New Password"
            type="password"
            placeholder="Create a strong password"
            icon={Lock}
            required
            error={errors.password?.message}
            hint="At least 8 characters with letters and numbers"
            {...register('password')}
          />
          <FormField
            name="confirmPassword"
            label="Confirm Password"
            type="password"
            placeholder="Confirm your new password"
            icon={Lock}
            required
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />

          {serverError && (
            <Motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-2xl bg-error-50 dark:bg-error-500/10 border border-error-200 dark:border-error-500/30 flex items-center gap-3 text-sm font-medium text-error-700 dark:text-error-400"
            >
              <AlertCircle size={16} className="shrink-0" />
              {serverError}
            </Motion.div>
          )}

          <Button
            type="submit"
            fullWidth
            size="lg"
            variant="gradient"
            loading={isSubmitting}
            icon={Save}
            iconPosition="right"
            className="h-14 font-bold rounded-2xl shadow-xl shadow-brand-500/20"
          >
            Update Password
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
            >
              <ArrowLeft size={14} />
              Back to Login
            </button>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}
