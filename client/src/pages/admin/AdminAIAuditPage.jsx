import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bot, RefreshCw } from 'lucide-react';
import { MainLayout } from '../../components/layout/MainLayout';
import { getPageLayout } from '../../constants/layout';
import { IMAGES } from '../../constants/images';
import { usePageTitle } from '../../hooks/usePageTitle';
import { getAiAuditSummary, getAiAudits } from '../../api/admin';
import { queryKeys } from '../../utils/queryKeys';
import { Badge, Button, Card, CardDescription, CardTitle, Modal, PageHeader, Spinner, StatCard } from '../../components/common';

function formatDateTime(value) {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleString();
}

export function AdminAIAuditPage() {
  usePageTitle('AI Action Audit');

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [channelFilter, setChannelFilter] = useState('ALL');
  const [intentFilter, setIntentFilter] = useState('');
  const [userIdFilter, setUserIdFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedAudit, setSelectedAudit] = useState(null);

  const summaryQuery = useQuery({
    queryKey: queryKeys.admin.aiAuditSummary(),
    queryFn: async () => {
      try {
        return await getAiAuditSummary();
      } catch {
        return { summary: null, softError: true };
      }
    },
    refetchInterval: 30000,
    retry: 1,
  });

  const auditParams = useMemo(() => {
    const params = { limit: 50, page: 1 };
    if (statusFilter !== 'ALL') params.status = statusFilter;
    if (channelFilter !== 'ALL') params.channel = channelFilter;
    if (intentFilter.trim()) params.intent = intentFilter.trim().toLowerCase();
    if (userIdFilter.trim()) params.userId = userIdFilter.trim();
    if (fromDate) params.from = new Date(`${fromDate}T00:00:00`).toISOString();
    if (toDate) params.to = new Date(`${toDate}T23:59:59`).toISOString();
    return params;
  }, [statusFilter, channelFilter, intentFilter, userIdFilter, fromDate, toDate]);

  const auditsQuery = useQuery({
    queryKey: queryKeys.admin.aiAudits(auditParams),
    queryFn: () => getAiAudits(auditParams),
    refetchInterval: 15000,
  });

  const summary = summaryQuery.data?.summary;
  const isSummaryFallbackMode = Boolean(summaryQuery.data?.softError);
  const audits = Array.isArray(auditsQuery.data?.audits) ? auditsQuery.data.audits : [];

  const fallbackSummary = (() => {
    if (!Array.isArray(audits) || audits.length === 0) {
      return {
        total: 0,
        failed: 0,
        declined: 0,
        byIntent: [],
      };
    }

    const intentCounter = new Map();
    let failed = 0;
    let declined = 0;

    for (const row of audits) {
      const status = String(row?.status || '').toUpperCase();
      if (status === 'FAILED') failed += 1;
      if (status === 'DECLINED') declined += 1;

      const intent = String(row?.intent || '').trim() || 'unknown';
      intentCounter.set(intent, (intentCounter.get(intent) || 0) + 1);
    }

    const byIntent = [...intentCounter.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([intent, count]) => ({ intent, count }));

    return {
      total: audits.length,
      failed,
      declined,
      byIntent,
    };
  })();

  const displaySummary = summary || fallbackSummary;

  const formatJsonValue = (value) => {
    if (value == null) return '-';
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  };

  const exportCsv = () => {
    if (!audits.length) return;

    const escapeCsv = (value) => {
      const text = String(value ?? '');
      if (/[",\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };

    const header = ['id', 'createdAt', 'userId', 'userName', 'userEmail', 'intent', 'action', 'channel', 'status', 'durationMs', 'requestText', 'error'];
    const rows = audits.map((row) => [
      row.id,
      row.createdAt,
      row.userId,
      row.user?.name || '',
      row.user?.email || '',
      row.intent,
      row.action || '',
      row.channel,
      row.status,
      row.durationMs ?? '',
      row.requestText || '',
      row.error || '',
    ]);

    const csv = [header, ...rows].map((line) => line.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ai-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <MainLayout>
      <div className={`${getPageLayout('default')} module-canvas module-canvas--utility`}>
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <PageHeader
            title="AI Action Audit"
            subtitle="Persistent, searchable audit trail for AI chat and voice actions."
            className="mb-0"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void summaryQuery.refetch();
              void auditsQuery.refetch();
            }}
            icon={RefreshCw}
          >
            Refresh
          </Button>
        </div>

        {summaryQuery.isLoading ? (
          <div className="mb-6 flex justify-center py-6">
            <Spinner size="md" />
          </div>
        ) : null}

        {isSummaryFallbackMode ? (
          <Card className="mb-6 border border-warning-200 bg-warning-50/60 p-3 dark:border-warning-700/30 dark:bg-warning-900/10">
            <p className="text-xs font-medium text-warning-800 dark:text-warning-300">
              Summary API is temporarily unavailable. Showing live stats from the table below.
            </p>
          </Card>
        ) : null}

        <Card className="mb-6 overflow-hidden p-0">
          <div className="relative h-36 w-full">
            <img
              src={IMAGES.CATEGORY_ELECTRICAL}
              alt="AI audit monitoring"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-dark-950/70 via-dark-900/40 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Admin Monitoring</p>
              <h3 className="text-sm font-bold text-white">AI Audit Timeline and Action Trace</h3>
            </div>
          </div>
        </Card>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Actions" value={displaySummary?.total || 0} icon={Bot} color="brand" />
          <StatCard title="Failures" value={displaySummary?.failed || 0} icon={Bot} color="error" />
          <StatCard title="Declined" value={displaySummary?.declined || 0} icon={Bot} color="warning" />
          <Card className="p-4">
            <CardTitle className="mb-1 text-sm">Top Intent</CardTitle>
            <CardDescription>
              {displaySummary?.byIntent?.[0]
                ? `${displaySummary.byIntent[0].intent} (${displaySummary.byIntent[0].count})`
                : 'No data yet'}
            </CardDescription>
          </Card>
        </div>

        <Card className="mb-6 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs font-semibold text-neutral-500">Status</label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-9 rounded-lg border border-neutral-300 px-2 text-sm dark:border-dark-600 dark:bg-dark-900"
            >
              <option value="ALL">All</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILED">Failed</option>
              <option value="DECLINED">Declined</option>
            </select>

            <label className="text-xs font-semibold text-neutral-500">Channel</label>
            <select
              value={channelFilter}
              onChange={(event) => setChannelFilter(event.target.value)}
              className="h-9 rounded-lg border border-neutral-300 px-2 text-sm dark:border-dark-600 dark:bg-dark-900"
            >
              <option value="ALL">All</option>
              <option value="CHAT">Chat</option>
              <option value="VOICE">Voice</option>
            </select>

            <label className="text-xs font-semibold text-neutral-500">Intent</label>
            <input
              value={intentFilter}
              onChange={(event) => setIntentFilter(event.target.value)}
              placeholder="e.g. view_wallet"
              className="h-9 rounded-lg border border-neutral-300 px-2 text-sm dark:border-dark-600 dark:bg-dark-900"
            />

            <label className="text-xs font-semibold text-neutral-500">User ID</label>
            <input
              value={userIdFilter}
              onChange={(event) => setUserIdFilter(event.target.value)}
              placeholder="e.g. 3"
              className="h-9 w-24 rounded-lg border border-neutral-300 px-2 text-sm dark:border-dark-600 dark:bg-dark-900"
            />

            <label className="text-xs font-semibold text-neutral-500">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="h-9 rounded-lg border border-neutral-300 px-2 text-sm dark:border-dark-600 dark:bg-dark-900"
            />

            <label className="text-xs font-semibold text-neutral-500">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="h-9 rounded-lg border border-neutral-300 px-2 text-sm dark:border-dark-600 dark:bg-dark-900"
            />

            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setStatusFilter('ALL');
                setChannelFilter('ALL');
                setIntentFilter('');
                setUserIdFilter('');
                setFromDate('');
                setToDate('');
              }}
            >
              Reset Filters
            </Button>

            <Button size="sm" variant="outline" onClick={exportCsv}>
              Export CSV
            </Button>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between p-5 pb-0">
            <div>
              <CardTitle className="mb-0.5">Recent AI Actions</CardTitle>
              <CardDescription>Latest 50 records based on active filters.</CardDescription>
            </div>
          </div>

          <div className="p-5 pt-4">
            {auditsQuery.isLoading && (
              <div className="flex justify-center py-8">
                <Spinner size="lg" />
              </div>
            )}

            {!auditsQuery.isLoading && audits.length === 0 && (
              <p className="py-8 text-center text-sm text-neutral-500">No audit rows found for the selected filters.</p>
            )}

            {!auditsQuery.isLoading && audits.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="text-xs uppercase text-neutral-500">
                    <tr>
                      <th className="py-2 pr-3">Time</th>
                      <th className="py-2 pr-3">User</th>
                      <th className="py-2 pr-3">Intent</th>
                      <th className="py-2 pr-3">Action</th>
                      <th className="py-2 pr-3">Channel</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Duration</th>
                      <th className="py-2">Request</th>
                      <th className="py-2 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audits.map((row) => (
                      <tr key={row.id} className="border-t border-neutral-100 dark:border-dark-700">
                        <td className="py-2 pr-3 align-top">{formatDateTime(row.createdAt)}</td>
                        <td className="py-2 pr-3 align-top">
                          <div className="font-medium">{row.user?.name || `User ${row.userId}`}</div>
                          <div className="text-xs text-neutral-500">{row.user?.email || 'N/A'}</div>
                        </td>
                        <td className="py-2 pr-3 align-top">{row.intent}</td>
                        <td className="py-2 pr-3 align-top">{row.action || '-'}</td>
                        <td className="py-2 pr-3 align-top">{row.channel}</td>
                        <td className="py-2 pr-3 align-top">
                          <Badge
                            variant={row.status === 'FAILED' ? 'error' : row.status === 'DECLINED' ? 'warning' : 'success'}
                            size="xs"
                          >
                            {row.status}
                          </Badge>
                        </td>
                        <td className="py-2 pr-3 align-top">{row.durationMs != null ? `${row.durationMs} ms` : '-'}</td>
                        <td className="max-w-[320px] py-2 align-top text-xs text-neutral-600 dark:text-neutral-300">
                          <div className="truncate">{row.requestText || '-'}</div>
                          {row.error ? <div className="mt-1 text-error-500">{row.error}</div> : null}
                        </td>
                        <td className="py-2 text-right align-top">
                          <Button size="sm" variant="outline" onClick={() => setSelectedAudit(row)}>
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>

        <Modal
          isOpen={Boolean(selectedAudit)}
          onClose={() => setSelectedAudit(null)}
          title={selectedAudit ? `Audit #${selectedAudit.id}` : 'Audit Details'}
          size="xl"
        >
          {selectedAudit ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2 rounded-xl border border-neutral-200 p-4 dark:border-dark-700">
                <h3 className="text-sm font-semibold">Overview</h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-300">Time: {formatDateTime(selectedAudit.createdAt)}</p>
                <p className="text-xs text-neutral-600 dark:text-neutral-300">Session: {selectedAudit.sessionId || '-'}</p>
                <p className="text-xs text-neutral-600 dark:text-neutral-300">User: {selectedAudit.user?.name || `User ${selectedAudit.userId}`} ({selectedAudit.user?.email || 'N/A'})</p>
                <p className="text-xs text-neutral-600 dark:text-neutral-300">Role: {selectedAudit.role || '-'}</p>
                <p className="text-xs text-neutral-600 dark:text-neutral-300">Intent: {selectedAudit.intent || '-'}</p>
                <p className="text-xs text-neutral-600 dark:text-neutral-300">Action: {selectedAudit.action || '-'}</p>
                <p className="text-xs text-neutral-600 dark:text-neutral-300">Channel: {selectedAudit.channel || '-'}</p>
                <p className="text-xs text-neutral-600 dark:text-neutral-300">Status: {selectedAudit.status || '-'}</p>
                <p className="text-xs text-neutral-600 dark:text-neutral-300">Duration: {selectedAudit.durationMs != null ? `${selectedAudit.durationMs} ms` : '-'}</p>
                {selectedAudit.error ? (
                  <p className="text-xs text-error-500">Error: {selectedAudit.error}</p>
                ) : null}
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-neutral-200 p-4 dark:border-dark-700">
                  <h3 className="mb-2 text-sm font-semibold">Request</h3>
                  <p className="mb-2 text-xs text-neutral-600 dark:text-neutral-300">Text: {selectedAudit.requestText || '-'}</p>
                  <pre className="max-h-52 overflow-auto rounded-lg bg-neutral-50 p-3 text-xs dark:bg-dark-900">
                    {formatJsonValue(selectedAudit.requestData)}
                  </pre>
                </div>

                <div className="rounded-xl border border-neutral-200 p-4 dark:border-dark-700">
                  <h3 className="mb-2 text-sm font-semibold">Response</h3>
                  <p className="mb-2 text-xs text-neutral-600 dark:text-neutral-300">Text: {selectedAudit.responseText || '-'}</p>
                  <pre className="max-h-52 overflow-auto rounded-lg bg-neutral-50 p-3 text-xs dark:bg-dark-900">
                    {formatJsonValue(selectedAudit.responseData)}
                  </pre>
                </div>
              </div>
            </div>
          ) : null}
        </Modal>
      </div>
    </MainLayout>
  );
}
