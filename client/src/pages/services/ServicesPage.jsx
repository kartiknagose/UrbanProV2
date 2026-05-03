import { createElement, useMemo, useState, memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, Sparkles, Droplets, Zap, Paintbrush, Wind, Wrench, Briefcase, Star, ArrowRight, ChevronDown, X, SlidersHorizontal, Check } from 'lucide-react';
import { MainLayout } from '../../components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardDescription } from '../../components/common';
import { Input, Button, Badge, PageHeader, Skeleton, AsyncState } from '../../components/common';
import { getAllServices } from '../../api/services';
import { IMAGES, getServiceImage } from '../../constants/images';
import { getPageLayout } from '../../constants/layout';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcut';
import { queryKeys } from '../../utils/queryKeys';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useTranslation } from 'react-i18next';
import { toFixedSafe } from '../../utils/numberFormat';

const categoryIconMap = {
  cleaning: Sparkles,
  plumbing: Droplets,
  electrical: Zap,
  painting: Paintbrush,
  cooling: Wind,
  repair: Wrench,
};

// Helper: Get icon based on category
const getCategoryIcon = (category) => {
  const normalized = category?.toLowerCase() || '';
  if (normalized.includes('clean')) return categoryIconMap.cleaning;
  if (normalized.includes('plumb') || normalized.includes('water')) return categoryIconMap.plumbing;
  if (normalized.includes('electric') || normalized.includes('wir')) return categoryIconMap.electrical;
  if (normalized.includes('paint')) return categoryIconMap.painting;
  if (normalized.includes('ac') || normalized.includes('cool')) return categoryIconMap.cooling;
  if (normalized.includes('repair') || normalized.includes('fix')) return categoryIconMap.repair;
  return Briefcase;
};

// Memoized Service Card Component (ISSUE-035)
const ServiceCard = memo(({ service }) => {
  const { t } = useTranslation();
  const iconType = getCategoryIcon(service.category);
  const bgImage = getServiceImage(service.name || service.category);

  const rating = toFixedSafe(service.avgRating, 1, null);

  return (
    <Card hoverable className="h-full flex flex-col relative overflow-hidden group border-0 shadow-xl ring-1 ring-gray-200 dark:ring-white/10 rounded-[2rem]">

      {/* Image Header */}
      <div className="relative h-44 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-10 transition-opacity duration-300 opacity-70 group-hover:opacity-90"></div>
        <img
          src={bgImage}
          alt={service.name}
          className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
          loading="lazy"
          onError={(event) => {
            if (event.currentTarget.src !== IMAGES.CATEGORY_DEFAULT) {
              event.currentTarget.src = IMAGES.CATEGORY_DEFAULT;
            }
          }}
        />

        {/* Rating Badge */}
        <div className="absolute top-3 right-3 z-20">
          {rating && (
            <div className="flex items-center gap-1.5 bg-white text-gray-900 px-3 py-1.5 rounded-xl text-[10px] font-black shadow-xl ring-1 ring-black/5">
              <Star size={10} className="fill-yellow-400 text-yellow-400" />
              {rating}
            </div>
          )}
        </div>

        {/* Category Icon */}
        <div className="absolute top-3 left-3 z-20">
          <div className="p-3 rounded-xl backdrop-blur-2xl bg-white/90 text-brand-600 ring-1 ring-black/5 dark:bg-white/10 dark:text-white dark:ring-white/20 shadow-xl">
            {iconType ? createElement(iconType, { size: 18 }) : null}
          </div>
        </div>
      </div>

      <div className="p-5 flex-grow flex flex-col">
        <div className="mb-3">
          {service.category && (
            <span className="text-[10px] font-black uppercase tracking-[0.18em] px-3 py-1.5 rounded-xl bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400">
              {service.category}
            </span>
          )}
        </div>

        <h3 className="text-xl font-black mb-2 line-clamp-1 group-hover:text-brand-500 transition-colors tracking-tight leading-tight text-gray-900 dark:text-white">
          {service.name}
        </h3>

        <p className="text-sm line-clamp-2 mb-4 leading-relaxed opacity-70 text-gray-600 dark:text-gray-300">
          {service.description || 'Professional grade service at your doorstep with 100% satisfaction guarantee and verified experts.'}
        </p>

        <div className="mt-auto pt-4 border-t border-gray-100 dark:border-white/5">
          <Link to={`/services/${service.id}`} className="block">
            <Button
              variant="primary"
              fullWidth
              className="h-11 rounded-xl font-black uppercase tracking-[0.18em] text-[10px] shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 group-hover:scale-[1.01] transition-all border-0 ring-4 ring-brand-500/0 hover:ring-brand-500/10"
              icon={ArrowRight}
              iconPosition="right"
            >
              {t('Book Now')}
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
});

export function ServicesPage() {
    const { t } = useTranslation();
    usePageTitle(t('Services'));
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [priceRange, setPriceRange] = useState({ min: 0, max: 10000 });
  const [minRating, setMinRating] = useState(0);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  // Keyboard shortcuts
  useKeyboardShortcuts([
    { key: 'h', callback: () => navigate('/'), meta: true },
    { key: 'f', callback: () => setIsFiltersOpen(prev => !prev), meta: true },
  ]);

  const { data: services = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.services.list({ search, category, priceRange, minRating }),
    queryFn: async () => {
      const data = await getAllServices({
        search,
        category,
        minPrice: priceRange.min,
        maxPrice: priceRange.max,
        minRating
      });
      return Array.isArray(data.services) ? data.services : Array.isArray(data) ? data : [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Deduplicate services by name
  const uniqueServices = useMemo(() => {
    const uniqueMap = new Map();
    (services || []).forEach((service) => {
      // Normalize the name to ensure case-insensitive deduplication
      const key = service.name?.trim().toLowerCase();
      if (!key) return;

      // If we haven't seen this service name yet, add it.
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, service);
      } else {
        // Keep the one with the lower price if duplicates exist
        const existing = uniqueMap.get(key);
        if ((service.basePrice || 0) < (existing.basePrice || 0)) {
          uniqueMap.set(key, service);
        }
      }
    });
    return Array.from(uniqueMap.values());
  }, [services]);

  // Derive categories from unique services
  const categories = useMemo(() => {
    const set = new Set();
    (uniqueServices || []).forEach((service) => {
      if (service.category) set.add(service.category);
    });
    return Array.from(set);
  }, [uniqueServices]);

  const clearFilters = () => {
    setSearch('');
    setCategory('');
    setPriceRange({ min: 0, max: 10000 });
    setMinRating(0);
  };

  const activeFiltersCount = [
    category !== '',
    priceRange.max < 10000,
    minRating > 0
  ].filter(Boolean).length;

  return (
    <MainLayout>
      <div className={`${getPageLayout('wide')} module-canvas module-canvas--services`}>

        {/* Modern Search Hero */}
        <div className="relative mb-12 py-12 text-center">
          <h1 className="text-4xl md:text-6xl font-black mb-6 tracking-tight text-gray-900 dark:text-white">
            {t('What do you need help with?').split(' ').slice(0, 3).join(' ')} <span className="text-brand-500">{t('need help')}</span> {t('What do you need help with?').split(' ').slice(5).join(' ')}
          </h1>

          <div className="max-w-3xl mx-auto">
            <Input
              icon={Search}
              placeholder={t("Search for services like 'Home Cleaning', 'Electrical Repair'...")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="group"
              inputClassName="text-lg pr-[280px]"
              rightElement={
                <div className="flex items-center gap-2 pr-1">
                  <Button
                    variant={isFiltersOpen ? 'primary' : 'outline'}
                    className={`rounded-2xl px-6 h-12 gap-2 border-0 ring-1 ${isFiltersOpen ? 'ring-brand-500' : 'ring-gray-200 dark:ring-dark-700'}`}
                    onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                  >
                    <SlidersHorizontal size={18} />
                    <span className="hidden md:inline font-bold uppercase text-xs tracking-widest">{t('Filters')}</span>
                    {activeFiltersCount > 0 && (
                      <span className="w-5 h-5 rounded-full bg-brand-500 text-white text-[10px] flex items-center justify-center font-black">
                        {activeFiltersCount}
                      </span>
                    )}
                  </Button>
                  <Button
                    variant="primary"
                    className="rounded-2xl px-8 h-12 shadow-xl shadow-brand-500/20"
                    onClick={() => refetch()}
                  >
                    <span className="font-bold uppercase text-xs tracking-widest">{t('Search')}</span>
                  </Button>
                </div>
              }
            />
          </div>

          {/* Quick Category Chips */}
          <div className="mt-8 flex flex-wrap justify-center gap-2 px-4" role="radiogroup" aria-label="Service category filter">
            <button
              role="radio"
              aria-checked={category === ''}
              onClick={() => setCategory('')}
              className={`px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all ${category === ''
                ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20'
                : 'bg-white text-gray-500 hover:text-brand-600 hover:bg-gray-50 shadow-sm border dark:bg-dark-800 dark:text-gray-400 dark:hover:text-white dark:hover:bg-dark-700 dark:border-0 dark:shadow-none'}`}
            >
              {t('All')}
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                role="radio"
                aria-checked={category === cat}
                onClick={() => setCategory(cat)}
                className={`px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all ${category === cat
                  ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20'
                  : 'bg-white text-gray-500 hover:text-brand-600 hover:bg-gray-50 shadow-sm border dark:bg-dark-800 dark:text-gray-400 dark:hover:text-white dark:hover:bg-dark-700 dark:border-0 dark:shadow-none'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Expandable Advanced Filters */}
        <AnimatePresence>
          {isFiltersOpen && (
            <Motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-12"
            >
              <div className="p-8 rounded-[2.5rem] border backdrop-blur-3xl bg-white/80 border-gray-100 dark:bg-dark-800/50 dark:border-white/5 shadow-2xl">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">

                  {/* Price Filter */}
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-sm font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">{t('Max Price Range')}</h3>
                      <span className="text-brand-500 font-black">₹{priceRange.max.toLocaleString()}</span>
                    </div>
                    <div className="relative pt-2">
                      <input
                        type="range"
                        min="0"
                        max="10000"
                        step="500"
                        value={priceRange.max}
                        onChange={(e) => setPriceRange({ ...priceRange, max: Number(e.target.value) })}
                        className="w-full h-1.5 bg-gray-200 dark:bg-dark-700 rounded-lg appearance-none cursor-pointer accent-brand-500"
                      />
                      <div className="flex justify-between mt-4 text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                        <span>₹0</span>
                        <span>₹5k</span>
                        <span>₹10k+</span>
                      </div>
                    </div>
                  </div>

                  {/* Service Quality */}
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-widest mb-6 text-gray-500 dark:text-gray-400">{t('Expert Quality')}</h3>
                    <div className="grid grid-cols-4 gap-2">
                      {[0, 3, 4, 4.5].map((rating) => (
                        <button
                          key={rating}
                          onClick={() => setMinRating(rating)}
                          className={`p-3 rounded-2xl border transition-all flex flex-col items-center gap-1 ${minRating === rating
                            ? 'bg-brand-500 border-brand-500 text-white'
                            : 'bg-white border-gray-100 text-gray-500 hover:border-brand-200 dark:bg-dark-800/50 dark:border-white/5 dark:text-gray-400'}`}
                        >
                          <span className="text-xs font-black">{rating === 0 ? t('Any') : `${rating}+`}</span>
                          <Star size={10} className={minRating === rating ? 'fill-white' : 'fill-gray-400'} />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sort & Order (Placeholder logic for style) */}
                  <div className="flex flex-col justify-end">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        fullWidth
                        className="h-14 rounded-2xl border-dashed border-2 font-bold opacity-60 hover:opacity-100"
                        onClick={clearFilters}
                        icon={X}
                      >
                        {t('Reset All')}
                      </Button>
                      <Button
                        variant="primary"
                        fullWidth
                        className="h-14 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px]"
                        onClick={() => setIsFiltersOpen(false)}
                        icon={Check}
                      >
                        {t('Apply')}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </Motion.div>
          )}
        </AnimatePresence>

        <AsyncState
          isLoading={isLoading}
          isError={isError}
          error={error}
          isEmpty={!isLoading && !isError && uniqueServices.length === 0}
          emptyTitle={t("No services found")}
          emptyMessage={t("Try different search terms or clear your filters.")}
          emptyAction={
            <Button size="sm" variant="outline" onClick={clearFilters}>
              {t("Clear Filters")}
            </Button>
          }
          loadingFallback={
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="h-80">
                  <div className="flex justify-between mb-6">
                    <Skeleton variant="circular" className="w-12 h-12" />
                    <Skeleton className="w-12 h-6 rounded-full" />
                  </div>
                  <Skeleton className="w-20 h-4 mb-2" />
                  <Skeleton className="w-3/4 h-6 mb-2" />
                  <Skeleton className="w-full h-16 mb-6" />
                  <div className="mt-auto pt-4 border-t border-dashed border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between mb-4">
                      <Skeleton className="w-24 h-4" />
                      <Skeleton className="w-16 h-6" />
                    </div>
                    <Skeleton className="w-full h-10" />
                  </div>
                </Card>
              ))}
            </div>
          }
          errorFallback={
            <Card className="p-6 border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/10">
              <p className="text-red-600 dark:text-red-400">{error?.message || 'Failed to load services'}</p>
            </Card>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {uniqueServices.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        </AsyncState>
      </div>
    </MainLayout>
  );
}
