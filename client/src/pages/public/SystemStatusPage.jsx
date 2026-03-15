// System status page
// Verifies backend health and database access

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Database, Server } from 'lucide-react';
import { MainLayout } from '../../components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardDescription } from '../../components/common';
import { Badge, Spinner, PageHeader } from '../../components/common';
import { getAllServices } from '../../api/services';
import { getPageLayout } from '../../constants/layout';
import { queryKeys } from '../../utils/queryKeys';
import { usePageTitle } from '../../hooks/usePageTitle';
import { API_ORIGIN } from '../../config/runtime';

const getApiRoot = () => API_ORIGIN;

const fetchHealth = async () => {
  const response = await fetch(`${getApiRoot()}/health`);
  if (!response.ok) {
    throw new Error('Backend health check failed');
  }
  return response.json();
};

export function SystemStatusPage() {
    usePageTitle('System Status');
  const healthQuery = useQuery({
    queryKey: queryKeys.health.status(),
    queryFn: fetchHealth,
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
  });

  const servicesQuery = useQuery({
    queryKey: queryKeys.services.status(),
    queryFn: () => getAllServices(),
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
  });

  const serviceCount = useMemo(() => {
    const data = servicesQuery.data;
    const services = data?.services || data || [];
    return Array.isArray(services) ? services.length : 0;
  }, [servicesQuery.data]);

  const statusBadge = (status) => (
    <Badge variant={status === 'ok' ? 'success' : 'error'}>
      {status === 'ok' ? 'OK' : 'ERROR'}
    </Badge>
  );

  return (
    <MainLayout>
      <div className={getPageLayout('narrow')}>
        <PageHeader
          title="System Status"
          subtitle="Live connection checks between frontend, backend, and database."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server size={20} className="text-brand-500" />
                Backend Health
              </CardTitle>
              <CardDescription>Checks the /health endpoint</CardDescription>
            </CardHeader>

            {healthQuery.isLoading ? (
              <div className="flex items-center gap-2">
                <Spinner size="sm" />
                <span className="text-gray-700 dark:text-gray-300">Checking...</span>
              </div>
            ) : healthQuery.isError ? (
              <div className="space-y-2">
                {statusBadge('error')}
                <p className="text-error-500 text-sm">{healthQuery.error?.message || 'Health check failed'}</p>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                {statusBadge(healthQuery.data?.status || 'ok')}
                <span className="text-gray-600 dark:text-gray-400">
                  Locale: {healthQuery.data?.locale || 'n/a'}
                </span>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database size={20} className="text-success-500" />
                Database Access
              </CardTitle>
              <CardDescription>Fetches services list from /api/services</CardDescription>
            </CardHeader>

            {servicesQuery.isLoading ? (
              <div className="flex items-center gap-2">
                <Spinner size="sm" />
                <span className="text-gray-700 dark:text-gray-300">Checking...</span>
              </div>
            ) : servicesQuery.isError ? (
              <div className="space-y-2">
                {statusBadge('error')}
                <p className="text-error-500 text-sm">{servicesQuery.error?.message || 'Database check failed'}</p>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                {statusBadge('ok')}
                <span className="text-gray-600 dark:text-gray-400">
                  Services: {serviceCount}
                </span>
              </div>
            )}
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity size={20} className="text-accent-500" />
              Notes
            </CardTitle>
            <CardDescription>What these checks mean</CardDescription>
          </CardHeader>
          <div className="text-gray-600 dark:text-gray-400">
            <p className="mb-2">
              Backend Health checks the API server is running and reachable.
            </p>
            <p>
              Database Access confirms the API can query the database successfully.
            </p>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
