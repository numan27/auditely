// app/_shared/lib/email/senders.ts

// Which mailbox an account's outreach goes out through: the one it connected
// in Settings, or, for the owner with none, the Vercel one (FROM_EMAIL and
// SMTP_* or Resend). Server-only.

import type { Account } from '@/app/_shared/lib/auth/account';
import { settingsUnavailable } from '@/app/_shared/lib/brand/brand';
import type { UserMailbox } from '@/app/_shared/lib/email/mailer';
import { SecretUnreadable, SecretsKeyMissing } from '@/app/_shared/lib/secrets/secrets';
import { SettingsNotMigrated, readSecret } from '@/app/_shared/lib/secrets/userSecrets';

type SenderProblem = { ok: false; status: number; error: string };

export const SECRETS_KEY_MISSING = "Saving connections isn't set up: add SECRETS_KEY in Vercel.";

/** What answers a saved connection that can't be used: the same for a mailbox and a HubSpot token */
export function connectionProblem(err: unknown, unreadable: string, isOwner: boolean): SenderProblem | null {
  if (err instanceof SecretUnreadable) return { ok: false, status: 400, error: unreadable };
  if (err instanceof SecretsKeyMissing) return { ok: false, status: 503, error: SECRETS_KEY_MISSING };
  if (err instanceof SettingsNotMigrated) return { ok: false, status: 503, error: settingsUnavailable(isOwner) };
  return null;
}

export async function mailboxFor(account: Account): Promise<{ ok: true; mailbox: UserMailbox['settings'] | 'env' } | SenderProblem> {
  try {
    const saved = await readSecret<UserMailbox['settings']>(account.id, 'smtp');
    if (saved) return { ok: true, mailbox: saved };
    if (account.isOwner) return { ok: true, mailbox: 'env' };
    return { ok: false, status: 400, error: 'Connect your mailbox in Settings to send from Auditely.' };
  } catch (err) {
    // Before the migration nothing can have been saved: the owner's Vercel mailbox still works
    if (err instanceof SettingsNotMigrated && account.isOwner) return { ok: true, mailbox: 'env' };
    const problem = connectionProblem(err, "Your saved mailbox can't be read any more. Connect it again in Settings.", false);
    if (problem) return problem;
    throw err;
  }
}
