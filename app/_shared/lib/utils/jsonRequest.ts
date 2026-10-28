// app/_shared/lib/utils/jsonRequest.ts

// A JSON request from the browser to one of Auditely's routes. The answer is read
// safely: one that isn't JSON (a platform error page after a timeout) has no
// data, and a request that never got an answer (offline, cancelled) carries the
// connection message as its error, so the caller always has something to show.

import type { Post } from '@/app/_shared/lib/utils/bulkAudit';

export const UNREACHABLE = "Couldn't reach Auditely. Check your connection and try again.";

type Answer = Awaited<ReturnType<Post>>;

async function request(path: string, init?: RequestInit): Promise<Answer> {
  try {
    const res = await fetch(path, init);
    return { ok: res.ok, data: await res.json().catch(() => null) };
  } catch {
    return { ok: false, data: { error: UNREACHABLE } };
  }
}

export const postJson = (path: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<Answer> =>
  request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });

export const getJson = (path: string): Promise<Answer> => request(path);
