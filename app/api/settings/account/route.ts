// app/api/settings/account/route.ts

// Deletes the signed-in account and everything in it, once it types its email to
// confirm. Any subscription it has ends first, at once and with no refund, so a
// deleted account is never billed again; if that can't be done, nothing is
// deleted. Then the Supabase user goes, and its searches, leads, audits, reports,
// settings and usage go with it (each table cascades from auth.users). The Stripe
// customer stays, for its invoices. The owner's account runs Auditely and can't
// be deleted here.

import { NextRequest, NextResponse } from 'next/server';
import { deleteUser } from '@/app/_shared/lib/auth/accountRemoval';
import { cancelSubscriptions, findCustomer, stripeClient } from '@/app/_shared/lib/billing/stripe';
import { customerIdOf } from '@/app/_shared/lib/billing/subscription';
import { getSession, unauthorized } from '@/app/_shared/lib/supabase/server';

const NOT_DELETED = "Your account wasn't deleted. Try again in a minute.";

const refuse = (status: number, error: string, field?: string) =>
  NextResponse.json(field ? { error, field } : { error }, { status });

const reason = (err: unknown) => (err instanceof Error ? err.message : String(err));

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { db, account } = session;
  if (account.isOwner) return refuse(403, "This is the owner's account, which runs Auditely. It can't be deleted.");

  const body = (await request.json().catch(() => null)) ?? {};
  const typed = typeof body.confirm === 'string' ? body.confirm.trim().toLowerCase() : '';
  if (typed !== account.email) return refuse(400, 'Type your email to confirm.', 'confirm');

  const stripe = stripeClient();
  if (stripe) {
    try {
      const customer = (await customerIdOf(db, account.id)) ?? (await findCustomer(stripe, account));
      if (customer) await cancelSubscriptions(stripe, customer);
    } catch (err) {
      console.error(`[settings] Couldn't end ${account.id}'s subscription, so the account stays:`, reason(err));
      return refuse(500, NOT_DELETED);
    }
  } else if (account.subscription) {
    console.error(`[settings] ${account.id} has a subscription and billing isn't set up, so the account stays`);
    return refuse(503, "Your subscription can't be cancelled right now, so your account wasn't deleted. Try again later.");
  }

  const failed = await deleteUser(account.id);
  if (failed) {
    console.error(`[settings] Failed to delete ${account.id}:`, failed);
    return refuse(500, NOT_DELETED);
  }

  // The account is gone either way; this clears the session cookies from this browser
  await db.auth.signOut({ scope: 'local' }).catch((err: unknown) => {
    console.error(`[settings] Deleted ${account.id}, but its sign-out failed:`, reason(err));
  });
  return NextResponse.json({ deleted: true });
}
