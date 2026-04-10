import { useState, useCallback, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

import { Modal, Button, Input, ImageUpload } from '../../common';
import { verifyBookingStart, verifyBookingCompletion, refreshBookingOtp } from '../../../api/bookings';
import { uploadBookingPhoto } from '../../../api/uploads';
import { SafetyGuidelinesCard } from '../safety/SafetyGuidelinesCard';

/**
 * Shared OTP Verification Modal used across worker pages.
 */
export function OtpVerificationModal({ isOpen, onClose, otpAction, bookingId, invalidateKeys = [], onSuccess }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [otpCode, setOtpCode] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    setResendCooldown(0);
  }, [isOpen, bookingId, otpAction]);

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const resetState = useCallback(() => {
    setOtpCode('');
    setSelectedFile(null);
    setIsUploading(false);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  const verifyStartMutation = useMutation({
    mutationFn: ({ bookingId: bId, otp }) => verifyBookingStart(bId, otp),
    onSuccess: () => {
      invalidateKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
      toast.success(t('Work started successfully!'));
      resetState();
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      const msg = error.response?.data?.error || error.response?.data?.message || t('Invalid OTP');
      toast.error(msg);
    },
  });

  const verifyCompleteMutation = useMutation({
    mutationFn: ({ bookingId: bId, otp }) => verifyBookingCompletion(bId, otp),
    onSuccess: () => {
      invalidateKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
      toast.success(t('Job completed successfully!'));
      resetState();
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      const msg = error.response?.data?.error || error.response?.data?.message || t('Invalid OTP');
      toast.error(msg);
    },
  });

  const refreshOtpMutation = useMutation({
    mutationFn: ({ bookingId: bId, type }) => refreshBookingOtp(bId, type),
    onSuccess: (result) => {
      setOtpCode('');
      setResendCooldown(30);
      const otpLabel = result?.otpType === 'COMPLETE' ? t('completion') : t('start');
      toast.success(t('New {{type}} OTP sent to customer. Ask them to check Booking Details.', { type: otpLabel }));
    },
    onError: (error) => {
      const msg = error.response?.data?.error || error.response?.data?.message || t('Failed to refresh OTP. Please try again.');
      toast.error(msg);
    },
  });

  const handleRefreshOtp = () => {
    if (!bookingId) {
      toast.error(t('No booking selected. Please close and try again.'));
      return;
    }

    const type = otpAction === 'complete' ? 'COMPLETE' : 'START';
    refreshOtpMutation.mutate({ bookingId, type });
  };

  const handleSubmit = async () => {
    if (!bookingId) {
      toast.error(t('No booking selected. Please close and try again.'));
      return;
    }
    if (!selectedFile) {
      toast.error(t('Please upload a {{type}} photo as proof.', { type: t(otpAction === 'start' ? 'BEFORE' : 'AFTER') }));
      return;
    }
    if (!otpCode || otpCode.length < 4) {
      toast.error(t('Please enter a valid 4-digit OTP.'));
      return;
    }

    setIsUploading(true);
    try {
      const photoType = otpAction === 'start' ? 'BEFORE' : 'AFTER';
      await uploadBookingPhoto(selectedFile, bookingId, photoType);

      if (otpAction === 'start') {
        await verifyStartMutation.mutateAsync({ bookingId, otp: otpCode });
      } else {
        await verifyCompleteMutation.mutateAsync({ bookingId, otp: otpCode });
      }
    } catch {
      // Mutation onError handles the toast for verify failures.
    } finally {
      setIsUploading(false);
    }
  };

  const isPending = isUploading || verifyStartMutation.isPending || verifyCompleteMutation.isPending;
  const isRefreshPending = refreshOtpMutation.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={otpAction === 'start' ? t('Start Verification') : t('Completion Verification')}
      size="sm"
    >
      <div className="space-y-3 max-h-[68vh] overflow-y-auto pr-1 custom-scrollbar">
        {otpAction === 'start' && (
          <SafetyGuidelinesCard role="WORKER" compact />
        )}

        {/* Step 1: Photo Evidence */}
        <div className="p-3 rounded-xl border bg-brand-50 dark:bg-brand-900/10 border-brand-100 dark:border-brand-800">
          <p className="text-xs font-black uppercase tracking-widest text-brand-800 dark:text-brand-300">
            {t('Step 1: Visual Proof')}
          </p>
          <p className="text-[11px] mt-1 text-brand-600 dark:text-brand-400">
            {t('Please upload a photo of the')} {otpAction === 'start' ? t('work area') : t('finished result')}.
          </p>
        </div>

        <ImageUpload
          label={otpAction === 'start' ? t('Before photo (capture or upload)') : t('After photo (capture or upload)')}
          onUpload={setSelectedFile}
          value={selectedFile}
        />

        {/* Step 2: OTP Input */}
        <div className="border-t pt-4 border-gray-100 dark:border-dark-700">
          <p className="text-xs font-black uppercase tracking-widest mb-2 text-gray-700 dark:text-gray-200">
            {t('Step 2: Customer OTP')}
          </p>
          <Input
            label={t("Customer OTP")}
            placeholder="0000"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            size="compact"
            className="max-w-[280px] mx-auto"
            inputClassName="text-center text-sm tracking-[0.24em] font-semibold"
            maxLength={4}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            hint={t('Ask customer for the 4-digit code')}
          />
          <div className="mt-2 flex items-center justify-center">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRefreshOtp}
              loading={isRefreshPending}
              disabled={isRefreshPending || resendCooldown > 0}
              className="h-8 px-3 text-[11px] font-bold uppercase tracking-wider"
            >
              {resendCooldown > 0
                ? t('Resend OTP in {{seconds}}s', { seconds: resendCooldown })
                : t('Resend OTP to Customer')}
            </Button>
          </div>
          <p className="mt-1 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            {t('New code is shown on customer booking details and sent by SMS (if enabled).')}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2 pb-1">
          <Button variant="ghost" fullWidth onClick={handleClose} className="h-11 font-bold">
            {t('Cancel')}
          </Button>
          <Button
            fullWidth
            onClick={handleSubmit}
            loading={isPending}
            disabled={!selectedFile || otpCode.length < 4}
            className="h-11 bg-brand-600 text-white shadow-xl shadow-brand-500/20 text-sm font-bold whitespace-nowrap"
          >
            {t('Verify & Proceed')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
