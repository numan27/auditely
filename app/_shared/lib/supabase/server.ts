// app/_shared/lib/supabase/server.ts

// The database as the signed-in user, for route handlers and Server Components.
// userDb() reads the Supabase session from the request's cookies, so Row Level
// Security sees the user; getSession() adds who they are. Server-only. Work no
// user owns goes through serviceDb in client.ts instead.

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { serviceDb, type Db } from '@/app/_shared/lib/supabase/client';
import { SESSION_COOKIE_OPTIONS } from '@/app/_shared/lib/supabase/cookieOptions';
import { canSignIn, isOwnerEmail, type Account } from '@/app/_shared/lib/auth/account';
import { subscriptionOf } from '@/app/_shared/lib/billing/subscription';

const ACCOUNTS_MIGRATION = 'docs/migrations/2026-10-28-accounts.sql';
let loggedNoOwner = false;

export interface Session {
  db: Db;
  account: Account;
}

/** A database client that acts as the signed-in user (or as nobody, without a session) */
export async function userDb(): Promise<Db> {
  const store = await cookies();
  return createServerClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // A Server Component can't set cookies; the proxy refreshes the session instead
        }
      },
    },
  });
}

/** The signed-in account and its client; null without a session or for an email that may not sign in */
export async function getSession(): Promise<Session | null> {
  const db = await userDb();
  const { data } = await db.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub || typeof claims.email !== 'string' || !claims.email) return null;
  const email = claims.email.trim().toLowerCase();
  if (!canSignIn(email)) return null;
  const subscription = await subscriptionOf(db, claims.sub);
  return { db, account: { id: claims.sub, email, isOwner: isOwnerEmail(email), subscription } };
}

/** The owner's user id, found by OWNER_EMAIL; null when the owner hasn't signed in yet */
export async function ownerUserId(): Promise<string | null> {
  const email = (process.env.OWNER_EMAIL ?? '').trim().toLowerCase();
  if (!email) return null;
  const { data, error } = await serviceDb.from('profiles').select('id').eq('email', email).maybeSingle();
  if (error) {
    console.error('[auth] Failed to look up the owner account:', `run ${ACCOUNTS_MIGRATION} in Supabase (${error.message})`);
    return null;
  }
  if (!data && !loggedNoOwner) {
    loggedNoOwner = true;
    console.error('[auth] OWNER_EMAIL has no Auditely account yet');
  }
  return (data?.id as string | undefined) ?? null;
}

export const unauthorized = () => NextResponse.json({ error: 'Sign in to continue' }, { status: 401 });

export const ownerOnly = () =>
  NextResponse.json({ error: "This isn't available on your account yet." }, { status: 403 });
