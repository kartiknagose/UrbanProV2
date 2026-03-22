import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    Send, X, MessageSquare, Loader2,
    Image as ImageIcon, Paperclip, Mic,
    FileText, Download, Check, AlertCircle, Sparkles,
    Play, Trash2
} from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import {
    getConversationByBooking as fetchConversation,
    getMessages as fetchMessages,
    sendMessage as postMessage,
    uploadChatAttachment
} from '../../../api';
import { queryKeys } from '../../../utils/queryKeys';
import { toast } from 'sonner';

const QUICK_REPLIES = {
    CUSTOMER: ['When will you arrive?', 'Is additional work possible?', 'Thank you!', 'Can you bring extra tools?'],
    WORKER: ["I'm on my way!", "I've arrived.", "Is there parking available?", "I'll need 20 more minutes."]
};

// Role-based quick replies for faster communication

export function ChatWindow({ bookingId, onClose }) {
    const { user } = useAuth();
    const [message, setMessage] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);

    const scrollRef = useRef(null);
    const containerRef = useRef(null);
    const fileInputRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const timerRef = useRef(null);
    const queryClient = useQueryClient();

    // Roles-based quick replies
    const myQuickReplies = QUICK_REPLIES[user?.role] || QUICK_REPLIES.CUSTOMER;

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // 1. Get Conversation
    const { data: conversation, isLoading: convLoading } = useQuery({
        queryKey: queryKeys.chat.booking(bookingId),
        queryFn: () => fetchConversation(bookingId).then(d => d.conversation),
        enabled: !!bookingId
    });

    // 2. Get Messages
    const { data: messages = [], isLoading: msgLoading } = useQuery({
        queryKey: queryKeys.chat.messages(conversation?.id),
        queryFn: () => fetchMessages(conversation.id).then(d => d.messages),
        enabled: !!conversation?.id
    });

    const mutation = useMutation({
        mutationFn: postMessage,
        onSuccess: ({ message: newMessage }) => {
            queryClient.setQueryData(queryKeys.chat.messages(conversation.id), (old) => [...(old || []), newMessage]);
            setMessage('');
        }
    });

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // Live Socket listener
    useEffect(() => {
        const handleNewMessage = (event) => {
            const newMessage = event.detail;
            if (newMessage.conversationId === conversation?.id) {
                if (newMessage.senderId !== user?.id) {
                    queryClient.setQueryData(queryKeys.chat.messages(conversation.id), (old) => [...(old || []), newMessage]);
                }
            }
        };

        window.addEventListener('upro:chat-message', handleNewMessage);
        return () => window.removeEventListener('upro:chat-message', handleNewMessage);
    }, [conversation?.id, queryClient, user?.id]);

    const handleSend = (text = null) => {
        const content = typeof text === 'string' ? text : message;
        if (!content.trim() || mutation.isPending) return;
        mutation.mutate({ conversationId: conversation.id, content, type: 'TEXT' });
    };

    const formatMessageTime = (value) => {
        if (!value) return 'N/A';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0] || e; // Support both event and direct file (from voice)
        if (!file) return;

        try {
            setIsUploading(true);
            const res = await uploadChatAttachment(file);

            // Determine type
            let type = 'DOCUMENT';
            if (file.type.startsWith('image/')) type = 'IMAGE';
            if (file.type.startsWith('audio/')) type = 'VOICE';

            mutation.mutate({
                conversationId: conversation.id,
                type,
                mediaUrl: res.url,
                fileName: res.fileName || (type === 'VOICE' ? 'Voice Message' : undefined),
                fileSize: res.fileSize
            });
            if (type !== 'VOICE') toast.success('File sent');
        } catch (error) {
            console.error('Chat upload error:', error);
            toast.error('Failed to send attachment');
        } finally {
            setIsUploading(false);
            if (e.target) e.target.value = '';
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorderRef.current.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const file = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
                handleFileUpload(file);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            setRecordingDuration(0);
            timerRef.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);
        } catch (_err) {
            toast.error('Microphone access denied', { id: 'mic-access-denied' });
        }
    };

    const stopRecording = (cancel = false) => {
        if (!mediaRecorderRef.current) return;
        clearInterval(timerRef.current);

        if (cancel) {
            mediaRecorderRef.current.onstop = () => { }; // No-op on stop
            mediaRecorderRef.current.stop();
        } else {
            mediaRecorderRef.current.stop();
        }

        setIsRecording(false);
    };


    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const formatSize = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const content = (
        <Motion.div
            ref={containerRef}
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed bottom-4 right-4 w-80 md:w-96 h-[600px] flex flex-col rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] z-[9999] overflow-hidden border bg-white dark:bg-dark-950 border-gray-200 dark:border-dark-800"
        >
            {/* Header */}
            <div className="px-6 py-4 border-b flex items-center justify-between shrink-0 bg-white dark:bg-dark-900 border-gray-100 dark:border-dark-800">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-600">
                        <MessageSquare size={20} />
                    </div>
                    <div>
                        <h3 className="font-black text-sm text-gray-900 dark:text-white leading-none">Smart Messenger</h3>
                        <p className="text-[10px] text-success-500 font-bold uppercase tracking-wider mt-1 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-success-500 animate-pulse"></span>
                            Live Connection
                        </p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-800 transition-colors"
                >
                    <X size={20} />
                </button>
            </div>

            {/* Quick Replies Row */}
            <div className="px-4 py-2 border-b bg-gray-50/50 dark:bg-dark-900/40 border-gray-100 dark:border-dark-800 overflow-x-auto hide-scrollbar whitespace-nowrap flex gap-2">
                <div className="flex items-center gap-1 px-2 text-brand-500 shrink-0">
                    <Sparkles size={14} />
                    <span className="text-[10px] font-black uppercase">Quick:</span>
                </div>
                {myQuickReplies.map((q, idx) => (
                    <button
                        key={idx}
                        onClick={() => handleSend(q)}
                        className="px-3 py-1.5 rounded-full bg-white dark:bg-dark-800 border border-gray-100 dark:border-dark-700 text-[11px] font-bold text-gray-700 dark:text-gray-300 hover:border-brand-500 hover:text-brand-500 transition-all shadow-sm active:scale-95"
                    >
                        {q}
                    </button>
                ))}
            </div>

            {/* Messages Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4 bg-white dark:bg-dark-950 custom-scrollbar">
                {convLoading || msgLoading ? (
                    <div className="flex flex-col items-center justify-center h-full opacity-30 gap-2">
                        <Loader2 className="animate-spin" size={32} />
                        <span className="text-[10px] font-bold uppercase">Syncing Messages</span>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center opacity-40 space-y-3 p-10">
                        <div className="p-4 bg-gray-100 dark:bg-dark-800 rounded-3xl">
                            <MessageSquare size={32} className="text-gray-400" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-[11px] font-black uppercase tracking-widest text-gray-900 dark:text-white">Encrypted Chat</p>
                            <p className="text-[10px] leading-relaxed">Secure communication with your professional is ready.</p>
                        </div>
                    </div>
                ) : (
                    messages.map((m) => {
                        const isMe = m.senderId === user?.id;
                        const displayContent = m.content;

                        return (
                            <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`
                                    max-w-[85%] rounded-2xl p-0.5 shadow-sm overflow-hidden
                                    ${isMe ? 'bg-brand-600 rounded-tr-none' : 'bg-gray-100 dark:bg-dark-800 rounded-tl-none'}
                                `}>
                                    {/* Bubble Content - Types */}
                                    <div className={`px-4 py-2.5 ${isMe ? 'text-white' : 'text-gray-800 dark:text-gray-200'}`}>
                                        {m.type === 'IMAGE' && (
                                            <div className="mb-2 rounded-xl overflow-hidden bg-black/5">
                                                <img src={m.mediaUrl} alt="Attached" className="max-w-full h-auto object-cover max-h-60" />
                                            </div>
                                        )}
                                        {m.type === 'VOICE' && (
                                            <div className="flex items-center gap-3 p-3 rounded-xl mb-1 bg-black/5 dark:bg-black/20">
                                                <button className={`w-8 h-8 rounded-full flex items-center justify-center ${isMe ? 'bg-white text-brand-600' : 'bg-brand-600 text-white'}`}>
                                                    <Play size={14} fill="currentColor" />
                                                </button>
                                                <div className="flex-1 space-y-1">
                                                    <div className="h-1 bg-gray-300 dark:bg-dark-600 rounded-full w-full overflow-hidden">
                                                        <div className={`h-full ${isMe ? 'bg-white' : 'bg-brand-500'}`} style={{ width: '0%' }}></div>
                                                    </div>
                                                    <p className="text-[8px] font-black uppercase tracking-widest opacity-60">Voice Note</p>
                                                </div>
                                            </div>
                                        )}
                                        {m.type === 'DOCUMENT' && (
                                            <a
                                                href={m.mediaUrl} target="_blank" rel="noreferrer"
                                                className={`flex items-center gap-3 p-3 rounded-xl mb-1 ${isMe ? 'bg-black/10' : 'bg-white dark:bg-dark-900 border dark:border-dark-700'}`}
                                            >
                                                <div className="p-2 rounded-lg bg-brand-500/20 text-brand-500"><FileText size={18} /></div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-bold truncate">{m.fileName || 'Document'}</p>
                                                    <p className="text-[9px] opacity-70 uppercase tracking-tighter">{formatSize(m.fileSize)}</p>
                                                </div>
                                                <Download size={14} className="opacity-50" />
                                            </a>
                                        )}
                                        {m.content && (
                                            <div className="relative group">
                                                <p className="text-sm font-medium leading-relaxed break-words">{displayContent}</p>
                                            </div>
                                        )}
                                        <div className={`flex items-center gap-1 mt-1 font-bold uppercase tracking-tighter text-[9px] ${isMe ? 'justify-end text-white/60' : 'justify-start opacity-40'}`}>
                                            {formatMessageTime(m.createdAt)}
                                            {isMe && <Check size={10} />}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Input Bar */}
            <div className="p-5 border-t bg-gray-50/80 dark:bg-dark-900/60 border-gray-100 dark:border-dark-800">
                <AnimatePresence mode="wait">
                    {isRecording ? (
                        <Motion.div
                            key="recording"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="flex items-center gap-4 bg-white dark:bg-dark-800 p-2 rounded-2xl border border-brand-500 ring-4 ring-brand-500/10"
                        >
                            <div className="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center text-white animate-pulse">
                                <Mic size={20} />
                            </div>
                            <div className="flex-1 flex items-center gap-3">
                                <span className="text-sm font-black text-brand-500 tabular-nums">{formatTime(recordingDuration)}</span>
                                <div className="h-1 flex-1 bg-gray-100 dark:bg-dark-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-brand-500 animate-[pulse_1s_infinite]"></div>
                                </div>
                            </div>
                            <button onClick={() => stopRecording(true)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={20} /></button>
                            <button onClick={() => stopRecording(false)} className="px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest">Send</button>
                        </Motion.div>
                    ) : (
                        <Motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
                            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className="p-3 rounded-2xl bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 text-gray-500 hover:text-brand-500 transition-all active:scale-90 shrink-0"
                            >
                                {isUploading ? <Loader2 size={18} className="animate-spin text-brand-500" /> : <Paperclip size={18} />}
                            </button>

                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Type back..."
                                    className="w-full pl-4 pr-12 py-3.5 rounded-2xl text-sm font-bold transition-all outline-none border border-gray-200 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 bg-white dark:bg-dark-800 dark:border-dark-700 dark:text-white"
                                />
                                <button
                                    type="button"
                                    onClick={startRecording}
                                    className="absolute right-1.5 top-1.5 bottom-1.5 px-3 text-gray-400 hover:text-brand-500 transition-colors"
                                >
                                    <Mic size={18} />
                                </button>
                            </div>

                            <button
                                onClick={() => handleSend()}
                                disabled={(!message.trim() && !isUploading) || mutation.isPending}
                                className="p-3.5 bg-brand-600 text-white rounded-2xl hover:bg-brand-700 disabled:bg-gray-200 dark:disabled:bg-dark-700 transition-all active:scale-95 shadow-md shadow-brand-500/20 flex items-center justify-center shrink-0"
                            >
                                {mutation.isPending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                            </button>
                        </Motion.div>
                    )}
                </AnimatePresence>
            </div>
        </Motion.div>
    );

    return createPortal(
        <AnimatePresence>
            {content}
        </AnimatePresence>,
        document.body
    );
}

export function ChatToggle({ bookingId, label = "Instant Chat" }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className={`
                    flex items-center gap-2 px-5 py-2.5 rounded-2xl border font-black text-[11px] uppercase tracking-wider
                    transition-all active:scale-95 shadow-xl bg-white border-gray-100 text-gray-900 
                    hover:border-brand-500 hover:text-brand-600 dark:bg-dark-800 dark:border-dark-700 dark:text-white
                `}
            >
                <MessageSquare size={16} className="text-brand-500" />
                {label}
            </button>

            {isOpen && <ChatWindow bookingId={bookingId} onClose={() => setIsOpen(false)} />}
        </>
    );
}
