// app/_shared/lib/auth/account.ts

// Who a signed-in user is and who may sign in. The owner is named by OWNER_EMAIL;
// ALLOWED_EMAILS (comma-separated) lets testers in while SIGNUPS_OPEN is not
// exactly "true". Emails compare trimmed and lowercased. Client-safe: no server
// imports, so client components can import the Account type.

import type { Subscription } from '@/app/_shared/lib/billing/billingRules';

export interface Account {
  id: string;
  email: string;
  isOwner: boolean;
  /** The live Stripe subscription; getSession fills it, and absent reads as none */
  subscription?: Subscription | null;
  /** When the account was made (its profile row's created_at), which Free allowances count 30 days from; getSession fills it */
  joinedAt?: string | null;
}

const normalize = (email: string) => email.trim().toLowerCase();

/** A comma-separated email list as trimmed, lowercased addresses, blanks dropped */
export function parseEmails(list: string | undefined): string[] {
  return (list ?? '').split(',').map(normalize).filter(Boolean);
}

/** True when the email is OWNER_EMAIL, whatever the case */
export function isOwnerEmail(email: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const owner = normalize(env.OWNER_EMAIL ?? '');
  return owner !== '' && normalize(email) === owner;
}

/** True once SIGNUPS_OPEN is exactly "true": anyone may make an account */
export function signupsOpen(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.SIGNUPS_OPEN === 'true';
}

/** True for the owner and the allowlist, or for anyone once sign-ups are open */
export function canSignIn(email: string, env: NodeJS.ProcessEnv = process.env): boolean {
  if (signupsOpen(env)) return true;
  return isOwnerEmail(email, env) || parseEmails(env.ALLOWED_EMAILS).includes(normalize(email));
}
