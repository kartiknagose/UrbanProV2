import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Download, Loader2, MessageSquare, Mic, Send, Square, X } from 'lucide-react';
import { sendAIChatMessage, sendAIVoiceAudio } from '../../../api/ai';

const CHAT_STATE_KEY = 'ai_command_widget_state_v1';

const starterSuggestions = [
  'Book plumber tomorrow 10 AM in Pune',
  'Show my wallet balance',
  'Show my latest booking status',
  'Cancel booking 12',
];

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

function suggestionsFromIntent(intentName) {
  const key = String(intentName || '').trim();
  return intentSuggestions[key] || starterSuggestions;
}

function MessageBubble({ role, text }) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={[
          'max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed',
          isUser ? 'bg-sky-600 text-white' : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100',
        ].join(' ')}
      >
        {text}
      </div>
    </div>
  );
}

export default function AICommandWidget() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState(null);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Hi, I can help with booking, wallet, and booking status. Type your request.',
    },
  ]);
  const [suggestions, setSuggestions] = useState(starterSuggestions);
  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const recordingMimeTypeRef = useRef('audio/webm');

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

  useEffect(() => () => {
    mediaStreamRef.current?.getTracks?.().forEach((track) => track.stop());
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }, []);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const pickRecorderMimeType = () => {
    if (typeof window.MediaRecorder?.isTypeSupported !== 'function') {
      return '';
    }

    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
    ];

    return candidates.find((type) => window.MediaRecorder.isTypeSupported(type)) || '';
  };

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
      navigate(String(data.target));
    }

    if (Array.isArray(data?.suggestions) && data.suggestions.length) {
      setSuggestions(data.suggestions.slice(0, 4));
      return;
    }

    const nextSuggestions = suggestionsFromIntent(data?.intent?.intent);
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
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: error?.response?.data?.error || 'Something went wrong. Please try again.',
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

  const startVoiceRecording = async () => {
    if (loading || isRecording) return;

    const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
    if (!window.isSecureContext && !isLocalHost) {
      appendAssistantMessage('Voice recording requires HTTPS. Open the app on an HTTPS URL and try again.');
      return;
    }

    if (!navigator?.mediaDevices?.getUserMedia || typeof window.MediaRecorder === 'undefined') {
      appendAssistantMessage('Voice recording is not supported in this browser. Try Chrome or Edge latest version.');
      return;
    }

    if (navigator.permissions?.query) {
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
        if (permissionStatus.state === 'denied') {
          appendAssistantMessage('Microphone access is blocked in browser settings. Allow mic for this site and reload once.');
          return;
        }
      } catch {
        // Some browsers do not support querying microphone permission state.
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickRecorderMimeType();
      const recorder = mimeType
        ? new window.MediaRecorder(stream, { mimeType })
        : new window.MediaRecorder(stream);

      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recordingMimeTypeRef.current = recorder.mimeType || mimeType || 'audio/webm';

      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }

        const blobType = recordingMimeTypeRef.current || 'audio/webm';
        const extension = blobType.includes('mp4') ? 'm4a' : blobType.includes('ogg') ? 'ogg' : 'webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: blobType });
        const audioFile = new File([audioBlob], `ai-voice-${Date.now()}.${extension}`, { type: blobType });

        mediaStreamRef.current?.getTracks?.().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;

        if (!audioBlob.size) {
          setIsProcessingVoice(false);
          appendAssistantMessage('Could not capture audio. Please try again.');
          return;
        }

        setLoading(true);
        try {
          const data = await sendAIVoiceAudio({ audioFile, sessionId });
          applyAiResponse(data, 'I could not process your voice command right now.');
        } catch (error) {
          appendAssistantMessage(error?.response?.data?.error || 'Voice command failed. Please try again.');
        } finally {
          setLoading(false);
          setIsProcessingVoice(false);
        }
      };

      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      setIsProcessingVoice(false);
      appendAssistantMessage('Listening... Tap stop to send voice command.');
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      const errorName = String(error?.name || '');
      if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
        appendAssistantMessage('Microphone access was denied. Allow microphone for this site in browser permissions and reload.');
        return;
      }

      if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
        appendAssistantMessage('No microphone was found on this device. Connect a microphone and try again.');
        return;
      }

      if (errorName === 'NotReadableError' || errorName === 'TrackStartError') {
        appendAssistantMessage('Microphone is currently busy in another app/tab. Close other apps using mic and try again.');
        return;
      }

      if (errorName === 'SecurityError') {
        appendAssistantMessage('Voice recording is blocked due to browser security context. Use HTTPS and reload.');
        return;
      }

      appendAssistantMessage('Unable to start voice recording. Please retry or use text command.');
    }
  };

  const stopVoiceRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;
    setIsProcessingVoice(true);
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:bg-sky-500"
          aria-label="Open AI assistant"
        >
          <Bot size={16} />
          AI Assistant
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-50 flex h-[520px] w-[360px] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800">
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-sky-500" />
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">AI Command Center</span>
            </div>

            {pendingConfirmation && (
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleConfirmation(true)}
                  disabled={loading}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmation(false)}
                  disabled={loading}
                  className="rounded-lg bg-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
                >
                  Cancel
                </button>
              </div>
            )}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={exportChat}
                className="rounded-md p-1 text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                aria-label="Export chat"
                title="Export chat"
              >
                <Download size={16} />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                aria-label="Close AI assistant"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div ref={messagesContainerRef} className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.map((message, index) => (
              <MessageBubble key={`${message.role}-${index}`} role={message.role} text={message.text} />
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Loader2 size={14} className="animate-spin" />
                Thinking...
              </div>
            )}
            <div ref={messagesEndRef} aria-hidden="true" />
          </div>

          <div className="border-t border-zinc-200 p-3 dark:border-zinc-700">
            <div className="mb-2 flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => sendMessage(suggestion)}
                  className="rounded-full border border-zinc-300 px-2 py-1 text-xs text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
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
                className="h-10 w-full rounded-xl border border-zinc-300 px-3 text-sm outline-none ring-sky-300 transition focus:ring dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <button
                type="button"
                onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                disabled={loading}
                className={[
                  'inline-flex h-10 w-10 items-center justify-center rounded-xl text-white transition disabled:cursor-not-allowed disabled:opacity-60',
                  isRecording ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500',
                ].join(' ')}
                aria-label={isRecording ? 'Stop voice recording' : 'Start voice recording'}
                title={isRecording ? 'Stop recording' : 'Start voice command'}
              >
                {isRecording ? <Square size={14} /> : <Mic size={14} />}
              </button>
              <button
                type="button"
                onClick={() => sendMessage(input)}
                disabled={!canSend || isRecording}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white transition disabled:cursor-not-allowed disabled:opacity-60 hover:bg-sky-500"
                aria-label="Send message"
              >
                <Send size={14} />
              </button>
            </div>

            {(isRecording || isProcessingVoice) && (
              <div className="mt-2 flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-[11px] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                {isRecording ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 font-medium text-red-500">
                      <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                      Recording...
                    </span>
                    <span className="font-semibold tabular-nums">{formatDuration(recordingSeconds)}</span>
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <Loader2 size={12} className="animate-spin" />
                    Processing voice command...
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
