import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Gift, TrendingUp, Clock, ArrowDownRight, ArrowUpRight, Loader2, Sparkles, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { motion as Motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { MainLayout } from '../../components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardDescription, Button, Input, AsyncState } from '../../components/common';
import { getLoyaltySummary, redeemLoyaltyPoints } from '../../api/growth';
import { usePageTitle } from '../../hooks/usePageTitle';
import { getPageLayout } from '../../constants/layout';

const LOYALTY_QUERY_KEY = ['customer', 'loyalty'];
const WALLET_QUERY_KEY = ['customer', 'wallet'];

export function CustomerLoyaltyPage() {
  const { t } = useTranslation();
  usePageTitle(t('Loyalty Points'));
  const queryClient = useQueryClient();
  const [redeemAmount, setRedeemAmount] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: LOYALTY_QUERY_KEY,
    queryFn: getLoyaltySummary,
  });

  const redeemMutation = useMutation({
    mutationFn: (points) => redeemLoyaltyPoints(points),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: LOYALTY_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: WALLET_QUERY_KEY });
      toast.success(`${t('Redeemed')} ${result.pointsRedeemed} ${t('points for')} ₹${result.discountAmount} ${t('wallet credit!')}`);
      setRedeemAmount('');
    },
    onError: (err) => toast.error(err.response?.data?.error || t('Failed to redeem points')),
  });

  const handleRedeem = () => {
    const pts = Number(redeemAmount);
    if (!pts || pts <= 0) {
      toast.error(t('Enter a valid number of points to redeem.'));
      return;
    }
    redeemMutation.mutate(pts);
  };

  const formatTransactionDate = (value) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Tier calculation
  const getTier = (lifetime) => {
    if (lifetime >= 5000) return { name: t('Platinum'), color: 'from-gray-300 to-gray-500', emoji: '💎' };
    if (lifetime >= 2000) return { name: t('Gold'), color: 'from-amber-300 to-amber-600', emoji: '🥇' };
    if (lifetime >= 500) return { name: t('Silver'), color: 'from-gray-200 to-gray-400', emoji: '🥈' };
    return { name: t('Bronze'), color: 'from-orange-200 to-orange-500', emoji: '🥉' };
  };

  const tier = getTier(data?.lifetime || 0);
  const nextTierThreshold = data?.lifetime >= 5000 ? null : data?.lifetime >= 2000 ? 5000 : data?.lifetime >= 500 ? 2000 : 500;
  const progressToNext = nextTierThreshold ? Math.min(100, ((data?.lifetime || 0) / nextTierThreshold) * 100) : 100;

  return (
    <MainLayout>
      <div className={getPageLayout('default')}>
        {/* Header */}
        <Motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <span className="text-xs font-black uppercase tracking-widest text-brand-500 mb-2 block">
            {t('Rewards Program')}
          </span>
          <h1 className="text-4xl font-black tracking-tight text-neutral-900 dark:text-white">
            {t('Loyalty Points')}
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
            {t('Earn 1 point per ₹10 spent · Redeem for wallet credits')}
          </p>
        </Motion.div>

        <AsyncState isLoading={isLoading} isError={isError} error={error} onRetry={refetch} isEmpty={false}>
          <div className="space-y-6">
            {/* Points Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Balance */}
              <Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="p-6 bg-gradient-to-br from-brand-500 to-brand-700 text-white border-0 shadow-xl shadow-brand-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-white/20 rounded-xl">
                      <Gift size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider opacity-80">{t('Available Points')}</p>
                      <p className="text-3xl font-black">{data?.balance?.toLocaleString() || 0}</p>
                    </div>
                  </div>
                  <p className="text-xs opacity-70">
                    {t('Worth')} ₹{data?.redeemableValue || '0.00'}
                  </p>
                </Card>
              </Motion.div>

              {/* Lifetime */}
              <Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card className="p-6 border-none shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-success-50 dark:bg-success-900/30 rounded-xl text-success-600 dark:text-success-400">
                      <TrendingUp size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">{t('Lifetime Earned')}</p>
                      <p className="text-3xl font-black text-neutral-900 dark:text-white">{data?.lifetime?.toLocaleString() || 0}</p>
                    </div>
                  </div>
                </Card>
              </Motion.div>

              {/* Tier */}
              <Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card className="p-6 border-none shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-amber-50 dark:bg-amber-900/30 rounded-xl text-amber-600">
                      <Trophy size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">{t('Current Tier')}</p>
                      <p className="text-2xl font-black text-neutral-900 dark:text-white">{tier.emoji} {tier.name}</p>
                    </div>
                  </div>
                  {nextTierThreshold && (
                    <div>
                      <div className="w-full bg-gray-200 dark:bg-dark-700 rounded-full h-1.5 mt-2">
                        <div className={`bg-gradient-to-r ${tier.color} h-1.5 rounded-full transition-all duration-500`} style={{ width: `${progressToNext}%` }} />
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1">{nextTierThreshold - (data?.lifetime || 0)} {t('points to next tier')}</p>
                    </div>
                  )}
                </Card>
              </Motion.div>
            </div>

            {/* Redeem Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles size={20} className="text-brand-500" />
                  {t('Redeem Points')}
                </CardTitle>
                <CardDescription>{t('Convert your points to wallet credit. 100 points = ₹10.')}</CardDescription>
              </CardHeader>
              <div className="px-6 pb-6">
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    placeholder={t('Enter points to redeem')}
                    value={redeemAmount}
                    onChange={(e) => setRedeemAmount(e.target.value)}
                    className="h-12 rounded-xl max-w-xs"
                    min="1"
                    max={data?.balance || 0}
                  />
                  <Button
                    variant="primary"
                    className="h-12 px-6 rounded-xl shadow-brand-500/20 shadow-lg"
                    onClick={handleRedeem}
                    disabled={redeemMutation.isPending || !redeemAmount || Number(redeemAmount) <= 0}
                  >
                    {redeemMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : t('Redeem')}
                  </Button>
                </div>
                {redeemAmount && Number(redeemAmount) > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    {t('You will receive')} <span className="font-bold text-brand-600">₹{(Number(redeemAmount) / 10).toFixed(2)}</span> {t('in wallet credits')}
                  </p>
                )}
              </div>
            </Card>

            {/* Transaction History */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock size={20} className="text-gray-500" />
                  {t('Point History')}
                </CardTitle>
              </CardHeader>
              <div className="px-6 pb-6">
                {data?.transactions?.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">{t('No point transactions yet. Complete a booking to start earning!')}</p>
                ) : (
                  <div className="space-y-3">
                    {data?.transactions?.map((txn) => (
                      <div key={txn.id} className="flex items-center justify-between py-3 border-b last:border-0 border-gray-100 dark:border-dark-700">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${txn.points > 0 ? 'bg-success-50 dark:bg-success-900/20 text-success-600' : 'bg-red-50 dark:bg-red-900/20 text-red-600'}`}>
                            {txn.points > 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{txn.description}</p>
                            <p className="text-xs text-gray-500">{formatTransactionDate(txn.createdAt)}</p>
                          </div>
                        </div>
                        <span className={`font-bold text-sm ${txn.points > 0 ? 'text-success-600' : 'text-red-600'}`}>
                          {txn.points > 0 ? '+' : ''}{txn.points} pts
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>
        </AsyncState>
      </div>
    </MainLayout>
  );
}
