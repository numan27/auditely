// app/(app)/settings/page.tsx

// The account's profile and branding, its own mailbox and HubSpot, and its plan.
// The profile is read as the user; only its fields go to the browser, and what is
// connected goes as labels, never a password or token.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AppHeader } from '@/app/_shared/components/auditely/appHeader/appHeader';
import { SettingsView } from '@/app/_shared/components/auditely/settingsView/settingsView';
import type { ProfileFields } from '@/app/_shared/lib/brand/profileInput';
import { ROUTES } from '@/app/_shared/lib/config/routes';
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

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect(ROUTES.LOGIN);
  const { db, account } = session;

  const [{ data, error }, connections] = await Promise.all([
    // '*': before the settings migration the new columns aren't there, and read as blank
    db.from('profiles').select('*').eq('id', account.id).maybeSingle(),
    connectionsFor(account),
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
        <SettingsView profile={profile} connections={connections} plan={connections.plan} email={account.email} />
      </main>
    </div>
  );
}
