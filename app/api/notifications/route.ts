// app/api/notifications/route.ts

// The header bell. GET lists the latest notifications and the unread count,
// after adding the reply reminders due on the viewer's calendar (?tz=, their
// IANA time zone). PATCH marks some read, or all. POST records an "Audit all"
// run that finished: the run happens in the browser, so the server can't tell.

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/_shared/lib/supabase/client';
import { bulkDone } from '@/app/_shared/lib/notifications/messages';
import { isMissingTable, notify, NOTIFICATIONS_MIGRATION } from '@/app/_shared/lib/notifications/notify';
import { syncRequestReminders } from '@/app/_shared/lib/notifications/requestReminders';
import type { NotificationsResponse } from '@/app/_shared/lib/notifications/notificationTypes';
import { knownTimeZone } from '@/app/_shared/lib/utils/requestDue';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// The bell shows this many, newest first
const LIST_LIMIT = 30;
// More than the bell shows; a longer request isn't from the app
const MAX_IDS = 100;
// More than one search returns
const MAX_COUNT = 10_000;

const COLUMNS = 'id, kind, title, body, business_id, search_id, created_at, read_at';
const SETUP_NEEDED: NotificationsResponse = { notifications: [], unread: 0, setupNeeded: true };

export async function GET(request: NextRequest) {
  const timeZone = knownTimeZone(new URL(request.url).searchParams.get('tz'));
  await syncRequestReminders(new Date(), timeZone);

  const [listed, counted] = await Promise.all([
    supabase.from('notifications').select(COLUMNS).order('created_at', { ascending: false }).limit(LIST_LIMIT),
    supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null),
  ]);
  const error = listed.error ?? counted.error;
  if (isMissingTable(error)) return NextResponse.json(SETUP_NEEDED);
  if (error) {
    console.error('[notifications] Failed to load:', error.message);
    return NextResponse.json({ error: 'Failed to load the notifications' }, { status: 500 });
  }
  const body: NotificationsResponse = { notifications: listed.data ?? [], unread: counted.count ?? 0 };
  return NextResponse.json(body);
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const all = body?.all === true;
  const ids: unknown = body?.ids;
  const valid =
    all ||
    (Array.isArray(ids) && ids.length > 0 && ids.length <= MAX_IDS && ids.every((id) => typeof id === 'string' && UUID.test(id)));
  if (!valid) return NextResponse.json({ error: 'Choose the notifications to mark as read' }, { status: 400 });

  const update = supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
  const { error } = await (all ? update : update.in('id', ids as string[]));
  if (error) {
    console.error(
      '[notifications] Failed to mark as read:',
      isMissingTable(error) ? `run ${NOTIFICATIONS_MIGRATION} in Supabase (${error.message})` : error.message
    );
    return NextResponse.json({ error: "Couldn't mark them as read" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

const isCount = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0 && (value as number) <= MAX_COUNT;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { kind, search_id: searchId, audited, failed } = body ?? {};
  const valid =
    kind === 'bulk_done' && typeof searchId === 'string' && UUID.test(searchId) && isCount(audited) && isCount(failed) && audited + failed > 0;
  if (!valid) return NextResponse.json({ error: 'Not a finished "Audit all" run' }, { status: 400 });

  const { data: search } = await supabase.from('searches').select('niche, location').eq('id', searchId).maybeSingle();
  if (!search) return NextResponse.json({ error: 'Search not found' }, { status: 404 });

  const stored = await notify(bulkDone({ searchId, search, audited, failed }));
  return stored ? NextResponse.json({ ok: true }, { status: 201 }) : NextResponse.json({ error: "Couldn't store the notification" }, { status: 500 });
}
