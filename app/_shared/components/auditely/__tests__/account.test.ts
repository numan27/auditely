import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// The Workspace reads its view from the address: a non-owner opens a request's link
vi.mock('next/navigation', () => ({
  usePathname: () => '/requests/5b1c1f0e-8f0a-4a52-9a53-0d6a7a0c9c11',
  useRouter: () => ({ push: () => {}, replace: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));

import { BusinessCard } from '@/app/_shared/components/auditely/businessCard/businessCard';
import { LogoutButton } from '@/app/_shared/components/auditely/logoutButton/logoutButton';
import { ModeTabs } from '@/app/_shared/components/auditely/modeTabs/modeTabs';
import { Workspace } from '@/app/_shared/components/auditely/workspace/workspace';
import type { Account } from '@/app/_shared/lib/auth/account';
import { AccountContext } from '@/app/_shared/lib/hooks/useAccount';
import type { AiReport, Audit, Business } from '@/app/_shared/lib/types/auditely';

const owner: Account = { id: 'u1', email: 'owner@example.com', isOwner: true };
const tester: Account = { id: 'u2', email: 'tester@example.com', isOwner: false };
const as = (account: Account, element: ReturnType<typeof createElement>) =>
  renderToStaticMarkup(createElement(AccountContext.Provider, { value: account }, element));

const business: Business = {
  id: 'b1',
  search_id: 's1',
  name: 'Smile Dental',
  address: '1 Main St',
  website: 'https://smiledental.com',
  phone: null,
  email: 'office@smiledental.com',
  contact_page: null,
  socials: {},
  contacts_checked_at: null,
  email_lookup_at: null,
  rating: null,
  review_count: null,
  created_at: '2026-10-01T00:00:00Z',
};
const audit: Audit = {
  id: 'a1',
  business_id: 'b1',
  performance_score: 42,
  seo_score: 80,
  mobile_score: 38,
  ssl_valid: true,
  geo_score: 25,
  aeo_score: 40,
  lead_score: 30,
  checks: {},
  engine_version: 2,
  raw_json: {},
  created_at: '2026-10-01T00:00:00Z',
};
const report: AiReport = {
  id: 'r1',
  audit_id: 'a1',
  summary: 'Slow site.',
  improvements: ['Compress images'],
  cold_email: 'Hi there,\nYour site is slow.',
  created_at: '2026-10-01T00:00:00Z',
};

describe('ModeTabs', () => {
  const tabs = (account: Account) => as(account, createElement(ModeTabs, { value: 'leads', onChange: () => {} }));

  it('shows Requests to the owner', () => {
    expect(tabs(owner)).toContain('Requests');
  });

  it('hides Requests from anyone else', () => {
    const html = tabs(tester);
    expect(html).not.toContain('Requests');
    expect(html).toContain('Find leads');
    expect(html).toContain('Audit a website');
  });
});

describe('Workspace', () => {
  it('opens Find leads for a non-owner who follows a request link, without mounting Requests', () => {
    const html = as(tester, createElement(Workspace));
    expect(html).toMatch(/aria-selected="true"[^>]*>(<[^>]*>)*Find leads|id="workspace-tab-leads"[^>]*aria-selected="true"/);
    expect(html).not.toContain('Requests');
    // The Requests panel's content is never rendered
    expect(html).not.toContain('Free audits requested on devartventures.com');
    expect(html).not.toMatch(/id="workspace-panel-requests"[^>]*>[^<]/);
  });

  it('opens the request for the owner', () => {
    const html = as(owner, createElement(Workspace));
    expect(html).toMatch(/id="workspace-tab-requests"[^>]*aria-selected="true"/);
  });
});

describe('ReportActions', () => {
  const card = (account: Account) =>
    as(account, createElement(BusinessCard, { business, initialAudit: audit, initialReport: report, defaultOpen: true }));

  it('offers sending and HubSpot to the owner', () => {
    const html = card(owner);
    expect(html).toContain('Send email');
    expect(html).toContain('Send to HubSpot');
  });

  it('offers neither to anyone else, but still the PDF', () => {
    const html = card(tester);
    expect(html).not.toContain('Send email');
    expect(html).not.toContain('Send follow-up');
    expect(html).not.toContain('HubSpot');
    expect(html).toContain('Download PDF report');
  });
});

describe('LogoutButton', () => {
  it('says who is signed in', () => {
    expect(as(tester, createElement(LogoutButton))).toContain('title="Signed in as tester@example.com"');
  });
});
