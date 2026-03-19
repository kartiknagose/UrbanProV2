// Worker services management page - Premium

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Briefcase, PlusCircle, Trash2, Search, CheckCircle2, Layers } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { MainLayout } from '../../components/layout/MainLayout';
import { Card, Badge, Button, AsyncState, Input, PageHeader } from '../../components/common';
import { getAllServices } from '../../api/services';
import { getMyServices, addServiceToWorker, removeServiceFromWorker } from '../../api/workers';
import { getPageLayout } from '../../constants/layout';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcut';
import { queryKeys } from '../../utils/queryKeys';
import { usePageTitle } from '../../hooks/usePageTitle';
import { asArray } from '../../utils/safeData';

export function WorkerServicesPage() {
  const { t } = useTranslation();
  usePageTitle(t('My Services'));
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  useKeyboardShortcuts([
    { key: 'd', callback: () => navigate('/worker/dashboard'), meta: true },
    { key: 'b', callback: () => navigate('/worker/bookings'), meta: true },
  ]);

  const servicesQuery = useQuery({
    queryKey: queryKeys.services.all(),
    queryFn: getAllServices,
  });

  const myServicesQuery = useQuery({
    queryKey: queryKeys.worker.services(),
    queryFn: getMyServices,
  });

  const addMutation = useMutation({
    mutationFn: (serviceId) => addServiceToWorker({ serviceId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.worker.services() });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (serviceId) => removeServiceFromWorker(serviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.worker.services() });
    },
  });

  const allServices = useMemo(() => asArray(servicesQuery.data?.services || servicesQuery.data), [servicesQuery.data]);
  const myServices = useMemo(() => asArray(myServicesQuery.data?.services), [myServicesQuery.data?.services]);
  const isLoading = servicesQuery.isLoading || myServicesQuery.isLoading;
  const hasServicesError = servicesQuery.isError;
  const hasMyServicesError = myServicesQuery.isError;

  const myServiceIds = useMemo(() => {
    return new Set(myServices.map((entry) => entry.service?.id));
  }, [myServices]);

  const availableServices = useMemo(() => {
    return allServices.filter((service) => !myServiceIds.has(service.id));
  }, [allServices, myServiceIds]);

  const filteredAvailableServices = useMemo(() => {
    if (!searchTerm) return availableServices;
    const lowerTerm = searchTerm.toLowerCase();
    return availableServices.filter(service =>
      service.name?.toLowerCase().includes(lowerTerm) ||
      (service.category && service.category.toLowerCase().includes(lowerTerm))
    );

  }, [availableServices, searchTerm]);

  const showProfileMessage = myServicesQuery.isError &&
    (myServicesQuery.error?.response?.data?.error || '').includes('Worker profile not found');
  const showError = hasServicesError || (hasMyServicesError && !showProfileMessage);
  const errorMessage = hasServicesError
    ? t('Failed to load services catalog.')
    : hasMyServicesError
      ? t('Failed to load your services.')
      : null;

  return (
    <MainLayout>
      <div className={getPageLayout('default')}>
        
        {/* Header content matching the premium flow */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <Motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <span className="text-xs font-bold uppercase tracking-widest text-brand-500 mb-2 block">{t('Catalog Management')}</span>
            <h1 className="text-4xl font-bold tracking-tight text-neutral-900 dark:text-white leading-tight">
              {t('My Services')}
            </h1>
          </Motion.div>
          <Motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <p className="text-neutral-500 font-medium italic">{t('Control the specific services you offer and match with customers.')}</p>
          </Motion.div>
        </div>

        {showProfileMessage && (
          <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card className="p-8 mb-8 border-error-200 dark:border-error-500/30 bg-error-50 dark:bg-error-500/10 text-center shadow-xl shadow-error-500/5">
              <div className="w-16 h-16 rounded-3xl bg-error-100 dark:bg-error-500/20 text-error-600 dark:text-error-400 flex items-center justify-center mx-auto mb-4">
                <Briefcase size={32} />
              </div>
              <h3 className="font-bold text-xl text-neutral-900 dark:text-white mb-2">{t('Profile Incomplete')}</h3>
              <p className="text-error-600 dark:text-error-400 font-medium mb-6">
                {t('You must complete your worker profile before adding services.')}
              </p>
              <Button size="lg" variant="gradient" onClick={() => navigate('/worker/verification')} className="shadow-brand-md px-10 h-14 rounded-2xl">
                {t('Complete Setup Now')}
              </Button>
            </Card>
          </Motion.div>
        )}

        <AsyncState
          isLoading={isLoading}
          isError={showError}
          error={servicesQuery.error || myServicesQuery.error}
          errorFallback={
            <Card className="p-8 mt-6 text-center border-none shadow-xl">
              <p className="text-error-500 font-bold">{errorMessage || t('Failed to load data.')}</p>
            </Card>
          }
        >
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-10">
            
            {/* Left Column: Currently Offered */}
            <Motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
              <Card className="h-full border-none shadow-2xl bg-white dark:bg-dark-900 flex flex-col overflow-hidden">
                <div className="p-8 border-b border-neutral-100 dark:border-dark-800 flex items-center justify-between bg-neutral-50/30 dark:bg-dark-900/50">
                  <div>
                    <h3 className="text-2xl font-bold text-neutral-900 dark:text-white flex items-center gap-3">
                       {t('Active Services')}
                       <Badge variant="success" size="sm" pulse className="rounded-lg px-3">{myServices.length}</Badge>
                    </h3>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 font-medium">{t('Services currently published to your profile')}</p>
                  </div>
                </div>

                <div className="p-8 flex-1 bg-neutral-50/10 dark:bg-dark-800/10">
                  {myServices.length === 0 ? (
                    <div className="h-80 flex flex-col items-center justify-center text-center opacity-80">
                      <div className="w-20 h-20 rounded-[2rem] bg-neutral-100 dark:bg-dark-800 flex items-center justify-center text-neutral-400 mb-6 shadow-inner">
                        <Layers size={40} strokeWidth={1.5} />
                      </div>
                      <p className="font-bold text-xl text-neutral-900 dark:text-white mb-2">{t('Your catalog is empty')}</p>
                      <p className="text-sm text-neutral-500 max-w-sm mx-auto font-medium">{t('Pick from the available services on the right to start earning.')}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <AnimatePresence>
                        {myServices.map((entry) => (
                          <Motion.div 
                            key={entry.serviceId}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9, y: 10 }}
                            className="group p-6 rounded-[2rem] border border-neutral-100 dark:border-dark-800 bg-white dark:bg-dark-800 hover:shadow-2xl hover:border-brand-500/20 transition-all duration-500 relative overflow-hidden shadow-sm"
                          >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-success-500/5 dark:bg-success-500/10 rounded-bl-[4rem] -mr-8 -mt-8 transition-transform group-hover:scale-125" />
                            
                            <div className="relative z-10 h-full flex flex-col justify-between">
                              <div>
                                <div className="flex justify-between items-start mb-4">
                                  <div className="w-12 h-12 rounded-2xl bg-success-100 dark:bg-success-500/20 text-success-600 dark:text-success-400 shrink-0 flex items-center justify-center shadow-inner">
                                    <CheckCircle2 size={24} strokeWidth={2.5} />
                                  </div>
                                  <Button
                                    size="xs"
                                    variant="ghost"
                                    className="text-neutral-400 hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-500/10 h-8 font-bold px-3 rounded-lg opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0"
                                    icon={Trash2}
                                    loading={removeMutation.isPending && removeMutation.variables === entry.serviceId}
                                    onClick={() => removeMutation.mutate(entry.serviceId)}
                                  >
                                    {t('Offboard')}
                                  </Button>
                                </div>
                                <h4 className="font-bold text-lg text-neutral-900 dark:text-white leading-tight mb-3 pr-4 group-hover:text-brand-500 transition-colors uppercase tracking-tight">{entry.service?.name || t('Unnamed Service')}</h4>
                              </div>
                              {entry.service?.category && (
                                <Badge variant="neutral" size="xs" className="uppercase tracking-[0.2em] font-bold opacity-70">
                                  {entry.service?.category ? t(entry.service.category) : ''}
                                </Badge>
                              )}
                            </div>
                          </Motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </Card>
            </Motion.div>

            {/* Right Column: Discovery */}
            <Motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <Card className="h-full flex flex-col border-none shadow-2xl overflow-hidden sticky top-24 max-h-[calc(100vh-8rem)] rounded-[2.5rem] bg-white dark:bg-dark-900">
                <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-brand-500 via-accent-500 to-brand-500 opacity-90 z-20" />
                <div className="p-8 border-b border-neutral-100 dark:border-dark-700 bg-white/50 dark:bg-dark-900/50 backdrop-blur-xl z-10">
                  <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-1 transition-colors uppercase tracking-wider">{t('Discover Services')}</h3>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6 font-medium">{t('Browse the global catalog')}</p>
                  
                  <Input
                    placeholder={t("Filter catalog...")}
                    icon={Search}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="shadow-inner"
                  />
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-6 bg-neutral-50/10 dark:bg-dark-800/10 custom-scrollbar space-y-4">
                  {filteredAvailableServices.length === 0 ? (
                    <div className="py-20 text-center opacity-70">
                      <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-dark-800 flex items-center justify-center mx-auto mb-4">
                        <Search size={32} className="text-neutral-300" />
                      </div>
                      <p className="text-sm font-bold text-neutral-600 dark:text-neutral-400 max-w-[200px] mx-auto leading-relaxed">
                        {searchTerm ? t('No matches found for your search.') : t('Incredible! You are offering all available services.')}
                      </p>
                    </div>
                  ) : (
                    <AnimatePresence>
                      {filteredAvailableServices.map((service) => (
                        <Motion.div 
                          key={service.id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="group flex flex-col p-5 rounded-2xl border border-neutral-200 dark:border-dark-700 bg-white dark:bg-dark-800 hover:border-brand-300 dark:hover:border-brand-500/50 transition-all shadow-sm hover:shadow-xl hover:-translate-y-1 duration-300"
                        >
                          <div className="flex justify-between items-start gap-3">
                            <div>
                              <p className="font-bold text-neutral-900 dark:text-white leading-tight mb-2 group-hover:text-brand-500 transition-colors">
                                {service.name}
                              </p>
                              {service.category && (
                                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-500">
                                  {t(service.category)}
                                </span>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="shrink-0 h-9 px-4 rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-brand-500 hover:text-white hover:border-brand-500 transition-all"
                              icon={PlusCircle}
                              loading={addMutation.isPending && addMutation.variables === service.id}
                              onClick={() => addMutation.mutate(service.id)}
                            >
                              {t('Add')}
                            </Button>
                          </div>
                        </Motion.div>
                      ))}
                    </AnimatePresence>
                  )}
                </div>
              </Card>
            </Motion.div>


          </div>
        </AsyncState>
      </div>
    </MainLayout>
  );
}
