// app/_shared/lib/usage/rateLimit.ts

// Caps for calls that are cheap one at a time but have no monthly allowance,
// such as the city suggestions under the search form. They're kept in this
// server instance's memory: a first line against a script, not a ledger.

/** City suggestions one account may ask Google for: enough for typing, not for a loop */
export const AUTOCOMPLETE_PER_MINUTE = 30;
export const AUTOCOMPLETE_PER_DAY = 500;

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

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
