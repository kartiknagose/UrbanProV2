import { createClient } from '@supabase/supabase-js';
import { clientEnv } from './env';

export const supabase = clientEnv.supabaseUrl && clientEnv.supabaseAnonKey
  ? createClient(clientEnv.supabaseUrl, clientEnv.supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;
