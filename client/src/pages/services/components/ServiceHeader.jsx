import { IndianRupee, CheckCircle2, Star, Clock } from 'lucide-react';
import { Badge } from '../../../components/common';
import { toFixedSafe } from '../../../utils/numberFormat';
import { formatCurrencyCompact } from '../../../utils/formatters';

export function ServiceHeader({ service }) {
  const avgRating = toFixedSafe(service?.avgRating, 1, null);
  const basePriceLabel = service?.basePrice
    ? formatCurrencyCompact(service.basePrice)
    : 'Top Rated';

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Badge variant="brand" className="px-3 py-1 text-sm font-medium rounded-full shadow-sm shadow-brand-500/20">
          {service.category || 'General'}
        </Badge>
        <div className="flex items-center gap-1.5 text-sm font-semibold text-brand-600 dark:text-brand-400">
          <div className="bg-brand-100 dark:bg-brand-900/30 p-1 rounded-full">
            <IndianRupee size={12} strokeWidth={3} />
          </div>
          <span>Starts at {basePriceLabel}</span>
        </div>
      </div>

      <h1 className="text-4xl sm:text-5xl font-extrabold mb-4 leading-tight text-gray-900 dark:text-white">
        {service.name}
      </h1>
      <p className="text-lg leading-relaxed text-gray-600 dark:text-gray-400">
        {service.description || 'Experience top-tier professional services tailored to your needs. Validated experts, guaranteed satisfaction.'}
      </p>

      {/* Quick Stats/Trust Signals */}
      <div className="flex flex-wrap gap-6 mt-6 pt-6 border-t border-gray-200 dark:border-dark-800">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="text-green-500" size={20} />
          <span className="font-medium text-gray-700 dark:text-gray-300">Background-Verified Professionals</span>
        </div>
        {avgRating && (
          <div className="flex items-center gap-2">
            <div className="text-yellow-500"><Star size={20} fill="currentColor" /></div>
            <span className="font-medium text-gray-700 dark:text-gray-300">{avgRating} Avg Rating</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Clock className="text-blue-500" size={20} />
          <span className="font-medium text-gray-700 dark:text-gray-300">Satisfaction Guarantee</span>
        </div>
      </div>
    </div>
  );
}
