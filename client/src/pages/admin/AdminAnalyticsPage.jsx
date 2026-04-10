import {
    TrendingUp, DollarSign, Users, Briefcase,
    ArrowUpRight, ArrowDownRight, Clock, Star, Activity,
    BarChart3, PieChart, Download, RefreshCw
} from 'lucide-react';
import {
    LineChart, Line, AreaChart, Area,
    BarChart, Bar, PieChart as RePieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { PageHeader, Card, CardHeader, CardTitle, CardDescription, Button, Badge, Spinner, StatCard, AsyncState } from '../../components/common';
import { MainLayout } from '../../components/layout/MainLayout';
import { getPageLayout } from '../../constants/layout';
import { getAnalyticsSummary, exportGSTR1 } from '../../api/admin';
import { usePageTitle } from '../../hooks/usePageTitle';
import { toast } from 'sonner';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export function AdminAnalyticsPage() {
    usePageTitle('Platform Analytics');

    const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
        queryKey: ['admin', 'analytics'],
        queryFn: getAnalyticsSummary,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    const kpis = data?.kpis;
    const charts = data?.charts;

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(val);
    };

    return (
        <MainLayout>
            <div className={`${getPageLayout('default')} module-canvas module-canvas--utility`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <PageHeader
                        title="Platform Analytics"
                        subtitle="Deep dive into marketplace performance and growth metrics."
                        className="mb-0"
                    />
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => refetch()}
                            icon={isFetching ? RefreshCw : RefreshCw}
                            className={isFetching ? 'animate-spin' : ''}
                        >
                            Refresh
                        </Button>
                        <Button
                            variant="brand"
                            size="sm"
                            icon={Download}
                            onClick={() => {
                                const m = new Date().getMonth() + 1;
                                const y = new Date().getFullYear();
                                toast.promise(exportGSTR1(m, y), {
                                    loading: 'Generating GSTR-1 CSV...',
                                    success: 'GSTR-1 Data Exported',
                                    error: 'Failed to export tax data'
                                });
                            }}
                        >
                            Export GSTR-1
                        </Button>
                    </div>
                </div>

                <AsyncState
                    isLoading={isLoading}
                    isError={isError}
                    error={error}
                    onRetry={refetch}
                >
                    {data && (
                        <>
                            {/* KPI Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                                <StatCard
                                    title="Total GMV"
                                    value={formatCurrency(kpis.gmv)}
                                    icon={DollarSign}
                                    color="brand"
                                    description={
                                        <span className="flex items-center text-success-500 font-bold">
                                            <ArrowUpRight size={14} className="mr-1" />
                                            {kpis.growthMoM}% vs last month
                                        </span>
                                    }
                                />
                                <StatCard
                                    title="Platform Revenue"
                                    value={formatCurrency(kpis.revenue)}
                                    icon={TrendingUp}
                                    color="success"
                                    description="15% avg. commission"
                                />
                                <StatCard
                                    title="Active Users"
                                    value={kpis.activeUsers}
                                    icon={Users}
                                    color="info"
                                    description="Retention: 42%"
                                />
                                <StatCard
                                    title="Avg Response Time"
                                    value={`${kpis.avgResponseTimeMinutes}m`}
                                    icon={Clock}
                                    color="warning"
                                    description="Efficiency Score: High"
                                />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                                {/* Revenue & GMV Trend */}
                                <Card className="lg:col-span-2">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <TrendingUp size={18} className="text-brand-500" />
                                            Performance Trend
                                        </CardTitle>
                                        <CardDescription>Monthly Gross Merchandise Value & Revenue</CardDescription>
                                    </CardHeader>
                                    <div className="h-80 w-full mt-4">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={charts.monthly}>
                                                <defs>
                                                    <linearGradient id="colorGmv" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                                <Tooltip
                                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                                    formatter={(val) => formatCurrency(val)}
                                                />
                                                <Area type="monotone" dataKey="gmv" stroke="#6366f1" fillOpacity={1} fill="url(#colorGmv)" strokeWidth={2} name="GMV" />
                                                <Area type="monotone" dataKey="revenue" stroke="#10b981" fillOpacity={1} fill="rgba(16, 185, 129, 0.1)" strokeWidth={2} name="Revenue" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </Card>

                                {/* Category breakdown */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <PieChart size={18} className="text-info-500" />
                                            Order Distribution
                                        </CardTitle>
                                        <CardDescription>Share by service category</CardDescription>
                                    </CardHeader>
                                    <div className="h-80 w-full mt-4 relative">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RePieChart>
                                                <Pie
                                                    data={charts.categories}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={80}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                >
                                                    {charts.categories.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip />
                                                <Legend verticalAlign="bottom" iconType="circle" />
                                            </RePieChart>
                                        </ResponsiveContainer>
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[40px] text-center pointer-events-none">
                                            <p className="text-[10px] uppercase font-black text-gray-400">Total GMV</p>
                                            <p className="font-black text-lg text-gray-900 dark:text-white">
                                                {formatCurrency(kpis.gmv)}
                                            </p>
                                        </div>
                                    </div>
                                </Card>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Top Earners */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Briefcase size={18} className="text-warning-500" />
                                            Top Performing Workers
                                        </CardTitle>
                                        <CardDescription>Highest revenue generators this month</CardDescription>
                                    </CardHeader>
                                    <div className="space-y-4 mt-6">
                                        {charts.workers.topEarners.map((worker, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-dark-900 border border-transparent hover:border-brand-500/30 transition-all">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center font-black text-brand-600">
                                                        {idx + 1}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-gray-900 dark:text-white">{worker.name}</p>
                                                        <p className="text-xs text-gray-500 uppercase font-black">Verified Professional</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-black text-success-500">{formatCurrency(worker.earnings)}</p>
                                                    <Badge variant="success" size="sm">Active</Badge>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </Card>

                                {/* System Health / Efficiency */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Activity size={18} className="text-brand-500" />
                                            Platform Efficiency
                                        </CardTitle>
                                        <CardDescription>Key operational metrics</CardDescription>
                                    </CardHeader>
                                    <div className="grid grid-cols-2 gap-4 mt-6">
                                        <div className="p-6 rounded-2xl bg-brand-50/50 dark:bg-brand-900/10 border border-brand-100 dark:border-brand-900/30 text-center">
                                            <div className="w-12 h-12 rounded-2xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center mx-auto mb-4 text-brand-600">
                                                <Star size={24} />
                                            </div>
                                            <p className="text-2xl font-black text-gray-900 dark:text-white">{charts.workers.overallRating}</p>
                                            <p className="text-[10px] uppercase font-black text-gray-500 mt-1">Avg. Platform Rating</p>
                                        </div>
                                        <div className="p-6 rounded-2xl bg-info-50/50 dark:bg-info-900/10 border border-info-100 dark:border-info-900/30 text-center">
                                            <div className="w-12 h-12 rounded-2xl bg-info-100 dark:bg-info-900/30 flex items-center justify-center mx-auto mb-4 text-info-600">
                                                <BarChart3 size={24} />
                                            </div>
                                            <p className="text-2xl font-black text-gray-900 dark:text-white">94%</p>
                                            <p className="text-[10px] uppercase font-black text-gray-500 mt-1">Acceptance Rate</p>
                                        </div>
                                        <div className="p-6 rounded-2xl bg-success-50/50 dark:bg-success-900/10 border border-success-100 dark:border-success-900/30 text-center">
                                            <div className="w-12 h-12 rounded-2xl bg-success-100 dark:bg-success-900/30 flex items-center justify-center mx-auto mb-4 text-success-600">
                                                <RefreshCw size={24} />
                                            </div>
                                            <p className="text-2xl font-black text-gray-900 dark:text-white">28%</p>
                                            <p className="text-[10px] uppercase font-black text-gray-500 mt-1">Repeat Customer Rate</p>
                                        </div>
                                        <div className="p-6 rounded-2xl bg-warning-50/50 dark:bg-warning-900/10 border border-warning-100 dark:border-warning-900/30 text-center">
                                            <div className="w-12 h-12 rounded-2xl bg-warning-100 dark:bg-warning-900/30 flex items-center justify-center mx-auto mb-4 text-warning-600">
                                                <TrendingUp size={24} />
                                            </div>
                                            <p className="text-2xl font-black text-gray-900 dark:text-white">12+</p>
                                            <p className="text-[10px] uppercase font-black text-gray-500 mt-1">Monthly Active Cities</p>
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        </>
                    )}
                </AsyncState>
            </div>
        </MainLayout>
    );
}
