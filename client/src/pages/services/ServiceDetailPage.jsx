// Service detail page with wizard-style booking flow

import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { toast } from 'sonner';

import { MainLayout } from '../../components/layout/MainLayout';
import { Button, Spinner, ConfirmDialog, Breadcrumbs } from '../../components/common';
import { useAuth } from '../../hooks/useAuth';
import { getServiceById, getServiceWorkers } from '../../api/services';
import { createBooking } from '../../api/bookings';
import { queryKeys } from '../../utils/queryKeys';
import { getPageLayout } from '../../constants/layout';
import { ServiceHeader } from './components/ServiceHeader';
import { BookingWizard } from '../../components/features/bookings/BookingWizard';
import { usePageTitle } from '../../hooks/usePageTitle';

export function ServiceDetailPage() {
  usePageTitle('Service Details');
  const queryClient = useQueryClient();
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [profileSetupDialog, setProfileSetupDialog] = useState(false);

  const preselectedWorker = searchParams.get('worker');

  const { data: service, isLoading, isError, error } = useQuery({
    queryKey: queryKeys.services.detail(id),
    queryFn: async () => {
      const data = await getServiceById(id);
      return data.service || data;
    },
    enabled: Boolean(id),
  });

  const { data: workersData } = useQuery({
    queryKey: queryKeys.services.workers(id),
    queryFn: async () => {
      const data = await getServiceWorkers(id);
      return data.workers || data;
    },
    enabled: Boolean(id),
    staleTime: 5 * 60 * 1000,
  });

  const initialWorker = preselectedWorker
    ? (workersData || []).find((worker) => String(worker.id) === String(preselectedWorker)) || null
    : null;

  const createBookingMutation = useMutation({
    mutationFn: (bookingData) => createBooking(bookingData),
  });

  const handleWizardSubmit = async (bookingData) => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/services/${id}` } });
      return;
    }

    if (!user?.isProfileComplete) {
      setProfileSetupDialog(true);
      return;
    }

    const response = await createBookingMutation.mutateAsync({
      ...bookingData,
      serviceId: Number(id),
    });

    queryClient.invalidateQueries({ queryKey: queryKeys.bookings.customer() });
    queryClient.invalidateQueries({ queryKey: queryKeys.bookings.worker() });
    queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all() });

    const createdBookingId = response?.booking?.id || response?.id;

    toast.success('Booking created successfully!');

    if (user?.role === 'WORKER') {
      navigate('/services');
      return;
    }

    if (createdBookingId) {
      navigate(`/customer/bookings/${createdBookingId}`);
      return;
    }

    navigate('/customer/bookings');
  };

  return (
    <MainLayout>
      <div className="min-h-screen pb-20 bg-gray-50 dark:bg-dark-950">
        <div className="absolute top-0 left-0 right-0 h-[500px] overflow-hidden pointer-events-none">
          <div className="absolute -top-[50%] -left-[20%] w-[70%] h-[200%] rounded-full blur-[100px] opacity-20 bg-brand-200 dark:bg-brand-900" />
          <div className="absolute top-0 right-0 w-[50%] h-[100%] rounded-full blur-[120px] opacity-20 bg-blue-200 dark:bg-blue-900" />
        </div>

        <div className={`${getPageLayout('wide')} module-canvas module-canvas--services relative z-10`}>
          <Breadcrumbs
            items={[
              { label: 'Services', to: '/services' },
              { label: service?.name || 'Service Details' },
            ]}
          />

          {isLoading && (
            <div className="flex flex-col items-center justify-center py-32">
              <Spinner size="xl" className="text-brand-500" />
              <p className="mt-4 text-gray-500 font-medium animate-pulse">Preparing booking wizard...</p>
            </div>
          )}

          {isError && (
            <div className="max-w-lg mx-auto mt-20 text-center">
              <div className="w-20 h-20 bg-error-50 text-error-500 rounded-3xl flex items-center justify-center mx-auto mb-6 dark:bg-error-900/20">
                <FileText size={40} />
              </div>
              <h3 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">Service Not Found</h3>
              <p className="mb-8 text-gray-600 dark:text-gray-400">{error?.message || 'We could not find the service you are looking for.'}</p>
              <Button onClick={() => navigate('/services')} variant="outline" size="lg">Browse All Services</Button>
            </div>
          )}

          {service && (
            <div className="space-y-8">
              <ServiceHeader service={service} />

              <div className="bg-white dark:bg-dark-900 rounded-2xl shadow-lg p-6 sm:p-8 overflow-hidden">
                <BookingWizard
                  onSuccess={handleWizardSubmit}
                  initialService={service}
                  initialWorker={initialWorker}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={profileSetupDialog}
        onConfirm={() => {
          navigate(user?.role === 'WORKER' ? '/worker/profile' : '/customer/profile', {
            state: { from: `/services/${id}` },
          });
        }}
        onCancel={() => setProfileSetupDialog(false)}
        title="Complete Your Profile"
        message="You need to complete your profile details before booking a service. Would you like to do that now?"
        confirmText="Complete Profile"
        cancelText="Later"
        variant="primary"
      />
    </MainLayout>
  );
}
