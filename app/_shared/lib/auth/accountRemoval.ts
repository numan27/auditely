// app/_shared/lib/auth/accountRemoval.ts

// Deletes a Supabase user, which only the service role can do. Settings → Delete
// account hands over the signed-in account's own id, never one from a request.
// Every table that holds the account's data cascades from auth.users, so its rows
// go with it. Server-only.

import { serviceDb } from '@/app/_shared/lib/supabase/client';

/** Deletes the user and everything in it; Supabase's reason when it refuses, or null */
export async function deleteUser(userId: string): Promise<string | null> {
  const { error } = await serviceDb.auth.admin.deleteUser(userId);
  return error ? error.message : null;
}
