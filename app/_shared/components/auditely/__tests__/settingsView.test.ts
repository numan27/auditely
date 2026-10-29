import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({
  usePathname: () => '/settings',
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));

import { AppHeader } from '@/app/_shared/components/auditely/appHeader/appHeader';
import { SettingsView } from '@/app/_shared/components/auditely/settingsView/settingsView';
import type { ProfileFields } from '@/app/_shared/lib/brand/profileInput';
import type { Connections } from '@/app/_shared/lib/hooks/useConnections';
import type { Subscription } from '@/app/_shared/lib/billing/billingRules';
import type { PlanId } from '@/app/_shared/lib/usage/plans';

const BLANK: ProfileFields = {
  display_name: null,
  company: null,
  website: null,
  logo_data_url: null,
  contact_email: null,
  contact_phone: null,
  booking_url: null,
};

const yearly = {
  plan: 'pro', interval: 'year', status: 'active', anchor: '2026-03-14T09:30:00.000Z', periodEnd: '2027-03-14T09:30:00.000Z', endsAt: null,
} as const;

const view = (over: {
  plan: PlanId;
  connections?: Partial<Connections>;
  profile?: ProfileFields | null;
  subscription?: Subscription | null;
  billingReady?: boolean;
}) => {
  const connections: Connections = {
    plan: over.plan,
    branded: false,
    sender: { name: 'Auditely', signOff: '[Your name]' },
    mailbox: null,
    hubspot: null,
    ...over.connections,
  };
  return renderToStaticMarkup(
    createElement(SettingsView, {
      profile: over.profile === undefined ? BLANK : over.profile,
      connections,
      plan: over.plan,
      email: 'sam@acme.studio',
      subscription: over.subscription ?? null,
      billingReady: over.billingReady ?? false,
      freeAudits: null,
      growth: null,
    })
  );
};

// The mailbox password and HubSpot token fields; the account's own sign-in password has its section
const withoutSignInPassword = (html: string) => html.replace(/<section id="password"[\s\S]*?<\/section>/, '');
const passwordInputs = (html: string) => withoutSignInPassword(html).match(/<input[^>]*type="password"[^>]*>/g) ?? [];

describe('SettingsView', () => {
  it('shows a Free account the plan notes in place of the mailbox and HubSpot forms', () => {
    const html = view({ plan: 'free' });
    expect(html).toContain('Sending from your own mailbox comes with the Pro and Agency plans.');
    expect(html).toContain('The HubSpot handoff comes with the Pro and Agency plans.');
    expect(html).not.toContain('App password');
    expect(html).not.toContain('Private app access token');
    expect(html).not.toContain('Save profile');
  });

  it('lets a Free account delete the mailbox password and HubSpot token it saved on a paid plan', () => {
    const html = view({ plan: 'free', connections: { mailbox: { address: 'sam@acme.studio', source: 'saved' }, hubspot: { source: 'saved' } } });
    expect(html.match(/>Disconnect<\/button>/g)).toHaveLength(2);
    expect(html).toContain('sam@acme.studio is still saved');
    expect(html).toContain('The Free plan doesn&#x27;t send from it. Disconnect it to delete its password.');
    expect(html).toContain('A HubSpot token is still saved');
    expect(html).toContain('The Free plan doesn&#x27;t send leads to HubSpot. Disconnect it to delete the token.');
    expect(html).toContain('Sending from your own mailbox comes with the Pro and Agency plans.');
    expect(passwordInputs(html)).toEqual([]);
  });

  it('shows a Free account nothing to disconnect when it saved nothing', () => {
    expect(view({ plan: 'free' })).not.toContain('Disconnect');
  });

  it('gives a Free account no profile form, in the beta or after it: its reports carry Auditely’s name', () => {
    for (const flag of ['true', 'false']) {
      vi.stubEnv('NEXT_PUBLIC_BETA_MODE', flag);
      const html = view({ plan: 'free', profile: { ...BLANK, display_name: 'Sam Lee' } });
      expect(html).not.toContain('value="Sam Lee"');
      expect(html).not.toContain('during the beta');
      expect(html).toContain(
        'On the Free plan, reports and emails carry Auditely&#x27;s name. Your own branding on reports comes with the Pro and Agency plans.'
      );
      // The studio shows a Free account what branding would do
      expect(html).toContain('href="/studio"');
      expect(html).toContain('href="/plans"');
    }
    vi.unstubAllEnvs();
  });

  // The profile form moved to the Brand studio (studio/__tests__/page.test.ts)
  it('sends a paid account to the Brand studio for its profile, with nothing about the Free plan', () => {
    const html = view({ plan: 'pro', profile: { ...BLANK, display_name: 'Sam Lee' } });
    expect(html).toContain('href="/studio"');
    expect(html).toContain('Open the Brand studio');
    expect(html).toContain('Your name and company sign the AI&#x27;s emails');
    expect(html).not.toContain('value="Sam Lee"');
    expect(html).not.toContain('On the Free plan');
  });

  it('has the four sections the rest of the app links to', () => {
    const html = view({ plan: 'pro' });
    for (const id of ['profile', 'mailbox', 'hubspot', 'plan']) expect(html).toContain(`id="${id}"`);
    expect(html).toContain('Profile and branding');
  });

  it('shows a connected mailbox by its address, with Disconnect', () => {
    const html = view({ plan: 'pro', connections: { mailbox: { address: 'sam@acme.studio', source: 'saved' } } });
    expect(html).toContain('Sending from sam@acme.studio');
    expect(html).toContain('Disconnect');
    expect(html).not.toContain('App password');
  });

  it('shows the owner’s Vercel mailbox with the form to connect their own', () => {
    const html = view({ plan: 'owner', connections: { mailbox: { address: 'hello@devartventures.com', source: 'env' } } });
    expect(html).toContain('Sending from hello@devartventures.com, set up in Vercel. Connect a mailbox here to use it instead.');
    expect(html).toContain('App password');
    expect(html).toContain('Connect mailbox');
    expect(html).toContain('Your account has no limits.');
  });

  it('offers the mail providers and fills in the first one’s server', () => {
    const html = view({ plan: 'pro' });
    expect(html).toContain('Gmail or Google Workspace');
    expect(html).toContain('Zoho Mail');
    expect(html).toContain('value="smtp.gmail.com"');
    expect(html).toContain('Use an app password: Google Account › Security › App passwords.');
    expect(html).toContain('The From address, if it isn&#x27;t the email address');
  });

  it('lets every plan set a sign-in password, and never fills it in', () => {
    for (const plan of ['free', 'pro', 'owner'] as const) {
      const section = view({ plan }).match(/<section id="password"[\s\S]*?<\/section>/)?.[0] ?? '';
      expect(section, plan).toMatch(/<h2[^>]*>Password<\/h2>/);
      const inputs = section.match(/<input[^>]*type="password"[^>]*>/g) ?? [];
      expect(inputs, plan).toHaveLength(2);
      for (const input of inputs) expect(input).not.toMatch(/value="[^"]/);
    }
  });

  it('never fills in a password or token', () => {
    const html = view({ plan: 'pro' });
    const inputs = passwordInputs(html);
    expect(inputs).toHaveLength(2);
    for (const input of inputs) expect(input).not.toMatch(/value="[^"]/);
  });

  it('shows HubSpot connected, through Settings or through Vercel', () => {
    const saved = view({ plan: 'pro', connections: { hubspot: { source: 'saved' } } });
    expect(saved).toContain('Connected');
    expect(saved).not.toContain('Private app access token');
    const env = view({ plan: 'owner', connections: { hubspot: { source: 'env' } } });
    expect(env).toContain('Connected through HUBSPOT_TOKEN in Vercel.');
    expect(env).toContain('Connect HubSpot');
    const none = view({ plan: 'pro' });
    expect(none).toContain('Private app access token');
    expect(none).toContain('Settings › Integrations › Private apps');
  });
});

describe('SettingsView plan', () => {
  it("shows a subscriber's renewal date and Manage billing", () => {
    const html = view({ plan: 'pro', subscription: yearly, billingReady: true });
    expect(html).toContain('It renews on Mar 14, 2027.');
    expect(html).toContain('Manage billing');
  });

  it('shows a Free account only its plan and the plans link', () => {
    const html = view({ plan: 'free', subscription: null, billingReady: true });
    expect(html).toContain('You&#x27;re on the Free plan.');
    expect(html).not.toContain('Manage billing');
  });

  it('offers no Manage billing while billing is off, and tells the owner there are no limits', () => {
    expect(view({ plan: 'pro', subscription: yearly, billingReady: false })).not.toContain('Manage billing');
    const owner = view({ plan: 'owner', subscription: null, billingReady: true });
    expect(owner).toContain('Your account has no limits.');
    expect(owner).not.toContain('Manage billing');
  });
});

describe('SettingsView delete account', () => {
  it('lets every account but the owner delete itself, last on the page', () => {
    for (const plan of ['free', 'pro', 'agency'] as const) {
      const html = view({ plan });
      expect(html).toContain('id="delete-account"');
      expect(html.indexOf('id="delete-account"')).toBeGreaterThan(html.indexOf('id="plan"'));
    }
    expect(view({ plan: 'owner' })).not.toContain('id="delete-account"');
  });

  it('tells a subscriber their subscription ends with no refund', () => {
    expect(view({ plan: 'pro', subscription: yearly })).toContain('Your subscription ends straight away, with no refund.');
    expect(view({ plan: 'free' })).not.toContain('no refund');
  });
});

describe('AppHeader', () => {
  it('links to the Brand studio from the header', () => {
    const html = renderToStaticMarkup(createElement(AppHeader));
    expect(html).toContain('href="/studio"');
    expect(html).toContain('Brand studio');
  });

  it('links to Settings from the header', () => {
    const html = renderToStaticMarkup(createElement(AppHeader));
    expect(html).toContain('href="/settings"');
    expect(html).toContain('Settings');
    // The page it's on is marked
    expect(html).toMatch(/aria-current="page"[^>]*href="\/settings"|href="\/settings"[^>]*aria-current="page"/);
  });
});
