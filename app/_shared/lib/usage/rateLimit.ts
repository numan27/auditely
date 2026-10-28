// app/_shared/lib/usage/rateLimit.ts

// Caps for calls that are cheap one at a time but have no monthly allowance,
// such as the city suggestions under the search form. They're kept in this
// server instance's memory: a first line against a script, not a ledger.

/** City suggestions one account may ask Google for: enough for typing, not for a loop */
export const AUTOCOMPLETE_PER_MINUTE = 30;
export const AUTOCOMPLETE_PER_DAY = 500;
/** "Write again" on a summary: a model call each time, while the audit was counted once */
export const REWRITES_PER_HOUR = 10;
/** Connecting a mailbox or HubSpot: each try logs in somewhere else on the account's behalf */
export const CONNECTS_PER_HOUR = 10;
/** Outreach from an account's own mailbox: enough for a working session, not for a blast */
export const SENDS_PER_HOUR = 50;
/** Feedback to the owner: an email each, so a stuck key can't fill the inbox */
export const FEEDBACK_PER_HOUR = 10;
/** Contact form messages from one network: an email each, and anyone can send them */
export const CONTACT_PER_HOUR = 5;

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

interface WindowLimitOptions {
  limit: number;
  windowMs: number;
  /** The most keys held at once; the oldest is forgotten first */
  maxKeys?: number;
}

/** A fixed-window counter per key: true while the key's window has room, counting the call */
export function windowLimit({ limit, windowMs, maxKeys = 10_000 }: WindowLimitOptions) {
  const windows = new Map<string, { start: number; count: number }>();
  return (key: string, now: number = Date.now()): boolean => {
    const window = windows.get(key);
    if (window && now - window.start < windowMs) {
      if (window.count >= limit) return false;
      window.count += 1;
      return true;
    }
    // A Map iterates in insertion order: re-inserting keeps the oldest window first
    windows.delete(key);
    if (windows.size >= maxKeys) windows.delete(windows.keys().next().value as string);
    windows.set(key, { start: now, count: 1 });
    return true;
  };
}

const autocompletePerMinute = windowLimit({ limit: AUTOCOMPLETE_PER_MINUTE, windowMs: MINUTE_MS });
const autocompletePerDay = windowLimit({ limit: AUTOCOMPLETE_PER_DAY, windowMs: DAY_MS });

/** Whether this account may ask Google for city suggestions now */
export const autocompleteAllowed = (accountId: string, now: number = Date.now()): boolean =>
  autocompletePerMinute(accountId, now) && autocompletePerDay(accountId, now);

const rewritesPerHour = windowLimit({ limit: REWRITES_PER_HOUR, windowMs: HOUR_MS });

/** Whether this account may have a summary and email written again now */
export const rewriteAllowed = (accountId: string, now: number = Date.now()): boolean => rewritesPerHour(accountId, now);

const connectsPerHour = windowLimit({ limit: CONNECTS_PER_HOUR, windowMs: HOUR_MS });
const sendsPerHour = windowLimit({ limit: SENDS_PER_HOUR, windowMs: HOUR_MS });

/** Whether this account may try connecting a mailbox or HubSpot now */
export const connectAllowed = (accountId: string, now: number = Date.now()): boolean => connectsPerHour(accountId, now);

/** Whether this account may send another outreach email now */
export const sendAllowed = (accountId: string, now: number = Date.now()): boolean => sendsPerHour(accountId, now);

const feedbackPerHour = windowLimit({ limit: FEEDBACK_PER_HOUR, windowMs: HOUR_MS });

/** Whether this account may send the owner another piece of feedback now */
export const feedbackAllowed = (accountId: string, now: number = Date.now()): boolean => feedbackPerHour(accountId, now);

const contactPerHour = windowLimit({ limit: CONTACT_PER_HOUR, windowMs: HOUR_MS });

/** Whether this visitor's network may send the team another message now */
export const contactAllowed = (ip: string, now: number = Date.now()): boolean => contactPerHour(ip, now);
