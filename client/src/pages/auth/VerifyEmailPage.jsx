// VerifyEmailPage — premium loading states, gradient icon, countdown

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, ArrowRight } from 'lucide-react';
import { motion as Motion } from 'framer-motion';
import { verifyEmail } from '../../api/auth';
import { MainLayout } from '../../components/layout/MainLayout';
import { Button } from '../../components/common';
import { toastSuccess, toastErrorFromResponse } from '../../utils/notifications';
import { usePageTitle } from '../../hooks/usePageTitle';

export function VerifyEmailPage() {
  usePageTitle('Verify Email');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState(token ? 'loading' : 'error');
  const [message, setMessage] = useState(token ? 'Verifying your email address…' : 'Verification token is missing.');
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [redirectCount, setRedirectCount] = useState(5);
  const hasVerifiedRef = useRef(false);

  useEffect(() => {
    let timer;
    if (status === 'success' && redirectCount > 0) {
      timer = setInterval(() => setRedirectCount((c) => c - 1), 1000);
    } else if (status === 'success' && redirectCount === 0) {
      navigate('/login', { state: { email: verifiedEmail, message }, replace: true });
    }
    return () => clearInterval(timer);
  }, [status, redirectCount, navigate, verifiedEmail, message]);

  useEffect(() => {
    if (!token || hasVerifiedRef.current) return;
    hasVerifiedRef.current = true;
    const verify = async () => {
      try {
        const data = await verifyEmail(token);
        let successMsg = 'Email verified successfully! You can now log in.';
        if (data.role === 'WORKER' && !data.hasWorkerProfile) {
          successMsg = 'Email verified! Please login to complete your professional profile.';
        } else if (!data.hasAddress) {
          successMsg = 'Email verified! Please login to add your address.';
        }
        toastSuccess('Email verified successfully! ✓');
        setStatus('success');
        setMessage(successMsg);
        setVerifiedEmail(data.email || '');
      } catch (error) {
        if (error.response?.data?.message?.includes('already verified') || error.response?.status === 409) {
          toastSuccess('Email is already verified. You can sign in.');
          setStatus('success');
          setMessage('Email is already verified. You can sign in.');
        } else {
          const message = error.response?.data?.message || 'Verification failed. The link may have expired or already been used.';
          toastErrorFromResponse(error);
          setStatus('error');
          setMessage(message);
        }
      }
    };
    verify();
  }, [token]);

  const statusConfig = {
    loading: {
      icon: (
        <div className="w-20 h-20 bg-gradient-to-br from-brand-50 to-accent-50 dark:from-brand-500/15 dark:to-accent-500/15 rounded-3xl flex items-center justify-center border border-brand-100 dark:border-brand-500/20">
          <Loader2 size={36} className="text-brand-500 animate-spin" />
        </div>
      ),
      title:  'Verifying…',
      titleColor: 'text-neutral-900 dark:text-white',
    },
    success: {
      icon: (
        <div className="w-20 h-20 bg-gradient-to-br from-success-100 to-success-200 dark:from-success-500/20 dark:to-success-600/20 rounded-3xl flex items-center justify-center border border-success-200 dark:border-success-500/30">
          <CheckCircle size={36} className="text-success-600 dark:text-success-400" />
        </div>
      ),
      title:  'Verified! 🎉',
      titleColor: 'text-neutral-900 dark:text-white',
    },
    error: {
      icon: (
        <div className="w-20 h-20 bg-gradient-to-br from-error-100 to-error-200 dark:from-error-500/20 dark:to-error-600/20 rounded-3xl flex items-center justify-center border border-error-200 dark:border-error-500/30">
          <XCircle size={36} className="text-error-600 dark:text-error-400" />
        </div>
      ),
      title:  'Verification Failed',
      titleColor: 'text-neutral-900 dark:text-white',
    },
  };

  const cfg = statusConfig[status] || statusConfig.loading;

  return (
    <MainLayout>
      <div className="min-h-[80vh] flex items-center justify-center p-6">
        <Motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md text-center bg-white dark:bg-dark-800 border border-neutral-200 dark:border-dark-700 rounded-3xl shadow-xl p-10"
        >
          {/* Icon */}
          <div className="flex justify-center mb-6">
            {cfg.icon}
          </div>

          {/* Title */}
          <h2 className={`text-3xl font-bold mb-3 tracking-tight ${cfg.titleColor}`}>
            {cfg.title}
          </h2>

          {/* Message */}
          <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed mb-8">
            {message}
          </p>

          {/* Countdown */}
          {status === 'success' && (
            <div className="flex items-center justify-center gap-2 text-sm text-neutral-400 mb-6">
              <span className="w-8 h-8 rounded-full border-2 border-brand-400 flex items-center justify-center font-bold text-brand-500">
                {redirectCount}
              </span>
              <span>Redirecting to login…</span>
            </div>
          )}

          <Button
            fullWidth
            variant={status === 'error' ? 'outline' : 'gradient'}
            size="lg"
            icon={ArrowRight}
            iconPosition="right"
            disabled={status === 'loading'}
            onClick={() => navigate('/login', { state: { email: verifiedEmail, message }, replace: true })}
            className="h-14 font-bold rounded-2xl shadow-xl shadow-brand-500/20"
          >
            {status === 'success' ? 'Continue to Login' : 'Back to Login'}
          </Button>
        </Motion.div>
      </div>
    </MainLayout>
  );
}
