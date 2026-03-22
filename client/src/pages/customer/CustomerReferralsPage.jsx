import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Gift, Share2, Copy, Check, Users,
    Smartphone
} from 'lucide-react';
import { PageHeader, Card, Button, Badge, AsyncState, Spinner } from '../../components/common';
import { MainLayout } from '../../components/layout/MainLayout';
import { getPageLayout } from '../../constants/layout';
import { getReferralInfo, applyReferralCode } from '../../api/growth';
import { toast } from 'sonner';
import { motion as Motion } from 'framer-motion';

const REFERRALS_QUERY_KEY = ['customer', 'referrals'];

export function CustomerReferralsPage() {
    const queryClient = useQueryClient();
    const [copied, setCopied] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: REFERRALS_QUERY_KEY,
        queryFn: getReferralInfo
    });

    const applyMutation = useMutation({
        mutationFn: (code) => applyReferralCode(code),
        onSuccess: () => {
            toast.success('Referral code applied!');
            queryClient.invalidateQueries({ queryKey: REFERRALS_QUERY_KEY });
        },
        onError: (err) => {
            toast.error(err.response?.data?.error || 'Invalid referral code');
        }
    });

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(data?.referralCode || '');
            setCopied(true);
            toast.success('Referral code copied!');
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error('Unable to copy referral code. Please copy it manually.');
        }
    };

    const handleShare = async () => {
        const text = `Join UrbanPro v2 for professional home services! Use my code ${data?.referralCode} to get ₹50 credits. Download: https://urbanpro.v2.app`;
        if (navigator.share) {
            try {
                await navigator.share({ title: 'UrbanPro Refer & Earn', text, url: 'https://urbanpro.v2.app' });
                return;
            } catch (err) {
                if (err?.name === 'AbortError') return;
            }
            await handleCopy();
        } else {
            await handleCopy();
        }
    };

    return (
        <MainLayout>
            <div className={getPageLayout('default')}>
                <PageHeader
                    title="Refer & Earn"
                    subtitle="Invite your friends and earn wallet credits together."
                />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    <Card className="p-10 text-center relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4">
                            <Gift size={100} className="text-brand-50 absolute -right-4 -top-4 -rotate-12 opacity-50 group-hover:scale-110 transition-transform" />
                        </div>

                        <div className="relative z-10">
                            <div className="w-20 h-20 bg-brand-100 text-brand-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                                <Gift size={32} />
                            </div>

                            <h3 className="text-3xl font-black mb-2 text-gray-900 dark:text-white">Give ₹50, Get ₹50</h3>
                            <p className="text-gray-500 font-bold max-w-sm mx-auto mb-10 leading-relaxed dark:text-gray-400">
                                When a friend completes their first service using your code, both of you receive ₹50 in your platform wallet.
                            </p>

                            <div className="space-y-4 max-w-sm mx-auto">
                                <div className="text-[10px] font-black uppercase text-gray-400 text-left mb-1 tracking-widest pl-1">Your Unique Code</div>
                                <div className="flex items-center gap-2">
                                    <div className="grow h-16 rounded-2xl bg-gray-50 dark:bg-dark-900 border-2 border-dashed border-gray-200 dark:border-dark-700 flex items-center px-6 font-black text-2xl tracking-[0.2em] text-brand-600">
                                        {isLoading ? <Spinner size="sm" /> : (data?.referralCode || '------')}
                                    </div>
                                    <Button
                                        variant="outline"
                                        className="h-16 w-16 p-0 rounded-2xl shrink-0 border-2 hover:bg-gray-50 bg-white dark:bg-dark-800 dark:hover:bg-dark-900 transition-all active:scale-95"
                                        onClick={handleCopy}
                                    >
                                        {copied ? <Check size={24} className="text-success-500" /> : <Copy size={24} />}
                                    </Button>
                                </div>
                                <Button
                                    variant="primary"
                                    className="w-full h-16 text-lg font-black rounded-2xl shadow-xl shadow-brand-500/20"
                                    icon={Share2}
                                    onClick={handleShare}
                                >
                                    Share Invite Link
                                </Button>
                            </div>
                        </div>
                    </Card>

                    <div className="space-y-6">
                        <Card className="p-8">
                            <h4 className="flex items-center gap-2 font-black text-lg mb-6">
                                <Users size={20} className="text-brand-500" />
                                My Invitations
                            </h4>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-6 rounded-3xl bg-gray-50 dark:bg-dark-900 border border-gray-100 dark:border-dark-800">
                                    <div className="text-[10px] font-black uppercase text-gray-400 mb-1 tracking-widest">Total Invited</div>
                                    <div className="text-4xl font-black">{data?.totalReferrals || 0}</div>
                                </div>
                                <div className="p-6 rounded-3xl bg-gray-50 dark:bg-dark-900 border border-gray-100 dark:border-dark-800">
                                    <div className="text-[10px] font-black uppercase text-gray-400 mb-1 tracking-widest">Earned So Far</div>
                                    <div className="text-4xl font-black text-emerald-600">₹{(data?.totalReferrals || 0) * 50}</div>
                                </div>
                            </div>
                        </Card>

                        <Card className="p-8">
                            <h4 className="flex items-center gap-2 font-black text-lg mb-6">
                                <Smartphone size={20} className="text-brand-500" />
                                Got a Referral Code?
                            </h4>
                            <p className="text-sm text-gray-500 font-bold mb-6 dark:text-gray-400">
                                If you weren't able to enter a code during signup, enter it here to link your account.
                            </p>

                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    const code = e.target.code.value.trim();
                                    if (code) applyMutation.mutate(code);
                                }}
                                className="flex gap-2"
                            >
                                <input
                                    name="code"
                                    placeholder="ENTER CODE"
                                    autoComplete="off"
                                    className="grow h-14 px-6 rounded-2xl border-2 border-gray-100 dark:border-dark-700 bg-gray-50 dark:bg-dark-900 font-black uppercase placeholder:opacity-30 focus:border-brand-500 outline-none transition-all"
                                />
                                <Button
                                    variant="primary"
                                    type="submit"
                                    loading={applyMutation.isPending}
                                    className="h-14 px-8 rounded-2xl font-black text-sm uppercase tracking-widest"
                                >
                                    Apply
                                </Button>
                            </form>
                        </Card>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
