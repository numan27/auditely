// app/_shared/lib/notifications/notify.ts

// Stores notifications for the header bell. Server-only. A notification is
// never worth failing the work it reports on: errors are logged, not thrown.

import { supabase } from '@/app/_shared/lib/supabase/client';
import type { NewNotification } from '@/app/_shared/lib/notifications/messages';
import { NOTIFICATIONS_MIGRATION } from '@/app/_shared/lib/notifications/notificationTypes';

export { NOTIFICATIONS_MIGRATION };

/** The notifications table doesn't exist: PostgREST's "not in the schema cache", or Postgres' "undefined table" */
export const isMissingTable = (error: { code?: string } | null | undefined) =>
  error?.code === 'PGRST205' || error?.code === '42P01';

/** Adds notifications; one whose dedupe key is already stored is skipped. Returns whether it worked. */
export async function notify(...notifications: NewNotification[]): Promise<boolean> {
  if (notifications.length === 0) return true;
  try {
    const { error } = await supabase
      .from('notifications')
      .upsert(notifications, { onConflict: 'dedupe_key', ignoreDuplicates: true });
    if (!error) return true;
    console.error(
      '[notifications] Failed to store:',
      isMissingTable(error) ? `run ${NOTIFICATIONS_MIGRATION} in Supabase (${error.message})` : error.message
    );
  } catch (err) {
    console.error('[notifications] Failed to store:', err instanceof Error ? err.message : err);
  }
  return false;
}
