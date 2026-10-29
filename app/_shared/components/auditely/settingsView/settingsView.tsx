// app/_shared/components/auditely/settingsView/settingsView.tsx

'use client';

import Link from 'next/link';
import { ToastProvider } from '@/app/_shared/components/ui/toast/toast';
import { BillingButton } from '@/app/_shared/components/auditely/billing/billingButton';
import { ConnectedRow } from '@/app/_shared/components/auditely/settingsView/connectedRow';
import { DeleteAccountSection } from '@/app/_shared/components/auditely/settingsView/deleteAccountSection';
import { FreeAuditsSection, type FreeAuditsSummary } from '@/app/_shared/components/auditely/settingsView/freeAuditsSection';
import { GrowthSection } from '@/app/_shared/components/auditely/settingsView/growthSection';
import type { GrowthCounts } from '@/app/_shared/lib/growth/funnel';
import { HubSpotForm } from '@/app/_shared/components/auditely/settingsView/hubspotForm';
import { MailboxForm } from '@/app/_shared/components/auditely/settingsView/mailboxForm';
import { PasswordSection } from '@/app/_shared/components/auditely/settingsView/passwordSection';
// The profile form moved to the Brand studio (brandStudio/studioBrandPanel.tsx), beside a live preview
// import { ProfileForm } from '@/app/_shared/components/auditely/settingsView/profileForm';
import { Section } from '@/app/_shared/components/auditely/settingsView/settingsSection';
import { subscriptionNote } from '@/app/_shared/lib/billing/billingCopy';
import type { Subscription } from '@/app/_shared/lib/billing/billingRules';
import type { ProfileFields } from '@/app/_shared/lib/brand/profileInput';
import { API_ROUTES, ROUTES } from '@/app/_shared/lib/config/routes';
import type { Connections } from '@/app/_shared/lib/hooks/useConnections';
import { PLANS, planHas, type Feature, type PlanId } from '@/app/_shared/lib/usage/plans';
import { featureMessage } from '@/app/_shared/lib/usage/usageCopy';

export interface SettingsViewProps {
  /** The account's profile; null when it couldn't be read, so a save can't blank it */
  profile: ProfileFields | null;
  connections: Connections;
  plan: PlanId;
  /** The account's sign-in email, which reports use when the contact email is blank */
  email: string;
  /** The live Stripe subscription: its renewal date and Manage billing */
  subscription: Subscription | null;
  /** STRIPE_SECRET_KEY is set, so the billing portal can open */
  billingReady: boolean;
  /** Today's free audits, for the owner only */
  freeAudits: FreeAuditsSummary | null;
  /** The last 7 and 30 days' numbers, for the owner only; counts are null when they couldn't be read */
  growth: { counts: GrowthCounts[] | null } | null;
}

const PLANS_LINK = 'font-medium text-[var(--color-primary-600)] hover:underline';

function SeePlans() {
  return (
    <Link href={ROUTES.PLANS} className={PLANS_LINK}>
      See plans
    </Link>
  );
}

/** What a plan without the feature reads in place of its form */
function PlanNote({ feature }: { feature: Feature }) {
  return (
    <p className="text-sm text-[var(--color-text-secondary)]">
      {featureMessage(feature)} <SeePlans />
    </p>
  );
}

/**
 * A password or token saved on a paid plan, which the account's plan no longer
 * uses: the account can still delete it
 */
function StillSaved({ text, note, url, disconnected }: { text: string; note: string; url: string; disconnected: string }) {
  return (
    <div className="mt-4 space-y-2">
      <ConnectedRow text={text} url={url} disconnected={disconnected} />
      <p className="text-sm text-[var(--color-text-secondary)]">{note}</p>
    </div>
  );
}

/** The account's profile and branding, its mailbox and HubSpot, its password, its plan, and deleting it */
// `profile` is edited in the Brand studio now; the page still passes it
export function SettingsView({ connections, plan, email, subscription, billingReady, freeAudits, growth }: SettingsViewProps) {
  const paying = plan !== 'owner' && subscription;
  return (
    <ToastProvider position="bottom-right">
      <h1 className="font-display text-4xl font-semibold tracking-tight text-[var(--color-text-primary)]">Settings</h1>
      <p className="mb-10 mt-3 max-w-xl text-base leading-relaxed text-[var(--color-text-secondary)]">
        Who your reports and emails come from, the mailbox they go out through, and where your leads go.
      </p>

      <Section
        id="profile"
        title="Profile and branding"
        lead={
          <p>
            Your name and company sign the AI&apos;s emails, and your logo, contact details and booking link go on your
            reports and emails.
          </p>
        }
      >
        {planHas(plan, 'branding') ? (
          <p className="text-sm text-[var(--color-text-secondary)]">
            Your name, logo and contact details, and the colours, sections and wording of your reports, are in the Brand
            studio, with a live preview.
          </p>
        ) : (
          <p className="text-sm text-[var(--color-text-secondary)]">
            On the {PLANS[plan].name} plan, reports and emails carry Auditely&apos;s name. {featureMessage('branding')} <SeePlans />
          </p>
        )}
        <Link href={ROUTES.STUDIO} className={`mt-3 inline-block text-sm ${PLANS_LINK}`}>
          {planHas(plan, 'branding') ? 'Open the Brand studio' : 'See what the Brand studio does'}
        </Link>
        {/* Moved to the Brand studio. Free has no branding, in the beta too: what it saved before stays saved, unused.
        {!planHas(plan, 'branding') ? (
          <p className="text-sm text-[var(--color-text-secondary)]">
            On the {PLANS[plan].name} plan, reports and emails carry Auditely&apos;s name. {featureMessage('branding')} <SeePlans />
          </p>
        ) : profile ? (
          <ProfileForm profile={profile} email={email} />
        ) : (
          <p className="text-sm text-[var(--color-error)]" role="alert">
            Couldn&apos;t load your profile. Refresh the page to try again.
          </p>
        )} */}
      </Section>

      <Section
        id="mailbox"
        title="Mailbox"
        lead={<p>Send outreach from your own address. It goes through your mail provider, so it lands in your Sent folder.</p>}
      >
        {planHas(plan, 'mailbox') ? (
          <MailboxForm mailbox={connections.mailbox} />
        ) : (
          <>
            <PlanNote feature="mailbox" />
            {connections.mailbox?.source === 'saved' && (
              <StillSaved
                text={`${connections.mailbox.address} is still saved`}
                note={`The ${PLANS[plan].name} plan doesn't send from it. Disconnect it to delete its password.`}
                url={API_ROUTES.SETTINGS_MAILBOX}
                disconnected="Mailbox disconnected"
              />
            )}
          </>
        )}
      </Section>

      <Section id="hubspot" title="HubSpot" lead={<p>Send leads, their audit and a private report link to your HubSpot.</p>}>
        {planHas(plan, 'hubspot') ? (
          <HubSpotForm hubspot={connections.hubspot} />
        ) : (
          <>
            <PlanNote feature="hubspot" />
            {connections.hubspot?.source === 'saved' && (
              <StillSaved
                text="A HubSpot token is still saved"
                note={`The ${PLANS[plan].name} plan doesn't send leads to HubSpot. Disconnect it to delete the token.`}
                url={API_ROUTES.SETTINGS_HUBSPOT}
                disconnected="HubSpot disconnected"
              />
            )}
          </>
        )}
      </Section>

      <PasswordSection />

      <Section
        id="plan"
        title="Plan"
        lead={
          <p>
            {plan === 'owner'
              ? 'Your account has no limits.'
              : subscription
                ? subscriptionNote(subscription)
                : `You're on the ${PLANS[plan].name} plan.`}{' '}
            <SeePlans />
          </p>
        }
      >
        {paying && billingReady ? (
          <BillingButton label="Manage billing" url={API_ROUTES.BILLING_PORTAL} body={{ returnTo: 'settings' }} variant="outline" />
        ) : null}
      </Section>

      {/* The owner's account runs Auditely, so it can't be deleted */}
      {plan !== 'owner' && <DeleteAccountSection email={email} subscribed={Boolean(subscription)} />}

      {freeAudits && <FreeAuditsSection freeAudits={freeAudits} />}
      {growth && <GrowthSection counts={growth.counts} />}
    </ToastProvider>
  );
}
