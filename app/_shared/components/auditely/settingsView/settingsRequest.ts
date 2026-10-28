// app/_shared/components/auditely/settingsView/settingsRequest.ts

// One save or disconnect from the Settings page, answered with the server's own
// message so the form can show it, under the field it names when it names one.

const UNREACHABLE = "Couldn't reach Auditely. Check your connection and try again.";

export type SettingsAnswer = { ok: true } | { ok: false; error: string; field?: string };

export async function sendSettings(
  url: string,
  method: 'PUT' | 'DELETE',
  body?: unknown,
  /** What to say when the answer has no reason in it */
  fallback = "That didn't save. Try again."
): Promise<SettingsAnswer> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    const answer = (await res.json().catch(() => null)) as { error?: unknown; field?: unknown } | null;
    return {
      ok: false,
      error: typeof answer?.error === 'string' ? answer.error : fallback,
      field: typeof answer?.field === 'string' ? answer.field : undefined,
    };
  } catch {
    return { ok: false, error: UNREACHABLE };
  }
}
