import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Download, Loader2, MessageSquare, Send, X } from 'lucide-react';
import { sendAIChatMessage } from '../../../api/ai';
import { useSOS } from '../../../context/SOSContext';
import { useAuth } from '../../../hooks/useAuth';

const CHAT_STATE_KEY = 'ai_command_widget_state_v1';

function getInitialOpenState() {
  if (typeof window === 'undefined') return false;

  try {
    const raw = window.sessionStorage.getItem(CHAT_STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.open === 'boolean') {
        return parsed.open;
      }
    }
  } catch {
    // Ignore invalid stored state and fall back to a visible desktop panel.
  }

  return window.matchMedia('(min-width: 1024px)').matches;
}

const ROLE_CONFIG = {
  CUSTOMER: {
    assistantName: 'Rico AI',
    roleLabel: 'Customer',
    accentClass: 'from-sky-600 via-cyan-500 to-emerald-500',
    starterSuggestions: [
      'Book plumber tomorrow 10 AM in Shegaon',
      'Show my wallet balance',
      'Show my latest booking status',
      'Help me understand pending payments',
    ],
    quickActions: [
      { label: 'Book Service', prompt: 'Book electrician tomorrow 11 AM in Mumbai' },
      { label: 'My Bookings', prompt: 'Show my latest booking' },
      { label: 'Wallet', prompt: 'Show my wallet balance' },
      { label: 'Notifications', prompt: 'Show notifications' },
    ],
  },
  WORKER: {
    assistantName: 'Vera AI',
    roleLabel: 'Professional',
    accentClass: 'from-emerald-600 via-teal-500 to-cyan-500',
    starterSuggestions: [
      'Show my worker bookings',
      'Show payout history',
      'Show verification status',
      'Add availability monday 10:00 to 13:00',
    ],
    quickActions: [
      { label: 'Bookings', prompt: 'Show my worker bookings' },
      { label: 'Payouts', prompt: 'Show payout details' },
      { label: 'Availability', prompt: 'Show availability' },
      { label: 'Verify', prompt: 'Show verification status' },
    ],
  },
  ADMIN: {
    assistantName: 'Admin AI',
    roleLabel: 'Administrator',
    accentClass: 'from-amber-600 via-orange-500 to-rose-500',
    starterSuggestions: [
      'Show dashboard',
      'Show verification queue',
      'Show fraud alerts',
      'Show analytics summary',
    ],
    quickActions: [
      { label: 'Dashboard', prompt: 'Show dashboard' },
      { label: 'Users', prompt: 'Show users' },
      { label: 'Verification', prompt: 'Show verification queue' },
      { label: 'Fraud', prompt: 'Show fraud alerts' },
    ],
  },
  GUEST: {
    assistantName: 'AI Assistant',
    roleLabel: 'Guest',
    accentClass: 'from-sky-600 via-cyan-500 to-emerald-500',
    starterSuggestions: [
      'Show services',
      'Show top workers',
      'Open profile',
      'Show notifications',
    ],
    quickActions: [
      { label: 'Services', prompt: 'Show services' },
      { label: 'Workers', prompt: 'Show top workers' },
      { label: 'Bookings', prompt: 'Show my bookings' },
      { label: 'Wallet', prompt: 'Show my wallet balance' },
    ],
  },
};

function getRoleConfig(role) {
  const key = String(role || '').toUpperCase();
  return ROLE_CONFIG[key] || ROLE_CONFIG.GUEST;
}

function getStarterSuggestions(role) {
  return getRoleConfig(role).starterSuggestions;
}

const intentSuggestions = {
  create_booking: ['Book electrician tomorrow 11 AM in Mumbai', 'Show services list', 'Show my latest booking status', 'Cancel booking 12'],
  search_service: ['Book plumber tomorrow 10 AM in Pune', 'Top workers', 'Services in pune', 'Show my wallet balance'],
  get_booking_status: ['Booking details 12', 'Cancel booking 12', 'Show my wallet balance', 'Platform guide'],
  view_wallet: ['See history', 'Redeem 200', 'Show notifications', 'Booking status'],
  payment_history: ['Show my wallet balance', 'Validate coupon SAVE50 amount 1200', 'My referral code', 'Platform guide'],
  notifications: ['Mark all notifications read', 'Show my wallet balance', 'Show my latest booking status', 'Platform guide'],
  reviews: ['Pending reviews', 'Review booking 12 with 5 stars', 'Show my latest booking status', 'Platform guide'],
  availability: ['Add availability monday 10:00 to 13:00', 'Remove availability slot 12', 'Payout details', 'Platform guide'],
  payout_history: ['Payout details', 'Update payout method UPI test@upi', 'Instant payout', 'Platform guide'],
  profile_view: ['Update profile', 'Show my wallet balance', 'Show notifications', 'Platform guide'],
  safety_contacts: ['Add emergency contact Rahul 9999999999', 'Remove emergency contact 3', 'Trigger SOS booking 12', 'Platform guide'],
  platform_guide: ['Show my wallet balance', 'Show notifications', 'My conversations', 'Show profile'],
};

function suggestionsFromIntent(intentName, role) {
  const key = String(intentName || '').trim();
  return intentSuggestions[key] || getStarterSuggestions(role);
}

function AssistantMessageContent({ text }) {
  const normalized = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!normalized) return null;

  const paragraphs = normalized.split(/\n{2,}/).map((entry) => entry.trim()).filter(Boolean);

  return (
    <div className="space-y-2">
      {paragraphs.map((paragraph, index) => {
        const lines = paragraph.split('\n').map((line) => line.trim()).filter(Boolean);
        const isBullet = lines.length > 0 && lines.every((line) => /^[-*•]\s+/.test(line));
        const isNumbered = lines.length > 0 && lines.every((line) => /^\d+\.\s+/.test(line));

        if (isBullet) {
          return (
            <ul key={`p-${index}`} className="space-y-1 pl-4">
              {lines.map((line, itemIndex) => (
                <li key={`b-${itemIndex}`} className="list-disc">
                  {line.replace(/^[-*•]\s+/, '')}
                </li>
              ))}
            </ul>
          );
        }

        if (isNumbered) {
          return (
            <ol key={`p-${index}`} className="space-y-1 pl-4">
              {lines.map((line, itemIndex) => (
                <li key={`n-${itemIndex}`} className="list-decimal">
                  {line.replace(/^\d+\.\s+/, '')}
                </li>
              ))}
            </ol>
          );
        }

        return (
          <p key={`p-${index}`} className="leading-relaxed">
            {lines.join(' ')}
          </p>
        );
      })}
    </div>
  );
}

function MessageBubble({ role, text }) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={[
          'max-w-[88%] rounded-2xl px-3 py-2 text-sm break-words',
          isUser
            ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
            : 'border border-white/10 bg-white/8 text-white shadow-sm shadow-black/20',
        ].join(' ')}
      >
        {isUser ? text : <AssistantMessageContent text={text} />}
      </div>
    </div>
  );
}

function normalizeAgentTarget(target, role) {
  const raw = String(target || '').trim();
  if (!raw) return raw;

  const userRole = String(role || '').toUpperCase();
  if (raw === '/bookings') {
    if (userRole === 'WORKER') return '/worker/bookings';
    if (userRole === 'ADMIN') return '/admin/bookings';
    return '/customer/bookings';
  }

  if (raw === '/profile') {
    if (userRole === 'WORKER') return '/worker/profile';
    return '/customer/profile';
  }

  const aliasMap = {
    '/notifications': '/notifications/preferences',
    '/admin/fraud-alerts': '/admin/fraud',
    '/wallet': userRole === 'WORKER' ? '/worker/earnings' : '/customer/wallet',
  };

  return aliasMap[raw] || raw;
}

export default function AICommandWidget() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeBooking } = useSOS();
  const roleConfig = useMemo(() => getRoleConfig(user?.role), [user?.role]);
  const [open, setOpen] = useState(getInitialOpenState);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [pendingConfirmation, setPendingConfirmation] = useState(null);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Hi. I can help with bookings, wallet, notifications, and role-specific actions. Pick an option or type your request.',
    },
  ]);
  const [suggestions, setSuggestions] = useState(getStarterSuggestions(user?.role));
  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);

  const exportChat = () => {
    try {
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        sessionId: sessionId || null,
        page: window.location.pathname,
        messageCount: messages.length,
        messages: messages.map((message, index) => ({
          index: index + 1,
          role: message.role,
          text: message.text,
        })),
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const sessionSuffix = sessionId ? String(sessionId).replace(/[^a-zA-Z0-9_-]/g, '-') : 'local';
      link.href = url;
      link.download = `ai-chat-export-${sessionSuffix}-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      appendAssistantMessage('Could not export chat right now. Please try again.');
    }
  };

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(CHAT_STATE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.messages) && parsed.messages.length > 0) {
        setMessages(parsed.messages);
      }
      if (Array.isArray(parsed?.suggestions) && parsed.suggestions.length > 0) {
        setSuggestions(parsed.suggestions);
      }
      if (parsed?.sessionId) {
        setSessionId(parsed.sessionId);
      }
      if (typeof parsed?.open === 'boolean') {
        setOpen(parsed.open);
      }
    } catch {
      // Ignore invalid stored chat state.
    }
  }, []);

  useEffect(() => {
    setSuggestions((prev) => (prev?.length ? prev : getStarterSuggestions(user?.role)));
  }, [user?.role]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        CHAT_STATE_KEY,
        JSON.stringify({
          sessionId,
          open,
          messages,
          suggestions,
        })
      );
    } catch {
      // Best-effort persistence only.
    }
  }, [sessionId, open, messages, suggestions]);

  const appendAssistantMessage = (text) => {
    const clean = String(text || '').trim();
    if (!clean) return;
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === 'assistant' && last?.text === clean) {
        return prev;
      }
      return [...prev, { role: 'assistant', text: clean }];
    });
  };

  const scrollToLatest = () => {
    if (!messagesContainerRef.current) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  };

  useEffect(() => {
    if (!open) return;
    scrollToLatest();
  }, [open, messages, loading]);

  const applyAiResponse = (data, fallbackMessage) => {
    if (data?.sessionId && !sessionId) {
      setSessionId(data.sessionId);
    }

    if (data?.transcript) {
      setMessages((prev) => [...prev, { role: 'user', text: data.transcript }]);
    }

    const responseType = String(data?.type || 'text').trim();
    const responseMessage = data?.message || data?.reply || fallbackMessage;

    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        text: responseMessage,
      },
    ]);

    if (responseType === 'confirmation') {
      setPendingConfirmation({
        sessionId: data?.sessionId || sessionId,
        metadata: data?.metadata || null,
      });
    } else {
      setPendingConfirmation(null);
    }

    if (data?.action === 'navigate' && data?.target) {
      navigate(normalizeAgentTarget(data.target, user?.role));
    }

    if (Array.isArray(data?.suggestions) && data.suggestions.length) {
      setSuggestions(data.suggestions.slice(0, 4));
      return;
    }

    const nextSuggestions = suggestionsFromIntent(data?.intent?.intent, user?.role);
    setSuggestions(nextSuggestions.slice(0, 4));
  };

  const sendMessage = async (text) => {
    const message = String(text || '').trim();
    if (!message || loading) return;

    setMessages((prev) => [...prev, { role: 'user', text: message }]);
    setInput('');
    setLoading(true);

    try {
      const data = await sendAIChatMessage({ message, sessionId });
      applyAiResponse(data, 'I could not generate a response right now.');
    } catch (error) {
      const rawError = String(error?.response?.data?.error || error?.message || '').toLowerCase();
      let friendlyError = error?.response?.data?.error || 'Something went wrong. Please try again.';

      if (rawError.includes('authentication service unavailable') || rawError.includes('unauthorized')) {
        friendlyError = 'Session check failed. Please refresh once and sign in again.';
      } else if (rawError.includes('timeout') || rawError.includes('econnaborted')) {
        friendlyError = 'The request timed out. Please try again in a few seconds.';
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: friendlyError,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmation = async (confirmed) => {
    if (loading) return;
    const confirmationText = confirmed ? 'yes' : 'no';
    await sendMessage(confirmationText);
    setPendingConfirmation(null);
  };

  const floatingOffsetClass = activeBooking ? 'bottom-24 lg:bottom-10' : 'bottom-5';
  const floatingRightClass = activeBooking ? 'right-5 lg:right-8' : 'right-5';
  const floatingPanelStyle = {
    width: 'min(23rem, calc(100vw - 0.75rem))',
    height: 'min(31rem, calc(100dvh - 5.5rem))',
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`fixed ${floatingOffsetClass} ${floatingRightClass} z-[70] inline-flex items-center gap-2 rounded-full bg-gradient-to-r ${roleConfig.accentClass} px-4 py-3 text-sm font-semibold text-white shadow-xl transition hover:brightness-110`}
          aria-label="Open AI assistant"
        >
          <Bot size={16} />
          {roleConfig.assistantName}
        </button>
      )}

      {open && (
        <div
          className={`fixed ${floatingOffsetClass} ${floatingRightClass} z-[70] flex flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-950/95 shadow-2xl shadow-black/40 backdrop-blur-xl dark:border-zinc-700 dark:bg-zinc-950/95`}
          style={floatingPanelStyle}
        >
          <div className={`bg-gradient-to-r ${roleConfig.accentClass} px-3.5 py-3.5 text-white shadow-lg shadow-black/10`}>
            <div className="flex items-start justify-between gap-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/15">
                    <MessageSquare size={15} className="opacity-95" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold leading-tight">{roleConfig.assistantName}</p>
                    <p className="text-[10px] font-medium uppercase tracking-[0.16em] opacity-80">{roleConfig.roleLabel} Mode</p>
                  </div>
                </div>
                <p className="mt-1.5 max-w-[18rem] text-[11px] leading-snug text-white/78">
                  Ask for bookings, payout status, wallet actions, or worker tools.
                </p>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={exportChat}
                  className="rounded-xl p-1.5 text-white/85 transition hover:bg-white/15 hover:text-white"
                  aria-label="Export chat"
                  title="Export chat"
                >
                  <Download size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-xl p-1.5 text-white/85 transition hover:bg-white/15 hover:text-white"
                  aria-label="Close AI assistant"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {roleConfig.quickActions.map((actionItem) => (
                <button
                  key={actionItem.label}
                  type="button"
                  onClick={() => sendMessage(actionItem.prompt)}
                  className="shrink-0 rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap transition hover:bg-white/20"
                >
                  {actionItem.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-3.5 py-2 text-white/70">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">Conversation</span>
            </div>

            {pendingConfirmation && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleConfirmation(true)}
                  disabled={loading}
                  className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmation(false)}
                  disabled={loading}
                  className="rounded-lg bg-zinc-200 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-800 transition hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div ref={messagesContainerRef} className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.10),transparent_40%),linear-gradient(180deg,rgba(9,9,11,0.92)_0%,rgba(17,24,39,0.98)_100%)] p-2.5">
            <div className="space-y-2.5">
              {messages.map((message, index) => (
                <MessageBubble key={`${message.role}-${index}`} role={message.role} text={message.text} />
              ))}
            </div>
            {loading && (
              <div className="mt-2.5 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
                <Loader2 size={13} className="animate-spin" />
                Thinking...
              </div>
            )}
            {!loading && messages.length <= 1 && (
              <div className="mt-2.5 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/70">
                <p className="font-semibold text-white">Ready for worker tasks</p>
                <p className="mt-1 leading-relaxed text-white/60">
                  Use a quick action above or type a request to see bookings, payouts, availability, or verification status.
                </p>
              </div>
            )}
            <div ref={messagesEndRef} aria-hidden="true" />
          </div>

          <div className="border-t border-white/10 bg-black/30 px-3 py-2.5 backdrop-blur-md">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">Suggested Prompts</p>
              <span className="text-[10px] text-white/35">Swipe to see more</span>
            </div>
            <div className="mb-2.5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => sendMessage(suggestion)}
                  className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] whitespace-nowrap text-white/75 transition hover:bg-white/10 hover:text-white"
                >
                  {suggestion}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && canSend) {
                    event.preventDefault();
                    sendMessage(input);
                  }
                }}
                placeholder="Type a command..."
                className="h-10 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none ring-sky-300 placeholder:text-white/35 transition focus:ring"
              />
              <button
                type="button"
                onClick={() => sendMessage(input)}
                disabled={!canSend}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500 text-white transition disabled:cursor-not-allowed disabled:opacity-60 hover:bg-sky-400"
                aria-label="Send message"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
