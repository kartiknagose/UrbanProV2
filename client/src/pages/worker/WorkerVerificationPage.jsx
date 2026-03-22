import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardDescription } from '../../components/common';
import { AsyncState, PageHeader, VerificationStatusBadge } from '../../components/common';
import { getMyVerification } from '../../api/verification';
import { getPageLayout } from '../../constants/layout';
import { queryKeys } from '../../utils/queryKeys';
import { usePageTitle } from '../../hooks/usePageTitle';
import { WorkerOnboardingWizard } from '../../components/features/worker/WorkerOnboardingWizard';

export function WorkerVerificationPage() {
  const { t, i18n } = useTranslation();
  usePageTitle(t('Verification'));

  const formatSubmittedAt = (value) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleString(i18n.language);
  };

  const formatDocumentType = (value) => String(value || '').replace(/_/g, ' ').trim() || t('Unknown');

  const verificationQuery = useQuery({
    queryKey: queryKeys.verification.my(),
    queryFn: getMyVerification,
  });

  const application = verificationQuery.data?.application || null;
  const canApply = !application || ['REJECTED', 'MORE_INFO'].includes(application.status);

  return (
    <MainLayout>
      <div className={getPageLayout('narrow')}>
        <PageHeader
          title={t("Verification")}
          subtitle={t("Submit your verification request to build customer trust.")}
        />

        <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-8">
          {/* Status Card */}
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>{t('Status')}</CardTitle>
              <CardDescription>{t('Track your verification progress.')}</CardDescription>
            </CardHeader>
            <AsyncState
              isLoading={verificationQuery.isLoading}
              isError={verificationQuery.isError}
              error={verificationQuery.error}
              errorFallback={
                <div className="px-6 pb-6">
                  <p className="text-sm text-error-500">
                    {verificationQuery.error?.response?.data?.error || verificationQuery.error?.message || t('Failed to load verification.')}
                  </p>
                </div>
              }
            >
              <div className="px-6 pb-6 space-y-6">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${application?.status === 'APPROVED'
                    ? 'bg-success-100 text-success-600'
                    : application?.status === 'REJECTED'
                      ? 'bg-error-100 text-error-600'
                      : 'bg-brand-100 text-brand-600'
                    }`}>
                    {application?.status === 'APPROVED' ? <CheckCircle2 size={24} /> : <ShieldCheck size={24} />}
                  </div>
                  <div>
                    <p className="font-bold text-gray-800 dark:text-gray-100">
                      {application ? t('Application Submitted') : t('Not Submitted')}
                    </p>
                    {application && (
                      <VerificationStatusBadge status={application.status} className="mt-1" />
                    )}
                  </div>
                </div>

                {application?.notes && (
                  <div className="p-3 rounded-lg text-sm bg-gray-50 text-gray-600 dark:bg-dark-800 dark:text-gray-300">
                    <span className="font-semibold block mb-1">{t('Your Note:')}</span>
                    {application.notes}
                  </div>
                )}

                {application?.rejectionReason && (
                  <div className="p-3 rounded-lg bg-error-50 text-error-700 text-sm border border-error-100">
                    <span className="font-bold block mb-1 flex items-center gap-1"><AlertCircle size={12} /> {t('Admin Feedback:')}</span>
                    {application.rejectionReason}
                  </div>
                )}

                {application?.submittedAt && (
                  <div className="text-gray-500 text-xs dark:text-gray-400">
                    {t('Submitted on')} {formatSubmittedAt(application.submittedAt)}
                  </div>
                )}

                {/* Document summary from application */}
                {application?.documents && application.documents.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{t('Submitted Documents')}</p>
                    <div className="space-y-2">
                      {application.documents.map((doc) => (
                        <div key={doc.id} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <CheckCircle2 size={14} className="text-success-500 shrink-0" />
                          <span>{formatDocumentType(doc.type)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </AsyncState>
          </Card>

          {/* Main Content — Wizard or Status */}
          <div>
            {!canApply ? (
              <Card>
                <div className="p-8 text-center">
                   {application?.status === 'APPROVED' ? (
                    <>
                      <div className="w-16 h-16 bg-success-50 text-success-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 size={32} />
                      </div>
                      <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">{t('Identity Verified')}</h3>
                      <p className="text-gray-500 dark:text-gray-400">
                        {t('Congratulations! Your profile has been verified. You can now accept bookings and offer services.')}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 bg-brand-50 text-brand-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                      </div>
                      <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">{t('Application Under Review')}</h3>
                      <p className="text-gray-500 dark:text-gray-400">
                        {t('Your verification request is currently being reviewed by our team. We will notify you once a decision is made.')}
                      </p>
                    </>
                  )}
                </div>
              </Card>
            ) : (
              <WorkerOnboardingWizard
                onComplete={() => {
                  verificationQuery.refetch();
                }}
              />
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
