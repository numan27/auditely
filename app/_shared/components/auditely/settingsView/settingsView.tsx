// app/_shared/components/auditely/settingsView/settingsView.tsx

'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ToastProvider } from '@/app/_shared/components/ui/toast/toast';
import { ConnectedRow } from '@/app/_shared/components/auditely/settingsView/connectedRow';
import { HubSpotForm } from '@/app/_shared/components/auditely/settingsView/hubspotForm';
import { MailboxForm } from '@/app/_shared/components/auditely/settingsView/mailboxForm';
import { ProfileForm } from '@/app/_shared/components/auditely/settingsView/profileForm';
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
}

const PLANS_LINK = 'font-medium text-[var(--color-primary-600)] hover:underline';

function SeePlans() {
  return (
    <Link href={ROUTES.PLANS} className={PLANS_LINK}>
      See plans
    </Link>
  );
}

/** One part of the page: what it is on the left, its form on the right */
function Section({ id, title, lead, children }: { id: string; title: string; lead: ReactNode; children?: ReactNode }) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="grid scroll-mt-20 gap-6 border-t border-[var(--color-border)] py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-12"
    >
      <div>
        <h2 id={`${id}-title`} className="font-display text-xl font-semibold text-[var(--color-text-primary)]">
          {title}
        </h2>
        <div className="mt-2 space-y-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">{lead}</div>
      </div>
      {children && <div className="max-w-xl">{children}</div>}
    </section>
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

/** The account's profile and branding, its mailbox and HubSpot, and its plan */
export function SettingsView({ profile, connections, plan, email }: SettingsViewProps) {
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
          <>
            <p>
              Your name and company sign the AI&apos;s emails. On a paid plan your logo, contact details and booking link go on
              your reports and emails too.
            </p>
            {!planHas(plan, 'branding') && (
              <p>
                On the Free plan, reports and emails carry Auditely&apos;s name instead. <SeePlans />
              </p>
            )}
          </>
        }
      >
        {profile ? (
          <ProfileForm profile={profile} email={email} />
        ) : (
          <p className="text-sm text-[var(--color-error)]" role="alert">
            Couldn&apos;t load your profile. Refresh the page to try again.
          </p>
        )}
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

      <Section
        id="plan"
        title="Plan"
        lead={
          <p>
            {plan === 'owner' ? 'Your account has no limits.' : `You're on the ${PLANS[plan].name} plan.`} <SeePlans />
          </p>
        }
      />
    </ToastProvider>
  );
}
