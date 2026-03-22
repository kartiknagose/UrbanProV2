import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart, HeartOff, Star, MapPin, Loader2, Search, Briefcase, ArrowRight, User } from 'lucide-react';
import { toast } from 'sonner';
import { motion as Motion, AnimatePresence } from 'framer-motion';

import { MainLayout } from '../../components/layout/MainLayout';
import { Card, Button, Input, AsyncState } from '../../components/common';
import { getFavoriteWorkers, toggleFavoriteWorker } from '../../api/growth';
import { WorkerProfileWindow } from '../../components/features/workers/WorkerProfileWindow';
import { usePageTitle } from '../../hooks/usePageTitle';
import { getPageLayout } from '../../constants/layout';
import { toFixedSafe } from '../../utils/numberFormat';

export function CustomerFavoritesPage() {
  usePageTitle('My Favorites');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingProfileId, setViewingProfileId] = useState(null);

  const { data: favorites = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['favorites'],
    queryFn: getFavoriteWorkers,
  });

  const removeMutation = useMutation({
    mutationFn: (workerProfileId) => toggleFavoriteWorker(workerProfileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      queryClient.invalidateQueries({ queryKey: ['favorite-ids'] });
      toast.success('Worker removed from favorites');
    },
    onError: () => toast.error('Failed to remove worker from favorites'),
  });

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filtered = favorites.filter((f) => {
    const workerName = (f?.worker?.name || '').toLowerCase();
    const services = Array.isArray(f?.worker?.services) ? f.worker.services : [];
    const matchesName = workerName.includes(normalizedQuery);
    const matchesService = services.some((s) => (s?.name || '').toLowerCase().includes(normalizedQuery));
    return matchesName || matchesService;
  });

  return (
    <MainLayout>
      <div className={getPageLayout('default')}>
        {/* Header */}
        <Motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <span className="text-xs font-bold uppercase tracking-widest text-brand-500 mb-2 block">
            Quick Access
          </span>
          <h1 className="text-4xl font-bold tracking-tight text-neutral-900 dark:text-white">
            My Favorites
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
            Your saved workers for quick rebooking
          </p>
        </Motion.div>

        {/* Search */}
        {favorites.length > 0 && (
          <Motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-8">
            <div className="max-w-md">
              <Input
                icon={Search}
                placeholder="Search by name or service..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </Motion.div>
        )}

        <AsyncState
          isLoading={isLoading}
          isError={isError}
          error={error}
          onRetry={refetch}
          isEmpty={filtered.length === 0}
          emptyTitle={searchQuery ? "No matches found" : "No favorites yet"}
          emptyMessage={searchQuery ? "Try searching for a different name." : "Tap the heart icon on any worker to save them here for quick rebooking."}
          emptyAction={
            <Button variant="gradient" onClick={() => navigate('/services')} className="mt-2">
              Browse Services
            </Button>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence mode="popLayout">
              {filtered.map((fav, i) => {
                const worker = fav?.worker || {};
                const services = Array.isArray(worker.services) ? worker.services : [];

                return (
                <Motion.div
                  key={fav.workerProfileId}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className="p-5 hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 group">
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-100 to-brand-200 dark:from-brand-900/40 dark:to-brand-800/40 flex items-center justify-center shrink-0 overflow-hidden">
                        {worker.profilePhotoUrl ? (
                          <img src={worker.profilePhotoUrl} alt={worker.name || 'Worker'} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xl font-bold text-brand-600 dark:text-brand-400">
                            {worker.name?.charAt(0)?.toUpperCase() || '?'}
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-bold text-gray-900 dark:text-white truncate">{worker.name || 'Worker'}</h3>
                          <button
                            onClick={() => removeMutation.mutate(fav.workerProfileId)}
                            disabled={removeMutation.isPending && removeMutation.variables === fav.workerProfileId}
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
                            title="Remove from favorites"
                          >
                            {removeMutation.isPending && removeMutation.variables === fav.workerProfileId ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Heart size={16} fill="currentColor" />
                            )}
                          </button>
                        </div>

                        {/* Rating */}
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex items-center gap-1">
                            <Star size={13} className="text-amber-500" fill="currentColor" />
                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                              {toFixedSafe(worker.rating, 1, 'New')}
                            </span>
                          </div>
                          <span className="text-xs text-gray-400">·</span>
                          <span className="text-xs text-gray-500">{worker.totalReviews || 0} reviews</span>
                          {worker.verificationLevel && worker.verificationLevel !== 'BASIC' && (
                            <>
                              <span className="text-xs text-gray-400">·</span>
                              <span className="text-xs font-medium text-brand-600 dark:text-brand-400">
                                {worker.verificationLevel}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Services */}
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {services.slice(0, 3).map((s) => (
                            <span key={s.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-400">
                              <Briefcase size={10} /> {s.name}
                            </span>
                          ))}
                          {services.length > 3 && (
                            <span className="text-xs text-gray-400">+{services.length - 3} more</span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {services.slice(0, 1).map((s) => (
                            <Button
                              key={s.id}
                              size="sm"
                              variant="primary"
                              className="rounded-xl h-8 text-xs px-4 shadow-brand-500/20 shadow-md"
                              onClick={() => navigate(`/services/${s.id}?worker=${fav.workerProfileId}`)}
                            >
                              Book Now
                            </Button>
                          ))}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-xl h-8 text-xs text-brand-600 dark:text-brand-400 gap-1 px-2"
                            onClick={() => setViewingProfileId(fav.workerProfileId)}
                            icon={User}
                          >
                            View Profile
                          </Button>

                        </div>
                      </div>
                    </div>
                  </Card>
                </Motion.div>
              )})}
            </AnimatePresence>
          </div>
        </AsyncState>

        {/* Floating Profile Window */}
        <WorkerProfileWindow 
          isOpen={!!viewingProfileId}
          workerId={viewingProfileId}
          onClose={() => setViewingProfileId(null)}
        />
      </div>
    </MainLayout>
  );
}
