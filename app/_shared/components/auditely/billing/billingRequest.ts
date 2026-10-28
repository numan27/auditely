// app/_shared/components/auditely/billing/billingRequest.ts

// Asks Auditely for a Stripe page (Checkout or the billing portal) and hands back
// its address, or the server's own message to show. Only an https:// address is
// followed, so a bad answer can't send the browser anywhere else.

const UNREACHABLE = "Couldn't reach Auditely. Check your connection and try again.";
const FAILED = "Couldn't open Stripe. Try again.";

export type BillingAnswer = { ok: true; url: string } | { ok: false; error: string };

export async function openBilling(url: string, body: unknown): Promise<BillingAnswer> {
  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    return { ok: false, error: UNREACHABLE };
  }
  const answer = (await res.json().catch(() => null)) as { url?: unknown; error?: unknown } | null;
  if (res.ok && typeof answer?.url === 'string' && answer.url.startsWith('https://')) return { ok: true, url: answer.url };
  return { ok: false, error: !res.ok && typeof answer?.error === 'string' ? answer.error : FAILED };
}
