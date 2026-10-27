// app/_shared/lib/utils/requestDue.ts

// devartventures.com promises a reply to a free audit request within one
// business day. These say when each request is due, on the viewer's own
// calendar, and whether it was answered. Client-safe.

export type RequestStatus =
  | { state: 'replied'; label: string }
  | { state: 'due'; label: string }
  | { state: 'overdue'; label: string };

const SATURDAY = 6;
const SUNDAY = 0;

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const dayLabel = (date: Date) => date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

/** The day the reply is due: the next weekday after the request came in (a Friday's or a weekend's is due Monday) */
export function requestDueDay(requestedAt: string): Date {
  const due = startOfDay(new Date(requestedAt));
  do due.setDate(due.getDate() + 1);
  while (due.getDay() === SATURDAY || due.getDay() === SUNDAY);
  return due;
}

/** "Replied Oct 28", "Reply today", "Reply by Thu, Oct 29" or "Overdue: due Wed, Oct 28" */
export function requestStatus(requestedAt: string, emailedAt: string | null | undefined, now: Date = new Date()): RequestStatus {
  if (emailedAt) {
    return { state: 'replied', label: `Replied ${new Date(emailedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` };
  }
  const due = requestDueDay(requestedAt);
  const today = startOfDay(now);
  if (today > due) return { state: 'overdue', label: `Overdue: due ${dayLabel(due)}` };
  if (today.getTime() === due.getTime()) return { state: 'due', label: 'Reply today' };
  return { state: 'due', label: `Reply by ${dayLabel(due)}` };
}

// The same days on a named time zone's calendar, for the server (which runs on
// UTC) to tell a viewer what's due on theirs. Days are "YYYY-MM-DD" keys.

/** The time zone if it's one this runtime knows, else undefined (the runtime's own) */
export function knownTimeZone(timeZone: string | null | undefined): string | undefined {
  if (!timeZone) return undefined;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return timeZone;
  } catch {
    return undefined;
  }
}

/** The day a moment falls on in a time zone: "2026-10-27" */
export function dayKey(date: Date, timeZone?: string): string {
  // en-CA writes dates as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

/** requestDueDay on a time zone's calendar */
export function requestDueKey(requestedAt: string, timeZone?: string): string {
  const [year, month, day] = dayKey(new Date(requestedAt), timeZone).split('-').map(Number);
  const due = new Date(Date.UTC(year, month - 1, day));
  do due.setUTCDate(due.getUTCDate() + 1);
  while (due.getUTCDay() === SATURDAY || due.getUTCDay() === SUNDAY);
  return due.toISOString().slice(0, 10);
}

/** "Wed, Oct 28" for a day key */
export const dayKeyLabel = (key: string) =>
  new Date(`${key}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

/** Whether an unanswered request's reply is due today or overdue, on a time zone's calendar; null while it's neither */
export function requestDueToday(requestedAt: string, now: Date, timeZone?: string): 'due' | 'overdue' | null {
  const due = requestDueKey(requestedAt, timeZone);
  const today = dayKey(now, timeZone);
  if (today > due) return 'overdue';
  return today === due ? 'due' : null;
}
