// app/_shared/lib/notifications/notificationTypes.ts

// The header bell's notifications: what each one is about and where it opens.
// Client-safe.

import { requestPath, searchPath } from '@/app/_shared/lib/utils/workspacePath';
import { ROUTES } from '@/app/_shared/lib/config/routes';

export type NotificationKind =
  | 'request_new'
  | 'request_due'
  | 'request_overdue'
  | 'request_audited'
  | 'request_audit_failed'
  | 'bulk_done';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  business_id: string | null;
  search_id: string | null;
  created_at: string;
  read_at: string | null;
}

/** GET /api/notifications */
export interface NotificationsResponse {
  notifications: AppNotification[];
  unread: number;
  /** The notifications table doesn't exist yet: its migration hasn't been run */
  setupNeeded?: boolean;
}

/** The migration that creates the notifications table */
export const NOTIFICATIONS_MIGRATION = 'docs/migrations/2026-10-27-notifications.sql';

/** Sent on window when new request notifications arrive, so the Requests tab can reload its list */
export const REQUESTS_CHANGED_EVENT = 'auditely:requests-changed';

const REQUEST_KINDS: ReadonlySet<NotificationKind> = new Set([
  'request_new',
  'request_due',
  'request_overdue',
  'request_audited',
  'request_audit_failed',
]);

export const isRequestNotification = (n: Pick<AppNotification, 'kind'>) => REQUEST_KINDS.has(n.kind);

/** The view a notification opens: the request's card, or the search "Audit all" ran on */
export function notificationHref(n: Pick<AppNotification, 'kind' | 'business_id' | 'search_id'>): string {
  if (isRequestNotification(n)) return n.business_id ? requestPath(n.business_id) : ROUTES.REQUESTS;
  return n.search_id ? searchPath(n.search_id) : ROUTES.HOME;
}

/** "(3) Auditely" while 3 are unread, "Auditely" when none are */
export function titleWithCount(title: string, unread: number): string {
  const bare = title.replace(/^\(\d+\+?\) /, '');
  if (unread <= 0) return bare;
  return `(${unread > 99 ? '99+' : unread}) ${bare}`;
}

/** "Just now", "5m ago", "3h ago", "Yesterday", then the day: "Oct 27" */
export function notificationAge(iso: string, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}h ago`;
  if (minutes < 48 * 60) return 'Yesterday';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
