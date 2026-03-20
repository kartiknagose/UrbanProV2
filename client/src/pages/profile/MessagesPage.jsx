import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Clock, ChevronRight, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../components/layout/MainLayout';
import { Card, AsyncState, PageHeader, Badge, Input, Button } from '../../components/common';
import { useAuth } from '../../hooks/useAuth';
import { getPageLayout } from '../../constants/layout';
import { resolveProfilePhotoUrl } from '../../utils/profilePhoto';
import { getUserConversations } from '../../api';
import { queryKeys } from '../../utils/queryKeys';
import { usePageTitle } from '../../hooks/usePageTitle';
import { ChatWindow } from '../../components/features/chat/ChatWindow';

export function MessagesPage() {
    const { t, i18n } = useTranslation();
    usePageTitle(t('Messages'));
    const { user } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [activeChatBookingId, setActiveChatBookingId] = useState(null);

    const { data: conversations = [], isLoading, isError, error, refetch } = useQuery({
        queryKey: queryKeys.chat.conversations(),
        queryFn: () => getUserConversations().then(d => d.conversations),
    });

    useEffect(() => {
        const handleNewMessage = () => {
            // New message received, refresh list to show latest message/timestamp
            queryClient.invalidateQueries({ queryKey: queryKeys.chat.conversations() });
        };

        window.addEventListener('upro:chat-message', handleNewMessage);
        return () => window.removeEventListener('upro:chat-message', handleNewMessage);
    }, [queryClient]);

    const filteredConversations = conversations.filter(conv => {
        const otherUser = user?.role === 'CUSTOMER' ? conv.worker : conv.customer;
        const otherUserName = otherUser?.name || '';
        const serviceName = conv.booking?.service?.name || '';
        
        return otherUserName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            serviceName.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const handleConversationClick = (conv) => {
        if (!conv?.bookingId) return;
        setActiveChatBookingId(conv.bookingId);
    };

    const navigateToBooking = (conv) => {
        const path = user?.role === 'CUSTOMER'
            ? `/customer/bookings/${conv.bookingId}`
            : `/worker/bookings/${conv.bookingId}`;
        navigate(path);
    };

    return (
        <MainLayout>
            <div className={getPageLayout('default')}>
                <PageHeader
                    title={t('Messages')}
                    description={t('Chat with your service providers and customers')}
                />

                <div className="max-w-4xl mx-auto space-y-6">
                    <Input
                        icon={Search}
                        placeholder={t('Search by name or service...')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />

                    <AsyncState
                        isLoading={isLoading}
                        isError={isError}
                        error={error}
                        onRetry={refetch}
                        isEmpty={filteredConversations.length === 0}
                        emptyTitle={t('No conversations found')}
                    >
                        <div className="space-y-3">
                            {filteredConversations.map((conv) => {
                                const otherUser = user?.role === 'CUSTOMER' ? conv.worker : conv.customer;
                                const lastMessage = conv.messages?.[0];

                                return (
                                    <Card
                                        key={conv.id}
                                        onClick={() => handleConversationClick(conv)}
                                        className="p-5 cursor-pointer transition-all hover:shadow-lg hover:scale-[1.01] border-none ring-1 ring-black/5 dark:ring-white/10 hover:bg-gray-50 dark:hover:bg-dark-800"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="relative">
                                                {otherUser?.profilePhotoUrl ? (
                                                    <img
                                                        src={resolveProfilePhotoUrl(otherUser.profilePhotoUrl)}
                                                        alt=""
                                                        className="w-14 h-14 rounded-2xl object-cover shadow-sm"
                                                    />
                                                ) : (
                                                    <div className="w-14 h-14 rounded-2xl bg-brand-500/10 flex items-center justify-center text-brand-500 font-bold text-xl">
                                                        {otherUser?.name?.charAt(0) || '?'}
                                                    </div>
                                                )}
                                                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-white dark:border-dark-900" aria-hidden="true" />
                                                <span className="sr-only">{t('Online')}</span>
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1">
                                                    <h3 className="font-bold truncate text-gray-900 dark:text-white">
                                                        {otherUser?.name || t('User')}
                                                    </h3>
                                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">
                                                        {new Date(conv.lastMessageAt).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' })}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2 mb-1">
                                                    <Badge variant="outline" className="text-xs font-bold uppercase py-0 px-1.5 opacity-70">
                                                        {conv.booking?.service?.name}
                                                    </Badge>
                                                </div>

                                                <p className="text-sm truncate font-medium text-gray-500 dark:text-gray-400">
                                                    {lastMessage ? lastMessage.content : t('No messages yet')}
                                                </p>
                                            </div>

                                            <ChevronRight size={20} className="text-gray-300" />
                                        </div>

                                        <div className="mt-3 flex justify-end">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigateToBooking(conv);
                                                }}
                                            >
                                                {t('View Booking')}
                                            </Button>
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    </AsyncState>
                </div>
            </div>

            {activeChatBookingId && (
                <ChatWindow
                    bookingId={activeChatBookingId}
                    onClose={() => setActiveChatBookingId(null)}
                />
            )}
        </MainLayout>
    );
}
