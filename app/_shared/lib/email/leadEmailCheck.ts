// app/_shared/lib/email/leadEmailCheck.ts

// The check on a lead's address before it is emailed: the result saved on the
// lead while it is fresh, otherwise a new one from Verifalia, saved for next
// time. Used by the "Send email" dialog (api/verify-email) and by the send
// itself (api/send-email), so both go by the same answer.

import type { Db } from '@/app/_shared/lib/supabase/client';
import { freshCheck, type EmailCheckResult } from '@/app/_shared/lib/email/emailCheck';
import { verifaliaConfigured, verifyAddress } from '@/app/_shared/lib/email/verifalia';

const MIGRATION = 'docs/migrations/2026-10-05-email-check.sql';

export async function checkLeadEmail(db: Db, lead: { id: string; email: string; email_check?: unknown }): Promise<EmailCheckResult> {
  // A fresh result stands even with Verifalia switched off: an undeliverable address stays blocked
  const saved = freshCheck(lead.email_check, lead.email);
  if (saved) return { state: 'checked', check: saved };
  if (!verifaliaConfigured()) return { state: 'off' };

  const outcome = await verifyAddress(lead.email);
  if (!outcome.ok) return { state: 'unchecked', reason: outcome.reason };

  const { error } = await db.from('businesses').update({ email_check: outcome.check }).eq('id', lead.id);
  if (!error) return { state: 'checked', check: outcome.check };

  console.error('[email-check] could not save the result:', error.message);
  // Only a missing column is fixed by the migration
  const warning = /email_check/.test(error.message)
    ? `Checked, but the result couldn't be saved — run ${MIGRATION} in Supabase.`
    : "Checked, but the result couldn't be saved, so it will be checked again next time.";
  return { state: 'checked', check: outcome.check, warning };
}
