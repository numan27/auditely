// app/api/settings/hubspot/route.ts

// Connects the signed-in account's own HubSpot, so "Send to HubSpot" hands its
// leads to its own CRM: the private app token is checked with HubSpot first,
// then saved encrypted (secrets/userSecrets.ts). Pro and Agency only. The token
// never appears in an answer or a log line.

import { NextRequest, NextResponse } from 'next/server';
import { checkHubSpotToken } from '@/app/_shared/lib/crm/hubspot';
import { SECRETS_KEY_MISSING, connectionProblem } from '@/app/_shared/lib/email/senders';
import { secretsKey } from '@/app/_shared/lib/secrets/secrets';
import { deleteSecret, saveSecret } from '@/app/_shared/lib/secrets/userSecrets';
import { getSession, unauthorized } from '@/app/_shared/lib/supabase/server';
import { planFor, planHas } from '@/app/_shared/lib/usage/plans';
import { connectAllowed } from '@/app/_shared/lib/usage/rateLimit';
import { featureMessage } from '@/app/_shared/lib/usage/usageCopy';

const TOKEN_MAX = 200;
const UNREADABLE = "Your saved HubSpot token can't be read any more. Connect it again in Settings.";

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { account } = session;
  if (!planHas(planFor(account).id, 'hubspot')) return NextResponse.json({ error: featureMessage('hubspot') }, { status: 403 });
  // Each try asks HubSpot on the account's behalf
  if (!connectAllowed(account.id)) {
    return NextResponse.json({ error: "You've tried 10 times this hour. Try again later." }, { status: 429 });
  }

  const body: unknown = await request.json().catch(() => null);
  const raw = (body as { token?: unknown } | null)?.token;
  const token = typeof raw === 'string' ? raw.trim() : '';
  if (!token || token.length > TOKEN_MAX) return NextResponse.json({ error: 'Paste your HubSpot access token.' }, { status: 400 });
  // Checked before asking HubSpot: a token that can't be saved isn't worth the call
  if (!secretsKey()) return NextResponse.json({ error: SECRETS_KEY_MISSING }, { status: 503 });

  const checked = await checkHubSpotToken(token);
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });

  try {
    await saveSecret(account.id, 'hubspot', { token }, null);
  } catch (err) {
    const problem = connectionProblem(err, UNREADABLE, account.isOwner);
    if (problem) return NextResponse.json({ error: problem.error }, { status: problem.status });
    console.error('[settings] Failed to save the HubSpot token:', err instanceof Error ? err.message : 'unknown error');
    return NextResponse.json({ error: "Your HubSpot token wasn't saved. Try again." }, { status: 500 });
  }
  return NextResponse.json({ hubspot: true });
}

// Any plan: an account that moved back to Free can still remove what it saved
export async function DELETE() {
  const session = await getSession();
  if (!session) return unauthorized();
  const { account } = session;
  try {
    await deleteSecret(account.id, 'hubspot');
  } catch (err) {
    const problem = connectionProblem(err, UNREADABLE, account.isOwner);
    if (problem) return NextResponse.json({ error: problem.error }, { status: problem.status });
    console.error('[settings] Failed to remove the HubSpot token:', err instanceof Error ? err.message : 'unknown error');
    return NextResponse.json({ error: "HubSpot wasn't disconnected. Try again." }, { status: 500 });
  }
  return NextResponse.json({ hubspot: false });
}
