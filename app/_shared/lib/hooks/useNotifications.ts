// app/_shared/lib/hooks/useNotifications.ts

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { API_ROUTES } from '@/app/_shared/lib/config/routes';
import {
  isRequestNotification,
  REQUESTS_CHANGED_EVENT,
  titleWithCount,
  type AppNotification,
  type NotificationsResponse,
} from '@/app/_shared/lib/notifications/notificationTypes';

// How often the bell asks for news while the tab is in view; it also asks when the tab comes back
const POLL_MS = 60_000;
const JSON_HEADERS = { 'Content-Type': 'application/json' };

const viewerTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return '';
  }
};

/**
 * The header bell's list: loaded on arrival, every minute while the tab is in
 * view and whenever it comes back into view. Puts the unread count in the tab
 * title ("(2) Auditely"), and tells the Requests tab when a request arrives or
 * finishes its audit, so its list reloads.
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // Ids seen so far (null before the first load: what's already there isn't news)
  const seen = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_ROUTES.NOTIFICATIONS}?tz=${encodeURIComponent(viewerTimeZone())}`);
      if (!res.ok) throw new Error(String(res.status));
      const data: NotificationsResponse = await res.json();
      const list = data.notifications ?? [];
      const arrived = seen.current ? list.filter((n) => !seen.current?.has(n.id)) : [];
      seen.current = new Set(list.map((n) => n.id));
      setNotifications(list);
      setUnread(data.unread ?? 0);
      setSetupNeeded(!!data.setupNeeded);
      setError(false);
      if (arrived.some(isRequestNotification)) window.dispatchEvent(new Event(REQUESTS_CHANGED_EVENT));
    } catch {
      setError(true);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [load]);

  // "(2) Auditely": kept when a page sets its own title
  useEffect(() => {
    const apply = () => {
      const next = titleWithCount(document.title, unread);
      if (next !== document.title) document.title = next;
    };
    apply();
    const title = document.querySelector('title');
    const observer = new MutationObserver(apply);
    if (title) observer.observe(title, { childList: true, characterData: true, subtree: true });
    return () => {
      observer.disconnect();
      document.title = titleWithCount(document.title, 0);
    };
  }, [unread]);

  const patch = useCallback(
    async (body: { ids: string[] } | { all: true }) => {
      try {
        const res = await fetch(API_ROUTES.NOTIFICATIONS, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(body) });
        if (!res.ok) throw new Error(String(res.status));
      } catch {
        // The next load puts back what the server still has as unread
        void load();
      }
    },
    [load]
  );

  /** Marks one read on screen at once, then on the server */
  const markRead = useCallback(
    (id: string) => {
      const target = notifications.find((n) => n.id === id);
      if (!target || target.read_at) return;
      const now = new Date().toISOString();
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: now } : n)));
      setUnread((count) => Math.max(0, count - 1));
      void patch({ ids: [id] });
    },
    [notifications, patch]
  );

  const markAllRead = useCallback(() => {
    if (unread === 0) return;
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    setUnread(0);
    void patch({ all: true });
  }, [unread, patch]);

  return { notifications, unread, setupNeeded, error, loaded, reload: load, markRead, markAllRead };
}
