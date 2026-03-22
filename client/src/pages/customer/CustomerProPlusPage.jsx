import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Star, Zap, CreditCard, Clock, Sparkles, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion as Motion } from 'framer-motion';

import { MainLayout } from '../../components/layout/MainLayout';
import { Card, Button, Badge } from '../../components/common';
import { getProPlusSubscription, subscribeProPlus, cancelProPlus } from '../../api/growth';
import { usePageTitle } from '../../hooks/usePageTitle';
import { getPageLayout } from '../../constants/layout';

const formatSubscriptionDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' });
};

export function CustomerProPlusPage() {
  usePageTitle('UrbanPro Plus');
  const queryClient = useQueryClient();

  const { data: sub, isLoading } = useQuery({
    queryKey: ['proplus'],
    queryFn: getProPlusSubscription,
  });

  const subscribeMutation = useMutation({
    mutationFn: (planId) => subscribeProPlus(planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proplus'] });
      toast.success('Successfully subscribed to UrbanPro Plus!');
    },
    onError: () => toast.error('Failed to subscribe. Try again.'),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelProPlus(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proplus'] });
      toast.success('Auto-renewal cancelled.');
    },
    onError: () => toast.error('Failed to cancel subscription.'),
  });

  if (isLoading) return null;

  const isActive = sub?.isSubscribed;
  const isCancelled = sub?.status === 'CANCELLED';

  const benefits = [
    { title: "10% Off All Services", icon: Zap },
    { title: "Zero Trust & Support Fee", icon: ShieldCheck },
    { title: "Priority Support 24/7", icon: Star },
    { title: "Top-Rated Pros Assured", icon: Sparkles },
  ];

  return (
    <MainLayout>
      <div className={getPageLayout('default')}>
        <Motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <span className="text-xs font-black uppercase tracking-widest text-brand-500 mb-2 block">
            Premium Membership
          </span>
          <h1 className="text-4xl font-black tracking-tight text-neutral-900 dark:text-white flex items-center gap-3">
            UrbanPro <span className="px-2 py-0.5 rounded-lg bg-gradient-to-r from-brand-500 to-accent-500 text-white text-2xl rotate-3">Plus</span>
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
            The smartest way to maintain your home. Save on every booking.
          </p>
        </Motion.div>

        {isActive ? (
          <div className="space-y-6">
            <Motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <Card className="p-8 relative overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-accent-900 text-white border-0 shadow-2xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent-500/20 rounded-full blur-3xl" />
                
                <div className="relative z-10 flex flex-col md:flex-row gap-8 justify-between items-start md:items-center -mt-2">
                  <div>
                    <Badge variant="success" className="mb-4 border-none bg-green-500/20 text-green-300">
                      <CheckCircle2 size={12} className="mr-1" /> Active Subscription
                    </Badge>
                    <h2 className="text-3xl font-black tracking-tight mb-2">You are a Plus Member!</h2>
                    <p className="text-white/70 max-w-sm">Enjoy zero fees, flat 10% off, and priority support on all your bookings.</p>
                  </div>

                  <div className="p-5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 text-center min-w-[200px]">
                    <p className="text-xs font-bold text-white/60 uppercase tracking-widest mb-1">
                      {isCancelled ? 'Expires On' : 'Renews On'}
                    </p>
                    <p className="text-xl font-black">
                      {formatSubscriptionDate(sub.endDate)}
                    </p>
                    {isCancelled && (
                      <p className="text-xs text-red-300 mt-2 font-medium bg-red-500/20 py-1 rounded-md">Auto-renew is off</p>
                    )}
                  </div>
                </div>
              </Card>
            </Motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-6">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <CreditCard size={18} className="text-brand-500" /> Plan Details
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-3 border-b border-neutral-100 dark:border-dark-700">
                    <span className="text-sm text-neutral-500">Plan</span>
                    <span className="font-bold">{sub.planId === 'plus_yearly' ? 'Yearly Plan' : 'Monthly Plan'}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-neutral-100 dark:border-dark-700">
                    <span className="text-sm text-neutral-500">Started On</span>
                    <span className="font-bold">{formatSubscriptionDate(sub.startDate)}</span>
                  </div>
                  <div className="flex justify-between items-center py-3">
                    <span className="text-sm text-neutral-500">Status</span>
                    <span className="font-bold text-brand-500">{sub.status}</span>
                  </div>
                </div>

                {!isCancelled && (
                  <Button 
                    variant="ghost" 
                    fullWidth 
                    className="mt-6 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                    onClick={() => cancelMutation.mutate()}
                    disabled={cancelMutation.isPending}
                  >
                    {cancelMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : 'Cancel Auto-Renewal'}
                  </Button>
                )}
              </Card>

              <Card className="p-6 bg-brand-50/50 dark:bg-dark-800/50 border-brand-100 dark:border-dark-700">
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                  <Sparkles size={18} className="text-brand-500" /> Your Benefits
                </h3>
                <div className="space-y-5">
                  {benefits.map((b, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="p-1.5 rounded-full bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400">
                        <b.icon size={16} />
                      </div>
                      <span className="font-semibold text-sm">{b.title}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {benefits.map((b, i) => (
                <Motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                  <Card className="p-5 text-center h-full hover:shadow-lg transition-all border-neutral-200 dark:border-dark-700">
                    <div className="w-12 h-12 mx-auto rounded-2xl bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center mb-4">
                      <b.icon size={24} />
                    </div>
                    <h3 className="font-bold text-sm">{b.title}</h3>
                  </Card>
                </Motion.div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
              {/* Monthly Plan */}
              <Motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
                <Card className="p-8 border-2 border-transparent hover:border-brand-200 dark:hover:border-brand-500/30 transition-all">
                  <Badge className="mb-4">Monthly Plan</Badge>
                  <div className="mb-6">
                    <span className="text-4xl font-black">₹99</span>
                    <span className="text-neutral-500">/month</span>
                  </div>
                  <ul className="space-y-3 mb-8 text-sm text-neutral-600 dark:text-neutral-400">
                    <li className="flex gap-2 items-center"><CheckCircle2 size={16} className="text-brand-500" /> Cancel anytime</li>
                    <li className="flex gap-2 items-center"><CheckCircle2 size={16} className="text-brand-500" /> Full Plus benefits</li>
                  </ul>
                  <Button 
                    fullWidth 
                    variant="outline" 
                    size="lg"
                    onClick={() => subscribeMutation.mutate('plus_monthly')}
                    disabled={subscribeMutation.isPending}
                  >
                    Subscribe Monthly
                  </Button>
                </Card>
              </Motion.div>

              {/* Yearly Plan */}
              <Motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
                <Card className="p-8 border-2 border-brand-500 relative overflow-hidden shadow-2xl shadow-brand-500/10">
                  <div className="absolute top-6 right-6">
                    <span className="px-3 py-1 bg-gradient-to-r from-brand-500 to-accent-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full">Best Value</span>
                  </div>
                  <Badge variant="info" className="mb-4">Yearly Plan</Badge>
                  <div className="mb-6">
                    <span className="text-4xl font-black">₹999</span>
                    <span className="text-neutral-500">/year</span>
                  </div>
                  <ul className="space-y-3 mb-8 text-sm text-neutral-600 dark:text-neutral-400">
                    <li className="flex gap-2 items-center"><CheckCircle2 size={16} className="text-brand-500" /> Save ₹189 yearly</li>
                    <li className="flex gap-2 items-center"><CheckCircle2 size={16} className="text-brand-500" /> Full Plus benefits</li>
                  </ul>
                  <Button 
                    fullWidth 
                    variant="primary" 
                    size="lg"
                    className="shadow-brand-lg"
                    onClick={() => subscribeMutation.mutate('plus_yearly')}
                    disabled={subscribeMutation.isPending}
                  >
                    Subscribe Yearly
                  </Button>
                </Card>
              </Motion.div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
