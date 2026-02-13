import { createClient } from '@supabase/supabase-js';
import { env } from './env';

// Admin client using service role key — bypasses RLS
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});
