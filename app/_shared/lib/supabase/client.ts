// app/_shared/lib/supabase/client.ts

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Server-only service client, for work no signed-in user owns (the shared PageSpeed
// cache, the inbound webhook, looking up the owner). User-scoped routes use userDb()
// from server.ts instead. Prefer the service-role key so Row Level Security can stay
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

/** A database client: the service client, or one acting as a signed-in user */
export type Db = SupabaseClient;

export const serviceDb: Db = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
