import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const relaySecret = Deno.env.get('CACHE_RELAY_SECRET');
  const incomingSecret = req.headers.get('x-cache-secret');

  if (!relaySecret || incomingSecret !== relaySecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  const relayUrl = Deno.env.get('CACHE_RELAY_URL');
  if (!relayUrl) {
    return new Response('CACHE_RELAY_URL is not configured', { status: 500 });
  }

  const response = await fetch(relayUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: await req.text(),
  });

  const body = await response.text();
  return new Response(body, {
    status: response.status,
    headers: {
      'content-type': response.headers.get('content-type') || 'application/json',
    },
  });
});
