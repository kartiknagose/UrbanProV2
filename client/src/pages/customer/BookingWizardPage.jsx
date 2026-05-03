import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { MainLayout } from '../../components/layout/MainLayout';
import { PageHeader, Button } from '../../components/common';
import { BookingWizard } from '../../components/features/bookings/BookingWizard';
import { createBooking } from '../../api/bookings';
import { queryKeys } from '../../utils/queryKeys';
import { toast } from 'sonner';
import { usePageTitle } from '../../hooks/usePageTitle';

export function BookingWizardPage() {
  const { t } = useTranslation();
  usePageTitle(t('Create Booking'));
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createBookingMutation = useMutation({
    mutationFn: (bookingData) => createBooking(bookingData),
    onSuccess: (data) => {
      const createdBookingId = data?.booking?.id || data?.id;
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.customer() });
      toast.success(t('Booking created successfully! Redirecting...'));
      setTimeout(() => {
        if (createdBookingId) {
          navigate(`/customer/bookings/${createdBookingId}`);
        } else {
          navigate('/customer/bookings');
        }
      }, 1500);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || error.response?.data?.error || t('Failed to create booking'));
    },
  });

  return (
    <MainLayout>
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-dark-950 dark:to-dark-900">
        {/* Header with close button */}
        <div className="sticky top-0 z-50 bg-white/80 dark:bg-dark-950/80 backdrop-blur-md border-b border-neutral-200 dark:border-dark-700">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-black text-neutral-900 dark:text-white">
                {t('Complete Your Booking')}
              </h1>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                {t('Follow the steps to request a service from trusted experts')}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon={X}
              onClick={() => navigate('/customer/dashboard')}
            >
              {t('Close')}
            </Button>
          </div>
        </div>

        {/* Wizard Container */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white dark:bg-dark-900 rounded-2xl shadow-lg p-8 overflow-hidden">
            <BookingWizard
              onSuccess={async (bookingData) => {
                await createBookingMutation.mutateAsync(bookingData);
              }}
              onCancel={() => navigate('/customer/dashboard')}
            />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
