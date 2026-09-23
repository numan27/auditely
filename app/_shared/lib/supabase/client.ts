// app/_shared/lib/supabase/client.ts

import { createClient } from '@supabase/supabase-js';

// Server-only client. Prefer the service-role key so Row Level Security can stay
// enabled with no public policies; the anon key fallback only works while RLS is off.
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseKey = serviceRoleKey || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
}

if (!serviceRoleKey) {
  console.warn(
    '[supabase] SUPABASE_SERVICE_ROLE_KEY is not set — falling back to SUPABASE_ANON_KEY. ' +
      'This stops working once Row Level Security is enabled.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
