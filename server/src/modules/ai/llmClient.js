const axios = require('axios');
const CircuitBreaker = require('../../common/utils/circuitBreaker');

const groqBreaker = new CircuitBreaker('groq', {
  failureThreshold: 5,
  resetTimeout: 60000,
  successThreshold: 2,
});

const openAiBreaker = new CircuitBreaker('openai', {
  failureThreshold: 5,
  resetTimeout: 60000,
  successThreshold: 2,
});

function clampGroqTimeout(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 8000;
  return Math.max(3000, Math.min(12000, Math.trunc(numeric)));
}

async function callGroqChatOnce({ systemPrompt, userPrompt }) {
  return groqBreaker.execute(async () => {
    const apiKey = String(process.env.GROQ_API_KEY || '').trim();
    if (!apiKey) {
      throw new Error('GROQ_API_KEY is not configured.');
    }

    const model = String(process.env.GROQ_MODEL || 'llama3-8b-8192').trim();
    const timeoutMs = clampGroqTimeout(process.env.GROQ_TIMEOUT_MS || 4000);

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      },
      {
        timeout: timeoutMs,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const content = String(response?.data?.choices?.[0]?.message?.content || '').trim();
    if (!content) {
      throw new Error('Invalid Groq response content.');
    }

    return content;
  });
}

async function callOpenAiChatOnce({ systemPrompt, userPrompt }) {
  return openAiBreaker.execute(async () => {
    const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured.');
    }

    const model = String(process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini').trim();
    const timeoutMs = clampGroqTimeout(process.env.AI_CHAT_TIMEOUT_MS || process.env.GROQ_TIMEOUT_MS || 8000);

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      },
      {
        timeout: timeoutMs,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const content = String(response?.data?.choices?.[0]?.message?.content || '').trim();
    if (!content) {
      throw new Error('Invalid OpenAI response content.');
    }

    return content;
  });
}

async function callWithProviderRetry(providerCall, label, payload) {
  try {
    const content = await providerCall(payload);
    return { ok: true, content, error: null };
  } catch (firstError) {
    console.log(`[ai-${label}] first attempt failed:`, firstError?.message || firstError);
    try {
      const content = await providerCall(payload);
      return { ok: true, content, error: null };
    } catch (secondError) {
      console.log(`[ai-${label}] retry failed:`, secondError?.message || secondError);
      return { ok: false, content: '', error: secondError };
    }
  }
}

async function callGroqChatWithSingleRetry({ systemPrompt, userPrompt }) {
  const payload = { systemPrompt, userPrompt };
  const providers = [
    { name: 'groq', isConfigured: Boolean(String(process.env.GROQ_API_KEY || '').trim()), call: callGroqChatOnce },
    { name: 'openai', isConfigured: Boolean(String(process.env.OPENAI_API_KEY || '').trim()), call: callOpenAiChatOnce },
  ];

  let lastError = null;
  for (const provider of providers) {
    if (!provider.isConfigured) continue;
    const result = await callWithProviderRetry(provider.call, provider.name, payload);
    if (result.ok) return result;
    lastError = result.error;
  }

  return {
    ok: false,
    content: '',
    error: lastError || new Error('No configured AI provider is available.'),
  };
}

module.exports = {
  callGroqChatWithSingleRetry,
};
