import {
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  PlayCircle,
  Search,
  Star,
  Shield,
  TrendingUp,
  Pause,
  RotateCw,
  Ban,
} from 'lucide-react';

/**
 * Status badge configuration mapping
 */
export const STATUS_CONFIG = {
  // Booking statuses
  booking: {
    PENDING: {
      label: 'Pending Arrival',
      variant: 'warning',
      icon: Search,
      pulse: true,
    },
    CONFIRMED: { label: 'Confirmed', variant: 'info', icon: CheckCircle },
    IN_PROGRESS: {
      label: 'Working',
      variant: 'accent',
      icon: PlayCircle,
      pulse: true,
    },
    COMPLETED: { label: 'Completed', variant: 'success', icon: CheckCircle },
    CANCELLED: { label: 'Cancelled', variant: 'error', icon: XCircle },
    RESCHEDULED: {
      label: 'Rescheduled',
      variant: 'warning',
      icon: RotateCw,
    },
  },

  // Payment statuses
  payment: {
    PENDING: { label: 'Pending', variant: 'warning', icon: Clock },
    COMPLETED: { label: 'Paid', variant: 'success', icon: CheckCircle },
    FAILED: { label: 'Failed', variant: 'error', icon: XCircle },
    REFUNDED: { label: 'Refunded', variant: 'info', icon: RotateCw },
    PARTIAL: { label: 'Partial', variant: 'warning', icon: AlertCircle },
  },

  // Verification statuses
  verification: {
    PENDING: {
      label: 'Pending Review',
      variant: 'warning',
      icon: Clock,
      pulse: true,
    },
    VERIFIED: { label: 'Verified', variant: 'success', icon: CheckCircle },
    REJECTED: { label: 'Rejected', variant: 'error', icon: XCircle },
    RESUBMIT: { label: 'Resubmit Required', variant: 'error', icon: AlertCircle },
    APPROVED: { label: 'Approved', variant: 'success', icon: Shield },
  },

  // Worker statuses
  worker: {
    ACTIVE: { label: 'Active', variant: 'success', icon: CheckCircle },
    INACTIVE: { label: 'Inactive', variant: 'error', icon: Pause },
    PAUSED: { label: 'Paused', variant: 'warning', icon: Pause },
    BANNED: { label: 'Banned', variant: 'error', icon: Ban },
    PENDING: { label: 'Pending Approval', variant: 'warning', icon: Clock },
  },

  // Rating/Review statuses
  rating: {
    EXCELLENT: { label: '★★★★★', variant: 'success', icon: Star },
    GOOD: { label: '★★★★', variant: 'success', icon: Star },
    AVERAGE: { label: '★★★', variant: 'warning', icon: Star },
    POOR: { label: '★★', variant: 'warning', icon: Star },
    VERY_POOR: { label: '★', variant: 'error', icon: Star },
  },

  // Generic statuses
  generic: {
    ACTIVE: { label: 'Active', variant: 'success', icon: CheckCircle },
    INACTIVE: { label: 'Inactive', variant: 'error', icon: XCircle },
    PENDING: { label: 'Pending', variant: 'warning', icon: Clock },
    SUCCESS: { label: 'Success', variant: 'success', icon: CheckCircle },
    ERROR: { label: 'Error', variant: 'error', icon: XCircle },
    ALERT: { label: 'Alert', variant: 'error', icon: AlertCircle },
    INFO: { label: 'Info', variant: 'info', icon: AlertCircle },
  },
};

/**
 * Helper to get status color variant
 */
export function getStatusVariant(status, type = 'generic') {
  const config = STATUS_CONFIG[type]?.[String(status).toUpperCase()];
  return config?.variant || 'default';
}

/**
 * Helper to get status label
 */
export function getStatusLabel(status, type = 'generic') {
  const config = STATUS_CONFIG[type]?.[String(status).toUpperCase()];
  return config?.label || status;
}
