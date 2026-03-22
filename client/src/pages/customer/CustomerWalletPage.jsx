// CustomerWalletPage - Premium wallet dashboard with transactions list

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion as Motion } from 'framer-motion';
import {
  Wallet, TrendingUp, TrendingDown,
  Clock, DollarSign, ArrowUpRight, ArrowDownLeft, AlertCircle, Plus, Receipt, 
  Gift, Ticket, Sparkles
} from 'lucide-react';
import { PageHeader, Card, Button, Badge, AsyncState } from '../../components/common';
import { MainLayout } from '../../components/layout/MainLayout';
import { getPageLayout } from '../../constants/layout';
import { format } from 'date-fns';
import {
  getWallet,
  createWalletTopupOrder,
  confirmWalletTopup,
  redeemGiftCard,
  purchaseGiftCard,
} from '../../api/growth';
import { toast } from 'sonner';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useAuth } from '../../hooks/useAuth';
import { useRazorpay } from '../../hooks/useRazorpay';
import { ensureRazorpayLoaded, getRazorpayKeyId } from '../../utils/razorpay';

export function CustomerWalletPage() {
  usePageTitle('My Wallet');
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const razorpayKeyId = getRazorpayKeyId();

  useRazorpay({
    onError: () => {
      toast.error('Payment system failed to load. Please refresh and try again.');
    },
  });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['customer', 'wallet'],
    queryFn: getWallet
  });

  const addMutation = useMutation({
    mutationFn: async (amount) => {
      if (!razorpayKeyId) {
        throw new Error('Payment is not configured.');
      }

      await ensureRazorpayLoaded();
      const orderResp = await createWalletTopupOrder(amount);
      const order = orderResp?.order;

      if (!order) {
        throw new Error('Failed to initiate wallet top-up.');
      }

      await new Promise((resolve, reject) => {
        const options = {
          key: razorpayKeyId,
          amount: order.amount,
          currency: order.currency,
          name: 'UrbanPro V2',
          description: 'Wallet Top-up',
          order_id: order.id,
          prefill: {
            name: user?.name,
            email: user?.email,
            contact: user?.mobile,
          },
          handler: async (response) => {
            try {
              await confirmWalletTopup({
                paymentReference: response.razorpay_payment_id,
                paymentOrderId: response.razorpay_order_id,
                paymentSignature: response.razorpay_signature,
              });
              resolve();
            } catch (error) {
              reject(error);
            }
          },
          modal: {
            ondismiss: () => reject(new Error('Wallet top-up cancelled.')),
          },
        };

        try {
          const rzp = new window.Razorpay(options);
          rzp.open();
        } catch (_error) {
          reject(new Error('Unable to open payment window.'));
        }
      });
    },
    onSuccess: () => {
      toast.success('Funds added successfully!');
      queryClient.invalidateQueries({ queryKey: ['customer', 'wallet'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to add funds');
    }
  });

  const handleAddCredits = () => {
    const amountInput = window.prompt('Enter amount to deposit:', '500');
    if (amountInput == null) return;

    const amount = Number(amountInput);
    const rounded = Math.round(amount * 100) / 100;

    if (!Number.isFinite(rounded) || rounded <= 0 || rounded > 100000) {
      toast.error('Enter a valid amount between ₹1 and ₹100000.');
      return;
    }

    addMutation.mutate(rounded);
  };

  const handleRedeemGiftCard = async () => {
    const code = window.prompt('Enter Gift Card Code:');
    if (!code) return;

    try {
      const res = await redeemGiftCard({ code });
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ['customer', 'wallet'] });
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to redeem gift card');
    }
  };

  const handlePurchaseGiftCard = async () => {
    const amountInput = window.prompt('Enter amount for Gift Card:', '1000');
    if (!amountInput) return;

    const amount = Number(amountInput);
    if (!Number.isFinite(amount) || amount < 100 || amount > 10000) {
      toast.error('Gift card amount must be between ₹100 and ₹10000.');
      return;
    }

    const recipientEmail = window.prompt('Enter recipient email:');
    if (!recipientEmail) return;

    const normalizedEmail = recipientEmail.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      toast.error('Please enter a valid recipient email.');
      return;
    }

    try {
      const res = await purchaseGiftCard({ amount, recipientEmail: normalizedEmail, senderName: user?.name });
      toast.success(res.message);
      alert(`Gift Card Code: ${res.card.code}\nRecipient: ${res.card.recipientEmail}`);
      queryClient.invalidateQueries({ queryKey: ['customer', 'wallet'] });
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to purchase gift card');
    }
  };

  const transactions = data?.transactions || [];

  return (
    <MainLayout>
      <div className={getPageLayout('default')}>
        <PageHeader
          title="My Wallet"
          subtitle="Manage your platform credits and transaction history."
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Balanced Card */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <Card className="p-8 border-none overflow-hidden relative">
                {/* Background Gradient & Effects */}
                <div className="absolute inset-0 bg-gradient-to-br from-brand-600 via-brand-700 to-accent-700 pointer-events-none" />
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full blur-2xl -ml-6 -mb-6" />

                <div className="relative z-10 text-white">
                  <div className="flex items-center gap-3 mb-8 opacity-90">
                    <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm shadow-sm">
                      <Wallet size={20} />
                    </div>
                    <span className="font-bold uppercase tracking-widest text-xs tracking-[0.2em] text-white/80">Available Balance</span>
                  </div>

                  <div className="mb-10 flex items-baseline">
                    <span className="text-3xl font-bold opacity-80 mr-1.5 self-start mt-2">₹</span>
                    <span className="text-6xl font-black tracking-tight">{data?.balance || '0.00'}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      icon={Plus}
                      loading={addMutation.isPending}
                      onClick={handleAddCredits}
                      className="bg-white text-brand-700 hover:bg-neutral-50 border-none font-black text-xs uppercase tracking-widest h-12 shadow-xl shadow-brand-900/20"
                    >
                      Add Cash
                    </Button>
                    <Button
                      variant="outline"
                      className="text-white border-white/30 hover:bg-white/10 font-black text-xs uppercase tracking-widest h-12 transition-colors"
                      onClick={() => toast.info('Detailed statements feature coming soon')}
                    >
                      History
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Gift Cards Widget */}
              <Motion.div 
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}
                className="mt-6 p-8 rounded-3xl bg-neutral-900 text-white shadow-2xl relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/20 rounded-full blur-3xl -mr-10 -mt-10" />
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-xl bg-white/10">
                      <Gift size={18} className="text-brand-400" />
                    </div>
                    <h4 className="font-black text-xs uppercase tracking-widest">Digital Gift Cards</h4>
                  </div>
                  <p className="text-sm text-neutral-400 font-medium leading-relaxed mb-6">
                    Surprise a friend with home services. Gift cards are valid for 1 year.
                  </p>
                  <div className="space-y-3">
                    <Button 
                      fullWidth 
                      variant="primary" 
                      size="sm" 
                      onClick={handlePurchaseGiftCard}
                      className="rounded-xl h-10 font-bold uppercase text-[10px] tracking-widest"
                    >
                      Buy A Gift Card
                    </Button>
                    <Button 
                      fullWidth 
                      variant="outline" 
                      size="sm" 
                      onClick={handleRedeemGiftCard}
                      className="rounded-xl h-10 font-bold uppercase text-[10px] tracking-widest border-white/20 text-white hover:bg-white/10"
                    >
                      Redeem Code
                    </Button>
                  </div>
                </div>
              </Motion.div>

              {/* Escrow Disclaimer */}
              <Motion.div 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="mt-6 p-6 rounded-3xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 shadow-sm"
              >
                <h4 className="flex items-center gap-2 font-black text-amber-700 dark:text-amber-500 mb-2">
                  <AlertCircle size={18} />
                  Safe Escrow guarantee
                </h4>
                <p className="text-sm text-amber-600 dark:text-amber-400/80 leading-relaxed font-medium">
                  Your funds are securely held in escrow until your service is verified via OTP. Refunds are processed instantly back to your wallet.
                </p>
              </Motion.div>
            </div>
          </div>

          {/* Transactions List */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-neutral-100 dark:bg-dark-800 rounded-lg text-neutral-500">
                  <Receipt size={20} />
                </div>
                <h3 className="text-2xl font-black text-neutral-900 dark:text-white">Transactions</h3>
              </div>
              <Badge variant="neutral" size="sm" className="hidden sm:inline-flex">Last 50 Records</Badge>
            </div>

            <AsyncState
              isLoading={isLoading}
              isError={isError}
              error={error}
              onRetry={refetch}
              isEmpty={!isLoading && transactions.length === 0}
              emptyTitle="No transactions yet"
              emptyMessage="Your wallet history will appear here once you start using credits."
            >
              <div className="space-y-4">
                {transactions.map((tx, idx) => {
                  const isPositive = parseFloat(tx.amount) >= 0;
                  
                  return (
                    <Motion.div
                      key={tx.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="bg-white dark:bg-dark-800 p-5 rounded-3xl border border-neutral-100 dark:border-dark-700/50 flex items-center justify-between group hover:shadow-card-hover hover:border-brand-100 dark:hover:border-brand-500/30 transition-all duration-300"
                    >
                      <div className="flex items-center gap-5">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 duration-300
                          ${isPositive
                            ? 'bg-success-50 text-success-600 dark:bg-success-500/20 dark:text-success-400'
                            : 'bg-error-50 text-error-600 dark:bg-error-500/20 dark:text-error-400'}`}>
                          {isPositive ? <ArrowDownLeft size={24} strokeWidth={2.5} /> : <ArrowUpRight size={24} strokeWidth={2.5} />}
                        </div>
                        <div>
                          <h4 className="font-bold text-base text-neutral-900 dark:text-white mb-0.5 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                            {tx.description}
                          </h4>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-dark-700 text-neutral-500 uppercase tracking-widest">{tx.type}</span>
                            <span className="w-1 h-1 rounded-full bg-neutral-300 dark:bg-dark-600" />
                            <span className="text-xs font-semibold text-neutral-400">{format(new Date(tx.createdAt), 'MMM dd, yyyy · p')}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className={`text-xl font-black mb-1.5 ${isPositive ? 'text-success-600 dark:text-success-400' : 'text-neutral-900 dark:text-white'}`}>
                          {isPositive ? '+' : ''}₹{Math.abs(tx.amount)}
                        </div>
                        <Badge size="xs" variant={tx.status === 'COMPLETED' ? 'success' : 'warning'} className="uppercase tracking-widest font-black text-[9px] shadow-sm">
                          {tx.status}
                        </Badge>
                      </div>
                    </Motion.div>
                  );
                })}
              </div>
            </AsyncState>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
