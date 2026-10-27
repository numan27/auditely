import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NotificationPanel } from '@/app/_shared/components/auditely/notificationBell/notificationBell';
import type { AppNotification } from '@/app/_shared/lib/notifications/notificationTypes';

const now = new Date('2026-10-28T15:00:00Z');
const note = (over: Partial<AppNotification> = {}): AppNotification => ({
  id: 'n1',
  kind: 'request_new',
  title: 'New audit request from Sarah Jones',
  body: 'smiledental.com is being audited now. Reply within one business day.',
  business_id: 'b1',
  search_id: null,
  created_at: '2026-10-28T14:55:00Z',
  read_at: null,
  ...over,
});

const panel = (over: Partial<Parameters<typeof NotificationPanel>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(NotificationPanel, {
      notifications: [],
      unread: 0,
      setupNeeded: false,
      error: false,
      loaded: true,
      onOpen: () => {},
      onMarkAllRead: () => {},
      now,
      ...over,
    })
  );

describe('NotificationPanel', () => {
  it('lists notifications with their age, unread ones marked, and offers to mark all read', () => {
    const html = panel({ notifications: [note(), note({ id: 'n2', title: 'smiledental.com is audited', read_at: now.toISOString() })], unread: 1 });
    expect(html).toContain('New audit request from Sarah Jones');
    expect(html).toContain('5m ago');
    expect(html.match(/aria-label="Unread"/g)).toHaveLength(1);
    expect(html).toContain('Mark all as read');
  });

  it('has no "mark all" with nothing unread', () => {
    expect(panel({ notifications: [note({ read_at: now.toISOString() })] })).not.toContain('Mark all as read');
  });

  it('says what will show up when empty', () => {
    expect(panel()).toContain('New audit requests, replies due and finished audits show up here.');
  });

  it('names the migration while the table is missing', () => {
    expect(panel({ setupNeeded: true })).toContain('docs/migrations/2026-10-27-notifications.sql');
  });
});
