// app/_shared/lib/notifications/requestReminders.ts

// "Reply today" and "Reply overdue" for the audit requests nobody has answered
// yet, on the viewer's calendar. Made when the bell asks for its list, so they
// need no scheduled job; their dedupe keys keep each to one. Server-only.

import type { Db } from '@/app/_shared/lib/supabase/client';
import { requestSearchIds } from '@/app/_shared/lib/requests/requestSearch';
import { requestDue, requestOverdue, type NewNotification } from '@/app/_shared/lib/notifications/messages';
import { notify } from '@/app/_shared/lib/notifications/notify';
import { requestDueKey, requestDueToday } from '@/app/_shared/lib/utils/requestDue';

interface RequestRow {
  id: string;
  name: string;
  emailed_at: string | null;
  request: { name?: string; requested_at?: string } | null;
}

/**
 * Adds the reminders due today, and marks read the ones that no longer need
 * doing: every notification about a request that has been answered, and a
 * "reply today" that has since become overdue. Errors are only logged.
 */
export async function syncRequestReminders(db: Db, userId: string, now: Date, timeZone?: string): Promise<void> {
  try {
    const searchIds = await requestSearchIds(db, userId);
    if (searchIds.length === 0) return;
    const { data, error } = await db
      .from('businesses')
      .select('id, name, emailed_at, request')
      .in('search_id', searchIds)
      .not('request', 'is', null);
    if (error || !data) return;

    const reminders: NewNotification[] = [];
    const answered = new Set<string>();
    const overdue = new Set<string>();
    for (const row of data as RequestRow[]) {
      if (row.emailed_at) {
        answered.add(row.id);
        continue;
      }
      const requestedAt = row.request?.requested_at;
      if (typeof requestedAt !== 'string' || Number.isNaN(Date.parse(requestedAt))) continue;
      const ref = { id: row.id, host: row.name, name: row.request?.name };
      const state = requestDueToday(requestedAt, now, timeZone);
      if (state === 'due') reminders.push(requestDue(ref));
      if (state === 'overdue') {
        overdue.add(row.id);
        reminders.push(requestOverdue(ref, requestDueKey(requestedAt, timeZone)));
      }
    }
    await notify(db, userId, ...reminders);

    if (answered.size === 0 && overdue.size === 0) return;
    const { data: unread } = await db
      .from('notifications')
      .select('id, kind, business_id')
      .eq('user_id', userId)
      .is('read_at', null)
      .not('business_id', 'is', null);
    const done = (unread ?? [])
      .filter((n) => answered.has(n.business_id) || (n.kind === 'request_due' && overdue.has(n.business_id)))
      .map((n) => n.id as string);
    if (done.length > 0) {
      await db.from('notifications').update({ read_at: now.toISOString() }).in('id', done);
    }
  } catch (err) {
    console.error('[notifications] Failed to update the reply reminders:', err instanceof Error ? err.message : err);
  }
}
