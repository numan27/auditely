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

const view = (over: { plan: PlanId; connections?: Partial<Connections>; profile?: ProfileFields | null }) => {
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
    })
  );
};

const passwordInputs = (html: string) => html.match(/<input[^>]*type="password"[^>]*>/g) ?? [];

describe('SettingsView', () => {
  it('shows a Free account the plan notes in place of the mailbox and HubSpot forms', () => {
    const html = view({ plan: 'free' });
    expect(html).toContain('Sending from your own mailbox comes with the Pro and Agency plans.');
    expect(html).toContain('The HubSpot handoff comes with the Pro and Agency plans.');
    expect(html).not.toContain('App password');
    expect(html).not.toContain('Private app access token');
    expect(html).toContain('Save profile');
  });

  it('tells a Free account its reports carry Auditely’s name, with a link to the plans', () => {
    const html = view({ plan: 'free' });
    expect(html).toContain('On the Free plan, reports and emails carry Auditely&#x27;s name instead.');
    expect(html).toContain('href="/plans"');
    expect(html).toContain('You&#x27;re on the Free plan.');
    expect(view({ plan: 'pro' })).not.toContain('On the Free plan');
  });

  it('has the four sections the rest of the app links to', () => {
    const html = view({ plan: 'pro' });
    for (const id of ['profile', 'mailbox', 'hubspot', 'plan']) expect(html).toContain(`id="${id}"`);
    expect(html).toContain('Profile and branding');
  });

  it('fills the profile form from the saved profile', () => {
    const html = view({ plan: 'pro', profile: { ...BLANK, display_name: 'Sam Lee', company: 'Acme Studio', contact_phone: '+1 555 0100' } });
    expect(html).toContain('value="Sam Lee"');
    expect(html).toContain('value="Acme Studio"');
    expect(html).toContain('value="+1 555 0100"');
    expect(html).toContain('Shown on reports. Leave blank to use sam@acme.studio.');
    expect(html).toContain('PNG or JPEG, under 256 KB');
  });

  it('shows a saved logo with a way to remove it', () => {
    const logo = 'data:image/png;base64,iVBORw0KGgo=';
    const html = view({ plan: 'pro', profile: { ...BLANK, logo_data_url: logo } });
    expect(html).toContain(`src="${logo}"`);
    expect(html).toContain('Remove logo');
    expect(view({ plan: 'pro' })).not.toContain('Remove logo');
  });

  it('offers no profile form when the profile couldn’t be loaded, so a save can’t blank it', () => {
    const html = view({ plan: 'pro', profile: null });
    expect(html).toContain('Couldn&#x27;t load your profile. Refresh the page to try again.');
    expect(html).not.toContain('Save profile');
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

describe('AppHeader', () => {
  it('links to Settings from the header', () => {
    const html = renderToStaticMarkup(createElement(AppHeader));
    expect(html).toContain('href="/settings"');
    expect(html).toContain('Settings');
    // The page it's on is marked
    expect(html).toMatch(/aria-current="page"[^>]*href="\/settings"|href="\/settings"[^>]*aria-current="page"/);
  });
});
