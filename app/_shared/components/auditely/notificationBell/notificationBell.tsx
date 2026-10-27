// app/_shared/components/auditely/notificationBell/notificationBell.tsx

'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { BellIcon, CheckIcon, ClockIcon, GaugeIcon, MailIcon, XIcon } from '@/app/_shared/components/ui/icons/icons';
import { useNotifications } from '@/app/_shared/lib/hooks/useNotifications';
import { useWorkspaceNavigate } from '@/app/_shared/lib/hooks/useWorkspaceNavigate';
import {
  NOTIFICATIONS_MIGRATION,
  notificationAge,
  notificationHref,
  type AppNotification,
  type NotificationKind,
} from '@/app/_shared/lib/notifications/notificationTypes';

// What each kind is, at a glance: the ones that need doing are amber or red
const KIND_ICON: Record<NotificationKind, { icon: ReactNode; tone: string }> = {
  request_new: { icon: <MailIcon size={14} />, tone: 'bg-[var(--color-primary-600)]/10 text-[var(--color-primary-600)]' },
  request_due: { icon: <ClockIcon size={14} />, tone: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  request_overdue: { icon: <ClockIcon size={14} />, tone: 'bg-red-500/10 text-red-700 dark:text-red-400' },
  request_audited: { icon: <CheckIcon size={14} strokeWidth={2.5} />, tone: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  request_audit_failed: { icon: <XIcon size={14} />, tone: 'bg-red-500/10 text-red-700 dark:text-red-400' },
  bulk_done: { icon: <GaugeIcon size={14} />, tone: 'bg-[var(--color-primary-600)]/10 text-[var(--color-primary-600)]' },
};

interface NotificationPanelProps {
  notifications: AppNotification[];
  unread: number;
  setupNeeded: boolean;
  error: boolean;
  loaded: boolean;
  onOpen: (notification: AppNotification) => void;
  onMarkAllRead: () => void;
  now?: Date;
}

/** The bell's dropdown: newest first, unread ones marked */
export function NotificationPanel({ notifications, unread, setupNeeded, error, loaded, onOpen, onMarkAllRead, now }: NotificationPanelProps) {
  let content: ReactNode;
  if (setupNeeded) {
    content = (
      <p className="px-4 py-6 text-sm leading-relaxed text-[var(--color-text-secondary)]">
        Notifications aren&apos;t set up yet. Run <code className="text-[var(--color-text-primary)]">{NOTIFICATIONS_MIGRATION}</code> in
        the Supabase SQL editor to turn them on.
      </p>
    );
  } else if (error && notifications.length === 0) {
    content = <p className="px-4 py-6 text-sm text-[var(--color-text-secondary)]">Couldn&apos;t load notifications. Trying again in a minute.</p>;
  } else if (!loaded) {
    content = <p className="px-4 py-6 text-sm text-[var(--color-text-tertiary)]">Loading…</p>;
  } else if (notifications.length === 0) {
    content = (
      <p className="px-4 py-6 text-sm leading-relaxed text-[var(--color-text-secondary)]">
        Nothing yet. New audit requests, replies due and finished audits show up here.
      </p>
    );
  } else {
    content = (
      <ul className="max-h-[min(28rem,70vh)] divide-y divide-[var(--color-border)] overflow-y-auto">
        {notifications.map((n) => {
          const kind = KIND_ICON[n.kind] ?? KIND_ICON.request_new;
          return (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => onOpen(n)}
                className="flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--color-bg-secondary)] focus-visible:bg-[var(--color-bg-secondary)] focus-visible:outline-none"
              >
                <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${kind.tone}`}>{kind.icon}</span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-sm leading-snug ${
                      n.read_at ? 'text-[var(--color-text-secondary)]' : 'font-semibold text-[var(--color-text-primary)]'
                    }`}
                  >
                    {n.title}
                  </span>
                  {n.body && <span className="mt-0.5 block text-sm leading-snug text-[var(--color-text-tertiary)]">{n.body}</span>}
                  <span className="mt-1 block text-xs text-[var(--color-text-tertiary)]">{notificationAge(n.created_at, now)}</span>
                </span>
                {!n.read_at && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--color-primary-600)]" aria-label="Unread" />}
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Notifications</h2>
        {unread > 0 && (
          <button
            type="button"
            onClick={onMarkAllRead}
            className="cursor-pointer text-sm font-medium text-[var(--color-primary-600)] hover:underline"
          >
            Mark all as read
          </button>
        )}
      </div>
      {content}
    </>
  );
}

/** The header bell: unread count, and a dropdown that opens each notification's request or search */
export function NotificationBell() {
  const { notifications, unread, setupNeeded, error, loaded, reload, markRead, markAllRead } = useNotifications();
  const navigate = useWorkspaceNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = () => {
    if (!open) void reload();
    setOpen(!open);
  };

  const openNotification = (notification: AppNotification) => {
    markRead(notification.id);
    setOpen(false);
    navigate(notificationHref(notification));
  };

  const label = unread > 0 ? `Notifications, ${unread} unread` : 'Notifications';

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className="relative grid h-9 w-9 cursor-pointer place-items-center rounded-md text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
      >
        <BellIcon size={18} />
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--color-primary-600)] px-1 text-[10px] font-semibold leading-none text-white tabular-nums"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Notifications"
          className="fixed inset-x-4 top-16 z-50 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96"
        >
          <NotificationPanel
            notifications={notifications}
            unread={unread}
            setupNeeded={setupNeeded}
            error={error}
            loaded={loaded}
            onOpen={openNotification}
            onMarkAllRead={markAllRead}
          />
        </div>
      )}
    </div>
  );
}
