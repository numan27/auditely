// app/(app)/settings/page.tsx

// The account's profile and branding, its own mailbox and HubSpot, and its plan
// with Manage billing. The profile is read as the user; only its fields go to the
// browser, and what is connected goes as labels, never a password or token. The
// subscription goes as its plan and dates, never a Stripe id. The owner also sees
// today's free audits and the last 7 and 30 days' numbers; nobody else's page reads them.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AppHeader } from '@/app/_shared/components/auditely/appHeader/appHeader';
import { billingReady } from '@/app/_shared/lib/billing/stripe';
import { SettingsView } from '@/app/_shared/components/auditely/settingsView/settingsView';
import type { FreeAuditsSummary } from '@/app/_shared/components/auditely/settingsView/freeAuditsSection';
import type { ProfileFields } from '@/app/_shared/lib/brand/profileInput';
import { ROUTES } from '@/app/_shared/lib/config/routes';
import { dayStart, freeAuditSetup } from '@/app/_shared/lib/freeAudit/freeAuditRules';
import { freeAuditsSince } from '@/app/_shared/lib/freeAudit/freeAuditStore';
import { growthCounts, type GrowthCounts } from '@/app/_shared/lib/growth/funnel';
import { growthRows } from '@/app/_shared/lib/growth/growthStore';
import { connectionsFor } from '@/app/_shared/lib/settings/connections';
import { getSession } from '@/app/_shared/lib/supabase/server';

export const metadata: Metadata = { title: 'Settings' };

const FIELDS: (keyof ProfileFields)[] = [
  'display_name',
  'company',
  'website',
  'logo_data_url',
  'contact_email',
  'contact_phone',
  'booking_url',
];

/** Whether free audits run, and today's, since midnight UTC */
async function freeAuditsToday(): Promise<FreeAuditsSummary> {
  const setup = freeAuditSetup();
  return {
    state: setup.state,
    cap: setup.state === 'on' ? setup.config.dailyCap : null,
    missing: setup.state === 'unavailable' ? setup.missing : [],
    today: await freeAuditsSince(dayStart(new Date())),
  };
}

/** The last 7 and 30 days' numbers; null when they couldn't be read */
async function growthToDate(): Promise<GrowthCounts[] | null> {
  const now = new Date();
  const rows = await growthRows(now);
  return rows && growthCounts(rows, now);
}

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect(ROUTES.LOGIN);
  const { db, account } = session;

  const [{ data, error }, connections, freeAudits, growth] = await Promise.all([
    // '*': before the settings migration the new columns aren't there, and read as blank
    db.from('profiles').select('*').eq('id', account.id).maybeSingle(),
    connectionsFor(account),
    account.isOwner ? freeAuditsToday() : null,
    account.isOwner ? growthToDate().then((counts) => ({ counts })) : null,
  ]);
  if (error) console.error('[settings] Failed to read the profile:', error.message);
  const row = (data ?? {}) as Partial<Record<keyof ProfileFields, string | null>>;
  const profile = error
    ? null
    : (Object.fromEntries(FIELDS.map((field) => [field, row[field] ?? null])) as unknown as ProfileFields);

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-10 sm:px-6 sm:pt-16">
        <SettingsView
          profile={profile}
          connections={connections}
          plan={connections.plan}
          email={account.email}
          subscription={account.subscription ?? null}
          billingReady={billingReady()}
          freeAudits={freeAudits}
          growth={growth}
        />
      </main>
    </div>
  );
}
