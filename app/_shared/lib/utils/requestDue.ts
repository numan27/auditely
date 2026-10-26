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
