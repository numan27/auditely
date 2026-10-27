import { describe, it, expect } from 'vitest';
import { notificationAge, notificationHref, titleWithCount } from '@/app/_shared/lib/notifications/notificationTypes';

const ID = '3a7e9c10-2b4d-4e6f-8a1b-9c0d2e4f6a8b';

describe('notificationHref', () => {
  it("opens a request's card, or the search an \"Audit all\" ran on", () => {
    expect(notificationHref({ kind: 'request_new', business_id: ID, search_id: null })).toBe(`/requests/${ID}`);
    expect(notificationHref({ kind: 'request_overdue', business_id: null, search_id: null })).toBe('/requests');
    expect(notificationHref({ kind: 'bulk_done', business_id: null, search_id: ID })).toBe(`/search/${ID}`);
  });
});

describe('titleWithCount', () => {
  it('puts the unread count before the title, once', () => {
    expect(titleWithCount('Auditely', 2)).toBe('(2) Auditely');
    expect(titleWithCount('(2) Auditely', 5)).toBe('(5) Auditely');
    expect(titleWithCount('(5) Auditely', 0)).toBe('Auditely');
    expect(titleWithCount('Auditely', 120)).toBe('(99+) Auditely');
    expect(titleWithCount('(99+) Auditely', 1)).toBe('(1) Auditely');
  });
});

describe('notificationAge', () => {
  const now = new Date('2026-10-28T15:00:00Z');
  const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();
  it('says how long ago, then the day', () => {
    expect(notificationAge(ago(0), now)).toBe('Just now');
    expect(notificationAge(ago(5), now)).toBe('5m ago');
    expect(notificationAge(ago(180), now)).toBe('3h ago');
    expect(notificationAge(ago(30 * 60), now)).toBe('Yesterday');
    expect(notificationAge('2026-10-20T12:00:00Z', now)).toBe('Oct 20');
  });
});
