/**
 * StatusBadge Component
 * Consolidated status badge component that replaces 5+ scattered variants
 * 
 * Centralized logic for:
 * - BookingStatusBadge
 * - PaymentStatusBadge  
 * - VerificationStatusBadge
 * - WorkerStatusBadge
 * - CustomStatusBadge
 * 
 * Now all status badges use single component with type-based rendering
 */

import { Badge } from '../../ui/Badge';
import { STATUS_CONFIG, getStatusVariant, getStatusLabel } from './StatusBadge.constants';

// Re-export constants and helpers for backward compatibility
// eslint-disable-next-line react-refresh/only-export-components
export { getStatusVariant, getStatusLabel };

/**
 * StatusBadge Component
 * 
 * @param {string} status - The status value (e.g., 'PENDING', 'COMPLETED')
 * @param {string} type - Category: 'booking' | 'payment' | 'verification' | 'worker' | 'rating' | 'generic'
 * @param {string} size - Badge size: 'sm' | 'md' | 'lg'
 * @param {string} customLabel - Override the label
 * @param {React.ReactNode} icon - Override the icon
 * @param {string} className - Additional CSS
 */
export function StatusBadge({
  status,
  type = 'generic',
  size = 'md',
  customLabel,
  icon: customIcon,
  className = '',
  animated = false,
}) {
  if (!status) return null;

  const normalizedStatus = String(status).toUpperCase();
  const config = STATUS_CONFIG[type]?.[normalizedStatus] || STATUS_CONFIG.generic[normalizedStatus];

  if (!config) {
    // Fallback for unknown status
    return (
      <Badge variant="default" size={size} className={className}>
        {customLabel || status}
      </Badge>
    );
  }

  const Icon = customIcon || config.icon;
  const label = customLabel || config.label;
  const pulse = animated && config.pulse;

  return (
    <Badge
      variant={config.variant}
      size={size}
      className={`
        flex items-center gap-1.5 px-3 py-1 font-semibold uppercase text-[10px] tracking-widest rounded-lg border shadow-sm
        ${pulse ? 'animate-pulse' : ''}
        ${className}
      `}
    >
      {Icon && <Icon size={12} className={pulse ? 'animate-pulse' : ''} />}
      {label}
    </Badge>
  );
}

/**
 * Booking-specific status badge (convenience wrapper)
 */
export function BookingStatusBadge({ status, size = 'md', className = '', animated = true }) {
  return (
    <StatusBadge
      status={status}
      type="booking"
      size={size}
      className={className}
      animated={animated}
    />
  );
}

/**
 * Payment-specific status badge (convenience wrapper)
 */
export function PaymentStatusBadge({ status, size = 'md', className = '' }) {
  return (
    <StatusBadge
      status={status}
      type="payment"
      size={size}
      className={className}
    />
  );
}

/**
 * Verification-specific status badge (convenience wrapper)
 */
export function VerificationStatusBadge({ status, size = 'md', className = '', animated = true }) {
  return (
    <StatusBadge
      status={status}
      type="verification"
      size={size}
      className={className}
      animated={animated}
    />
  );
}

/**
 * Worker-specific status badge (convenience wrapper)
 */
export function WorkerStatusBadge({ status, size = 'md', className = '' }) {
  return (
    <StatusBadge
      status={status}
      type="worker"
      size={size}
      className={className}
    />
  );
}

/**
 * Rating-specific status badge (convenience wrapper)
 */
export function RatingBadge({ rating, size = 'md', className = '' }) {
  const ratingLabels = {
    5: 'EXCELLENT',
    4: 'GOOD',
    3: 'AVERAGE',
    2: 'POOR',
    1: 'VERY_POOR',
  };

  const statusKey = ratingLabels[Math.round(rating)] || 'AVERAGE';

  return (
    <StatusBadge
      status={statusKey}
      type="rating"
      size={size}
      className={className}
    />
  );
}
