// ForgotPasswordPage — upgraded alerts and gradient button

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { Mail, ArrowRight, ArrowLeft, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { motion as Motion } from 'framer-motion';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Button } from '../../components/common';
import { FormField } from '../../components/common/forms';
import { requestPasswordReset } from '../../api/auth';
import { toastSuccess, toastErrorFromResponse } from '../../utils/notifications';
import { usePageTitle } from '../../hooks/usePageTitle';

const schema = z.object({
  email: z.string().email('Please enter a valid email'),
});

export function ForgotPasswordPage() {
  usePageTitle('Forgot Password');
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [resetLink, setResetLink] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data) => {
    setServerError('');
    setSuccessMessage('');
    setResetLink('');
    try {
      const response = await requestPasswordReset(data.email);
      setSuccessMessage(response.message || 'If an account exists with that email, a reset link has been sent.');
      toastSuccess('Password reset link sent! Check your email.');
      if (response.resetLink) setResetLink(response.resetLink);
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to send reset email. Please try again.';
      setServerError(message);
      toastErrorFromResponse(error);
    }
  };

  const openResetLink = () => {
    if (!resetLink) return;

    // Allow internal app paths directly.
    if (resetLink.startsWith('/')) {
      navigate(resetLink);
      return;
    }

    // For absolute URLs, allow only same-origin http(s) links.
    try {
      const url = new URL(resetLink, window.location.origin);
      const isHttp = url.protocol === 'http:' || url.protocol === 'https:';
      if (isHttp && url.origin === window.location.origin) {
        window.location.assign(url.toString());
        return;
      }
    } catch {
      // Fall through to user-facing error.
    }

    setServerError('Invalid reset link. Please request a new one.');
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Don't worry — it happens to the best of us. We'll get you back in securely."
    >
      <Motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="mb-8"
      >
        <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2 tracking-tight">Forgot Password?</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Enter the email linked to your account and we'll send a reset link.
        </p>
      </Motion.div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          name="email"
          label="Email Address"
          type="email"
          placeholder="you@example.com"
          icon={Mail}
          required
          error={errors.email?.message}
          {...register('email')}
        />

        {/* Error */}
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

        {/* Success */}
        {successMessage && (
          <Motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl bg-success-50 dark:bg-success-500/10 border border-success-200 dark:border-success-500/30 flex items-start gap-3 text-sm"
          >
            <CheckCircle size={16} className="text-success-600 dark:text-success-400 shrink-0 mt-0.5" />
            <span className="text-success-700 dark:text-success-400">{successMessage}</span>
          </Motion.div>
        )}

        {/* Dev-only reset link */}
        {import.meta.env.DEV && resetLink && (
          <div className="p-3 rounded-xl bg-neutral-100 dark:bg-dark-800 border border-neutral-200 dark:border-dark-700 text-xs">
            <p className="font-bold text-neutral-600 dark:text-neutral-400 mb-1">Dev: Reset link</p>
            <button
              type="button"
              onClick={openResetLink}
              className="text-brand-500 hover:text-brand-600 font-semibold flex items-center gap-1 uppercase tracking-widest text-[10px]"
            >
              Open reset link <ExternalLink size={11} />
            </button>
          </div>
        )}

        <Button
          type="submit"
          fullWidth
          size="lg"
          variant="gradient"
          loading={isSubmitting}
          icon={ArrowRight}
          iconPosition="right"
          className="h-14 font-bold rounded-2xl shadow-xl shadow-brand-500/20"
        >
          Send Reset Link
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
    </AuthLayout>
  );
}
