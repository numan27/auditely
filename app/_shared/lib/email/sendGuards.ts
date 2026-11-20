// app/_shared/lib/email/sendGuards.ts

// Rules for cold outreach that keep a new sending domain out of spam folders:
// a daily cap, and never a second cold email to an address already emailed for
// another lead (the same practice listed twice, or one address on many
// listings). A lead's own follow-up is allowed. Applies to every account, the
// owner's included. Requested audits don't pass through here. Server-only.

import type { Db } from '@/app/_shared/lib/supabase/client';

/** Cold emails one account sends in a day: a person's pace, not a blast */
export const COLD_SENDS_PER_DAY = 25;

interface ColdSend {
  businessId: string;
  email: string;
}

const startOfDay = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();

const dateOf = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** Why this cold email must not go, or null when it may */
export async function coldSendProblem(db: Db, { businessId, email }: ColdSend, now: Date = new Date()): Promise<string | null> {
  const { data: same } = await db.from('businesses').select('id, name, emailed_at').eq('email', email);
  const earlier = ((same ?? []) as { id: string; name: string | null; emailed_at: string | null }[]).find(
    (row) => row.id !== businessId && row.emailed_at
  );
  if (earlier) {
    return `Not sent: ${email} was already emailed on ${dateOf(earlier.emailed_at!)} for ${earlier.name ?? 'another lead'}.`;
  }

  const { count } = await db.from('businesses').select('id', { count: 'exact', head: true }).gte('emailed_at', startOfDay(now));
  if ((count ?? 0) >= COLD_SENDS_PER_DAY) {
    return `You've sent ${COLD_SENDS_PER_DAY} cold emails today. Sending more from one address in a day lands them in spam, so try again tomorrow.`;
  }
  return null;
}
