// app/(app)/studio/page.tsx

// The Brand studio: the account's brand and the look of its reports and
// emails, with a live preview. The profile is read as the user and only its
// fields and design go to the browser. A plan without branding sees the studio
// in a sample look, with nothing to save. Until the studio migration has run,
// the design reads as today's and the page says saving can't work yet.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AppHeader } from '@/app/_shared/components/auditely/appHeader/appHeader';
import { BrandStudio } from '@/app/_shared/components/auditely/brandStudio/brandStudio';
import { checkoutOpen } from '@/app/_shared/lib/billing/billingRules';
import { studioUnavailable } from '@/app/_shared/lib/brand/brand';
import { readDesign } from '@/app/_shared/lib/brand/brandDesign';
import { resolveBrand } from '@/app/_shared/lib/brand/brandRules';
import type { ProfileFields } from '@/app/_shared/lib/brand/profileInput';
import { ROUTES } from '@/app/_shared/lib/config/routes';
import { getSession } from '@/app/_shared/lib/supabase/server';
import { planFor, planHas } from '@/app/_shared/lib/usage/plans';

export const metadata: Metadata = { title: 'Brand studio' };

const FIELDS: (keyof ProfileFields)[] = [
  'display_name',
  'company',
  'website',
  'logo_data_url',
  'contact_email',
  'contact_phone',
  'booking_url',
];

export default async function StudioPage() {
  const session = await getSession();
  if (!session) redirect(ROUTES.LOGIN);
  const { db, account } = session;

  // '*': before the studio migration brand_design isn't there, and reads as today's look
  const { data, error } = await db.from('profiles').select('*').eq('id', account.id).maybeSingle();
  if (error) console.error('[studio] Failed to read the profile:', error.message);
  const row = (data ?? {}) as Partial<Record<keyof ProfileFields, string | null>> & { brand_design?: unknown };
  const profile = Object.fromEntries(FIELDS.map((field) => [field, row[field] ?? null])) as unknown as ProfileFields;
  const plan = planFor(account).id;
  const locked = !planHas(plan, 'branding');
  const ready = !data || 'brand_design' in data;
  // Today's sentence for this account: the owner offers a 30-minute call
  const { call } = resolveBrand({ profile: { email: account.email, ...profile }, isOwner: account.isOwner, plan });

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <AppHeader wide />
      <main className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 sm:pt-12">
        {error ? (
          // A profile that couldn't be read is never offered for saving, so a save can't blank it
          <p className="text-sm text-[var(--color-error)]" role="alert">
            Couldn&apos;t load your brand. Refresh the page to try again.
          </p>
        ) : (
          <BrandStudio
            profile={profile}
            design={readDesign(row.brand_design)}
            email={account.email}
            locked={locked}
            checkoutOpen={checkoutOpen()}
            notice={locked || ready ? null : studioUnavailable(account.isOwner)}
            defaultCtaText={`We can walk you through every issue in this report on ${call}, with no obligation.`}
          />
        )}
      </main>
    </div>
  );
}
