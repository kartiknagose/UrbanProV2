const axios = require('axios');
const CircuitBreaker = require('../../common/utils/circuitBreaker');

const groqBreaker = new CircuitBreaker('groq', {
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

async function callGroqChatWithSingleRetry({ systemPrompt, userPrompt }) {
  try {
    const content = await callGroqChatOnce({ systemPrompt, userPrompt });
    return { ok: true, content, error: null };
  } catch (firstError) {
    console.log('[ai-groq] first attempt failed:', firstError?.message || firstError);
    try {
      const content = await callGroqChatOnce({ systemPrompt, userPrompt });
      return { ok: true, content, error: null };
    } catch (secondError) {
      console.log('[ai-groq] retry failed:', secondError?.message || secondError);
      return { ok: false, content: '', error: secondError };
    }
  }
}

module.exports = {
  callGroqChatWithSingleRetry,
};
