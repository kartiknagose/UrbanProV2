// Spinner component — branded gradient spinner with overlay support

import { motion as Motion } from 'framer-motion';

/**
 * Spinner
 */
export function Spinner({ size = 'md', color = 'primary', className = '' }) {
  const sizeStyles = {
    xs: 'w-3 h-3 border-[1.5px]',
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-[3px]',
    xl: 'w-16 h-16 border-4',
  };

  const colorStyles = {
    primary:   'border-brand-500/30 border-t-brand-500',
    secondary: 'border-neutral-300 dark:border-dark-600 border-t-neutral-600 dark:border-t-neutral-400',
    white:     'border-white/30 border-t-white',
    success:   'border-success-500/30 border-t-success-500',
    error:     'border-error-500/30 border-t-error-500',
    accent:    'border-accent-500/30 border-t-accent-500',
  };

  const spinnerClasses = [
    sizeStyles[size] ?? sizeStyles.md,
    colorStyles[color] ?? colorStyles.primary,
    'rounded-full animate-spin',
    className,
  ].join(' ');

  return <div className={spinnerClasses} />;
}

/**
 * LoadingOverlay — full screen or contained loading overlay
 */
export function LoadingOverlay({ message, blur = true }) {
  return (
    <Motion.div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center
        bg-white/80 dark:bg-dark-950/80 ${blur ? 'backdrop-blur-sm' : ''}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="w-full max-w-md px-6">
        <div className="rounded-2xl border border-neutral-200 bg-white/90 p-5 shadow-sm dark:border-dark-700 dark:bg-dark-900/80">
          <div className="mb-4 h-5 w-40 animate-pulse rounded bg-neutral-200 dark:bg-dark-700" />
          <div className="space-y-3">
            <div className="h-4 w-full animate-pulse rounded bg-neutral-200 dark:bg-dark-700" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-neutral-200 dark:bg-dark-700" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-neutral-200 dark:bg-dark-700" />
          </div>
        </div>
      </div>

      {message && (
        <p className="mt-5 text-base font-semibold text-neutral-700 dark:text-neutral-200 animate-pulse">
          {message}
        </p>
      )}
    </Motion.div>
  );
}

/**
 * FullPageSpinner — used by route guards
 */
export function FullPageSpinner({ message = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-neutral-50 dark:bg-dark-950">
      <Motion.div
        className="w-full max-w-xl px-6"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-dark-700 dark:bg-dark-900">
          <div className="mb-5 flex items-center gap-3">
            <div className="h-11 w-11 animate-pulse rounded-2xl bg-neutral-200 dark:bg-dark-700" />
            <div className="space-y-2">
              <div className="h-4 w-40 animate-pulse rounded bg-neutral-200 dark:bg-dark-700" />
              <div className="h-3 w-24 animate-pulse rounded bg-neutral-200 dark:bg-dark-700" />
            </div>
          </div>
          <div className="space-y-3">
            <div className="h-4 w-full animate-pulse rounded bg-neutral-200 dark:bg-dark-700" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-neutral-200 dark:bg-dark-700" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-neutral-200 dark:bg-dark-700" />
          </div>
        </div>
        <p className="mt-4 text-center text-sm font-semibold text-neutral-600 dark:text-neutral-300">{message}</p>
      </Motion.div>
    </div>
  );
}

/**
 * LoadingButton — inline spinner for buttons
 */
export function LoadingButton({ text = 'Loading...', size = 'md' }) {
  return (
    <div className="flex items-center gap-2">
      <Spinner size={size} color="primary" />
      <span className="text-sm font-medium text-neutral-600 dark:text-neutral-300">{text}</span>
    </div>
  );
}
