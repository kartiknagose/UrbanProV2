/**
 * EmptyState Component
 * Reusable generic empty state with icon, title, description, and optional CTA
 * 
 * Used whenever there's no data to display (no bookings, no services, etc.)
 * Provides consistent, friendly messaging with optional action button.
 */

import { Button } from '../../ui/Button';
import { motion as Motion } from 'framer-motion';
import { Search, Database, ShoppingCart, Calendar } from 'lucide-react';

export function EmptyState({
  icon: Icon,
  title = 'No items found',
  description = 'There are no items to display right now.',
  action = null, // { label: string, onClick: function, variant?: string }
  size = 'md', // sm, md, lg
  className = '',
  iconClassName = '',
}) {
  const sizeMap = {
    sm: {
      containerPy: 'py-8',
      iconSize: 48,
      titleSize: 'text-base',
      titleWeight: 'font-semibold',
      descSize: 'text-sm',
    },
    md: {
      containerPy: 'py-16',
      iconSize: 64,
      titleSize: 'text-lg',
      titleWeight: 'font-semibold',
      descSize: 'text-sm',
    },
    lg: {
      containerPy: 'py-24',
      iconSize: 80,
      titleSize: 'text-2xl',
      titleWeight: 'font-bold',
      descSize: 'text-base',
    },
  };

  const config = sizeMap[size] || sizeMap.md;

  return (
    <Motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={`
        flex flex-col items-center justify-center text-center gap-4
        ${config.containerPy}
        ${className}
      `}
    >
      {/* Icon */}
      {Icon && (
        <div className={`
          text-neutral-300 dark:text-neutral-600
          flex-shrink-0
          ${iconClassName}
        `}>
          <Icon size={config.iconSize} strokeWidth={1.5} />
        </div>
      )}

      {/* Title */}
      <h3 className={`${config.titleSize} ${config.titleWeight} text-neutral-900 dark:text-white`}>
        {title}
      </h3>

      {/* Description */}
      <p className={`${config.descSize} text-neutral-500 dark:text-neutral-400 max-w-xs`}>
        {description}
      </p>

      {/* Action Button */}
      {action && (
        <Motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.3 }}
          className="mt-2"
        >
          <Button
            variant={action.variant || 'primary'}
            size={size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'md'}
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        </Motion.div>
      )}
    </Motion.div>
  );
}

/**
 * EmptySearchResult - Specific empty state for search/filter results
 */
export function EmptySearchResult({
  query = '',
  onClear = null,
  size = 'md',
}) {
  return (
    <EmptyState
      icon={Search}
      title="No results found"
      description={query 
        ? `No items match "${query}". Try different keywords.`
        : 'Try adjusting your search or filters.'}
      action={onClear ? { label: 'Clear search', onClick: onClear } : null}
      size={size}
    />
  );
}

/**
 * EmptyDataState - Specific empty state for data pages
 */
export function EmptyDataState({
  title = 'No data available',
  description = 'You can start by creating your first item.',
  action = null,
  size = 'md',
}) {
  return (
    <EmptyState
      icon={Database}
      title={title}
      description={description}
      action={action}
      size={size}
    />
  );
}

/**
 * EmptyCartState - Specific empty state for cart/wallet
 */
export function EmptyCartState({ size = 'md' }) {
  return (
    <EmptyState
      icon={ShoppingCart}
      title="Your cart is empty"
      description="Start browsing to add items to your cart."
      size={size}
    />
  );
}

/**
 * EmptyBookingState - Specific empty state for bookings
 */
export function EmptyBookingState({
  type = 'customer', // customer or worker
  size = 'md',
  action = null,
}) {
  const titles = {
    customer: 'No bookings yet',
    worker: 'No bookings scheduled',
  };
  const descriptions = {
    customer: 'Start by exploring services and booking your first appointment.',
    worker: 'Your schedule will appear here once bookings are confirmed.',
  };

  return (
    <EmptyState
      icon={Calendar}
      title={titles[type] || titles.customer}
      description={descriptions[type] || descriptions.customer}
      action={action}
      size={size}
    />
  );
}
