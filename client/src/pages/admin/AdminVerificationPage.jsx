// Admin verification management page
// Review worker verification applications with inline document viewer

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, XCircle, AlertTriangle, FileText, ExternalLink, ZoomIn, X } from 'lucide-react';
import { MainLayout } from '../../components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardDescription, Input } from '../../components/common';
import { Badge, Button, AsyncState, PageHeader, VerificationStatusBadge, Pagination } from '../../components/common';
import { getVerificationApplications, reviewVerificationApplication } from '../../api/verification';
import { resolveProfilePhotoUrl } from '../../utils/profilePhoto';
import { getPageLayout } from '../../constants/layout';
import { queryKeys } from '../../utils/queryKeys';
import { useSocketEvent } from '../../hooks/useSocket';
import { toast } from 'sonner';
import { usePageTitle } from '../../hooks/usePageTitle';
import { asArray } from '../../utils/safeData';

const statusFilters = ['ALL', 'PENDING', 'APPROVED', 'REJECTED'];

export function AdminVerificationPage() {
  usePageTitle('Verification Requests');
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState({});
  const [modalDoc, setModalDoc] = useState(null);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.verification.applications(),
    queryFn: getVerificationApplications,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, payload }) => reviewVerificationApplication(id, payload),
    onSuccess: (_, { payload }) => {
      toast.success(`Verification ${payload.status.toLowerCase()}`);
      queryClient.invalidateQueries({ queryKey: queryKeys.verification.applications() });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to review application'),
  });

  const applications = asArray(data?.applications);
  const filteredApplications = statusFilter === 'ALL'
    ? applications
    : applications.filter((app) => app.status === statusFilter);

  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(filteredApplications.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedApplications = filteredApplications.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const refreshVerificationData = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.verification.applications() });
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.verificationPreview() });
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.dashboard() });
  };

  useSocketEvent('verification:created', refreshVerificationData);
  useSocketEvent('verification:updated', refreshVerificationData);

  const handleReview = (id, status) => {
    reviewMutation.mutate({
      id,
      payload: {
        status,
        notes: notes[id] || undefined,
      },
    });
  };

  return (
    <MainLayout>
      <div className={getPageLayout('default')}>
        <PageHeader
          title="Verification Requests"
          subtitle="Review worker verification applications and update status."
        />

        <div role="radiogroup" aria-label="Verification status filter" className="flex flex-wrap gap-2 mb-6">
          {statusFilters.map((s) => (
            <Button
              key={s}
              size="sm"
              role="radio"
              aria-checked={statusFilter === s}
              variant={statusFilter === s ? 'primary' : 'outline'}
              onClick={() => { setStatusFilter(s); setPage(1); }}
            >
              {s}
            </Button>
          ))}
        </div>

        <AsyncState
          isLoading={isLoading}
          isError={isError}
          error={error}
          onRetry={refetch}
          isEmpty={!isLoading && !isError && filteredApplications.length === 0}
          emptyTitle={statusFilter === 'ALL' ? "No verification requests" : `No ${statusFilter.toLowerCase()} requests`}
          emptyMessage="Worker applications will appear here once submitted."
          errorFallback={
            <Card className="p-6">
              <p className="text-error-500 mb-3">
                {error?.response?.data?.error || error?.message || 'Failed to load verification requests.'}
              </p>
              <button
                type="button"
                className="text-sm text-brand-500"
                onClick={() => refetch()}
              >
                Retry
              </button>
            </Card>
          }
        >
          <div className="grid grid-cols-1 gap-6">
            {paginatedApplications.map((application) => (
              <Card key={application.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>
                        {application.user?.name || 'Worker'}
                      </CardTitle>
                      <CardDescription>
                        Submitted: {new Date(application.submittedAt).toLocaleString()}
                      </CardDescription>
                    </div>
                    <VerificationStatusBadge status={application.status} />
                  </div>
                </CardHeader>

                <div className="px-6 pb-6 space-y-6">
                  {/* User Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-300">
                    <div>
                      <span className="font-semibold block text-xs uppercase tracking-wider mb-1 opacity-70">Contact Info</span>
                      <p>Email: {application.user?.email || 'N/A'}</p>
                      <p>Mobile: {application.user?.mobile || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="font-semibold block text-xs uppercase tracking-wider mb-1 opacity-70">Application Details</span>
                      <p>Score: {application.score ?? 'N/A'}</p>
                      <p>App ID: #{application.id}</p>
                    </div>
                  </div>

                  {/* Documents Section — Inline Document Viewer */}
                  {asArray(application.documents).length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-3 text-gray-800 dark:text-gray-200">Submitted Documents</h4>
                      <div className="flex flex-wrap gap-4">
                        {asArray(application.documents).map((doc) => {
                          const docUrl = resolveProfilePhotoUrl(doc.url);
                          const isPdf = doc.url.toLowerCase().endsWith('.pdf');
                          return (
                            <div key={doc.id} className="group relative">
                              <button
                                type="button"
                                className="block w-32 h-32 rounded-lg border overflow-hidden relative border-gray-200 bg-gray-50 dark:border-dark-600 dark:bg-dark-800 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all hover:shadow-lg"
                                onClick={() => setModalDoc({ ...doc, url: docUrl, isPdf })}
                              >
                                {isPdf ? (
                                  <div className="flex flex-col items-center justify-center w-full h-full text-gray-400">
                                    <FileText size={32} />
                                    <span className="text-xs font-bold mt-2">PDF</span>
                                  </div>
                                ) : (
                                  <img
                                    src={docUrl}
                                    alt={doc.type}
                                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                    loading="lazy"
                                  />
                                )}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                  <ZoomIn size={24} className="text-white drop-shadow-md" />
                                </div>
                              </button>
                              <p className="text-xs mt-1.5 font-medium truncate w-32 text-gray-600 dark:text-gray-400">
                                {doc.type.replace(/_/g, ' ')}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Worker Notes */}
                  {application.notes && (
                    <div className="p-4 rounded-lg text-sm bg-gray-50 text-gray-600 dark:bg-dark-800 dark:text-gray-300">
                      <span className="font-semibold block mb-1 text-xs uppercase opacity-70">Worker Note</span>
                      {application.notes}
                    </div>
                  )}

                  {/* Admin Action Area */}
                  {application.status !== 'APPROVED' && application.status !== 'REJECTED' && (
                    <div className="pt-4 border-t border-gray-100 dark:border-dark-700">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                        Review Notes / Rejection Reason
                      </label>
                      <div className="flex gap-4 items-start">
                        <Input
                          value={notes[application.id] || ''}
                          onChange={(event) => setNotes((prev) => ({ ...prev, [application.id]: event.target.value }))}
                          placeholder="Enter feedback..."
                          className="flex-1"
                        />
                      </div>
                      <div className="flex flex-wrap gap-3 mt-4">
                        <Button
                          size="sm"
                          icon={ShieldCheck}
                          loading={reviewMutation.isPending && reviewMutation.variables?.id === application.id && reviewMutation.variables?.payload.status === 'APPROVED'}
                          onClick={() => handleReview(application.id, 'APPROVED')}
                          disabled={reviewMutation.isPending}
                          className="bg-success-600 hover:bg-success-700 text-white"
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          icon={AlertTriangle}
                          loading={reviewMutation.isPending && reviewMutation.variables?.id === application.id && reviewMutation.variables?.payload.status === 'MORE_INFO'}
                          onClick={() => handleReview(application.id, 'MORE_INFO')}
                          disabled={reviewMutation.isPending}
                        >
                          Request More Info
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          icon={XCircle}
                          loading={reviewMutation.isPending && reviewMutation.variables?.id === application.id && reviewMutation.variables?.payload.status === 'REJECTED'}
                          onClick={() => handleReview(application.id, 'REJECTED')}
                          disabled={reviewMutation.isPending}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
          <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} totalItems={filteredApplications.length} pageSize={PAGE_SIZE} />
        </AsyncState>
      </div>

      {/* Document Preview Modal — Inline Viewer for KYC Documents */}
      {modalDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setModalDoc(null)}>
          <div className="bg-white dark:bg-dark-900 rounded-xl shadow-2xl max-w-3xl w-full mx-4 relative animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-dark-700">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                  {modalDoc.type.replace(/_/g, ' ')}
                </h3>
                <p className="text-xs text-gray-400">Click outside or press × to close</p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={modalDoc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                  title="Open in new tab"
                >
                  <ExternalLink size={18} className="text-gray-500" />
                </a>
                <button
                  className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                  onClick={() => setModalDoc(null)}
                  aria-label="Close"
                >
                  <X size={18} className="text-gray-500" />
                </button>
              </div>
            </div>
            {/* Content */}
            <div className="p-4">
              {modalDoc.isPdf ? (
                <iframe
                  src={modalDoc.url}
                  title="Document PDF"
                  className="w-full border rounded-lg"
                  style={{ minHeight: 500 }}
                />
              ) : (
                <div className="flex items-center justify-center bg-gray-50 dark:bg-dark-800 rounded-lg p-2">
                  <img
                    src={modalDoc.url}
                    alt={modalDoc.type}
                    className="max-w-full max-h-[70vh] object-contain rounded"
                    loading="lazy"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
