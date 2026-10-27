// app/api/settings/mailbox/route.ts

// Connects the signed-in account's own mailbox, so its outreach goes out from
// it and lands in its Sent folder: the login is checked against the mail server
// first, then saved encrypted (secrets/userSecrets.ts). Pro and Agency only.
// The password never appears in an answer or a log line.

import { NextRequest, NextResponse } from 'next/server';
import { verifyMailbox } from '@/app/_shared/lib/email/mailbox';
import { parseMailbox } from '@/app/_shared/lib/email/mailboxPresets';
import { SECRETS_KEY_MISSING, connectionProblem } from '@/app/_shared/lib/email/senders';
import { secretsKey } from '@/app/_shared/lib/secrets/secrets';
import { deleteSecret, saveSecret } from '@/app/_shared/lib/secrets/userSecrets';
import { getSession, unauthorized } from '@/app/_shared/lib/supabase/server';
import { planFor, planHas } from '@/app/_shared/lib/usage/plans';
import { connectAllowed } from '@/app/_shared/lib/usage/rateLimit';
import { featureMessage } from '@/app/_shared/lib/usage/usageCopy';

const UNREADABLE = "Your saved mailbox can't be read any more. Connect it again in Settings.";

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { account } = session;
  if (!planHas(planFor(account).id, 'mailbox')) return NextResponse.json({ error: featureMessage('mailbox') }, { status: 403 });
  // Each try logs in to a mail server on the account's behalf
  if (!connectAllowed(account.id)) {
    return NextResponse.json({ error: "You've tried 10 times this hour. Try again later." }, { status: 429 });
  }

  const input = parseMailbox(await request.json().catch(() => null));
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });
  const { mailbox } = input;
  // Checked before logging in: a mailbox that can't be saved isn't worth a login
  if (!secretsKey()) return NextResponse.json({ error: SECRETS_KEY_MISSING }, { status: 503 });

  const checked = await verifyMailbox(mailbox);
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });

  try {
    await saveSecret(account.id, 'smtp', mailbox, mailbox.fromEmail);
  } catch (err) {
    const problem = connectionProblem(err, UNREADABLE, account.isOwner);
    if (problem) return NextResponse.json({ error: problem.error }, { status: problem.status });
    console.error('[settings] Failed to save the mailbox:', err instanceof Error ? err.message : 'unknown error');
    return NextResponse.json({ error: "Your mailbox wasn't saved. Try again." }, { status: 500 });
  }
  return NextResponse.json({ mailbox: mailbox.fromEmail });
}

// Any plan: an account that moved back to Free can still remove what it saved
export async function DELETE() {
  const session = await getSession();
  if (!session) return unauthorized();
  const { account } = session;
  try {
    await deleteSecret(account.id, 'smtp');
  } catch (err) {
    const problem = connectionProblem(err, UNREADABLE, account.isOwner);
    if (problem) return NextResponse.json({ error: problem.error }, { status: problem.status });
    console.error('[settings] Failed to remove the mailbox:', err instanceof Error ? err.message : 'unknown error');
    return NextResponse.json({ error: "Your mailbox wasn't disconnected. Try again." }, { status: 500 });
  }
  return NextResponse.json({ mailbox: null });
}
