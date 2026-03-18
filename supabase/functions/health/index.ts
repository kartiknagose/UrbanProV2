import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

serve(() => {
  return new Response(
    JSON.stringify({
      ok: true,
      service: 'urbanpro-supabase',
      timestamp: new Date().toISOString(),
    }),
    {
      headers: {
        'content-type': 'application/json',
      },
    },
  );
});
