import { ArrowLeft, CreditCard, Download } from 'lucide-react';
import { Button } from '../../../components/common';
import { downloadInvoice } from '../../../api/bookings';
import { toast } from 'sonner';

export function CustomerMobileActions({ booking, navigate, payMutation, onCancelOpen, onWalletPay }) {
    return (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 p-4 pb-8 border-t backdrop-blur-xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] bg-white/80 border-gray-100 dark:bg-dark-900/80 dark:border-dark-700">
            <div className="flex gap-3">
                {booking.status === 'COMPLETED' ? (
                    <div className="flex flex-col w-full gap-3">
                        {booking.paymentStatus !== 'PAID' ? (
                            <div className="grid grid-cols-2 gap-3">
                                <Button
                                    size="lg"
                                    variant="outline"
                                    icon={CreditCard}
                                    onClick={onWalletPay}
                                    loading={payMutation.isPending}
                                    className="rounded-2xl font-black h-14"
                                >
                                    Wallet
                                </Button>
                                <Button
                                    size="lg"
                                    icon={CreditCard}
                                    onClick={() => payMutation.mutate('ONLINE')}
                                    loading={payMutation.isPending}
                                    className="bg-brand-600 text-white rounded-2xl font-black h-14"
                                >
                                    Online
                                </Button>
                            </div>
                        ) : (
                            <Button
                                fullWidth
                                size="lg"
                                variant="outline"
                                icon={Download}
                                onClick={() => {
                                    toast.promise(downloadInvoice(booking.id), {
                                        loading: 'Generating Invoice...',
                                        success: 'Invoice Downloaded Successfully',
                                        error: 'Failed to generate invoice'
                                    });
                                }}
                                className="border-gray-200 dark:border-dark-700 text-gray-900 dark:text-white rounded-2xl font-black h-14"
                            >
                                Download Invoice
                            </Button>
                        )}
                        <Button
                            fullWidth
                            variant="ghost"
                            onClick={() => navigate('/customer/dashboard')}
                            className="text-gray-500 font-black h-12"
                            icon={ArrowLeft}
                        >
                            Back to Home
                        </Button>
                    </div>
                ) : ['PENDING', 'CONFIRMED'].includes(booking.status) ? (
                    <>
                        <Button
                            fullWidth
                            size="lg"
                            variant="outline"
                            onClick={() => navigate('/services')}
                            className="border-gray-200 dark:border-dark-700 text-gray-600 dark:text-gray-300 rounded-2xl font-black h-14"
                        >
                            Modify
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={onCancelOpen}
                            className="text-error-500 font-black px-6"
                        >
                            Cancel
                        </Button>
                    </>
                ) : booking.status === 'IN_PROGRESS' ? (
                    <div className="flex flex-col w-full gap-3">
                        <div className="p-3 bg-brand-50 dark:bg-brand-900/20 rounded-xl flex items-center justify-center gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
                            <span className="text-2xs font-black uppercase text-brand-600 tracking-widest">Service in Progress</span>
                        </div>
                    </div>
                ) : (
                    <Button
                        fullWidth
                        variant="ghost"
                        onClick={() => navigate('/customer/dashboard')}
                        className="text-gray-500 font-black h-14"
                        icon={ArrowLeft}
                    >
                        Back to Home
                    </Button>
                )}
            </div>
        </div>
    );
}
