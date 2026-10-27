import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BusinessCard } from '@/app/_shared/components/auditely/businessCard/businessCard';
import { LeadResults } from '@/app/_shared/components/auditely/leadResults/leadResults';
import { RemoveSitesModal } from '@/app/_shared/components/auditely/removeSitesModal/removeSitesModal';
import { UrlAuditPanel } from '@/app/_shared/components/auditely/urlAuditPanel/urlAuditPanel';
import { demoLinks } from '@/app/_shared/lib/demo/demoLinks';
import type { DemoData } from '@/app/_shared/lib/demo/demoSamples';
import { DemoContext, type Demo } from '@/app/_shared/lib/hooks/useDemo';
import type { BusinessWithData } from '@/app/_shared/lib/types/auditely';

const site = (name: string, extra: Partial<BusinessWithData> = {}): BusinessWithData => ({
  id: `id-${name}`,
  search_id: 'direct',
  name,
  address: '',
  website: `https://${name}`,
  phone: null,
  email: null,
  contact_page: null,
  socials: {},
  contacts_checked_at: null,
  email_lookup_at: null,
  rating: null,
  review_count: null,
  created_at: '2026-10-01T00:00:00Z',
  ...extra,
});

const modal = (sites: BusinessWithData[], extra: { removing?: boolean; error?: string | null; fromSearch?: boolean } = {}) =>
  renderToStaticMarkup(
    createElement(RemoveSitesModal, { sites, removing: false, error: null, onConfirm: () => {}, onClose: () => {}, ...extra })
  );

describe('RemoveSitesModal', () => {
  it('names the one site and says it cannot be undone', () => {
    const html = modal([site('washdent.com')]);
    expect(html).toContain('Remove washdent.com?');
    expect(html).toContain('audit');
    expect(html).toMatch(/can(&#x27;|')t be undone/);
    expect(html).toMatch(/<button[^>]*>Cancel<\/button>/);
    expect(html).toMatch(/<button[^>]*>Remove<\/button>/);
  });

  it('counts and lists the sites when clearing the list', () => {
    const html = modal([site('a.com'), site('b.com'), site('c.com')]);
    expect(html).toContain('Remove all 3 websites?');
    for (const name of ['a.com', 'b.com', 'c.com']) expect(html).toContain(`<li>${name}</li>`);
    expect(html).toMatch(/<button[^>]*>Remove all<\/button>/);
  });

  it('keeps a long list short', () => {
    const html = modal(Array.from({ length: 9 }, (_, i) => site(`site${i}.com`)));
    expect(html).toContain('Remove all 9 websites?');
    expect(html.match(/<li>/g)).toHaveLength(6);
    expect(html).toContain('and 4 more');
  });

  it('warns about report links only when a site was sent to HubSpot', () => {
    expect(modal([site('a.com')])).not.toContain('HubSpot');
    expect(modal([site('a.com', { crm_sent_at: '2026-10-02T00:00:00Z' })])).toContain('HubSpot');
  });

  it("says a lead won't come back when its search is run again", () => {
    const html = modal([site('washdent.com')], { fromSearch: true });
    expect(html).toContain('Remove washdent.com?');
    expect(html).toMatch(/running the same search again won(&#x27;|')t bring it back/);
    expect(html).not.toContain('audit again');
  });

  it('shows why removing failed', () => {
    expect(modal([site('a.com')], { error: 'Failed to remove the website' })).toMatch(/role="alert"[^>]*>Failed to remove the website/);
  });

  it('cannot be confirmed or cancelled twice while removing', () => {
    const html = modal([site('a.com')], { removing: true });
    expect(html.match(/<button[^>]*disabled=""/g)?.length).toBe(2);
    expect(html).not.toContain('aria-label="Close modal"');
  });
});

describe('BusinessCard', () => {
  const card = (onRemove?: () => void) => renderToStaticMarkup(createElement(BusinessCard, { business: site('washdent.com'), onRemove }));

  it('offers to remove the site where the list allows it', () => {
    expect(card(() => {})).toMatch(/<button type="button"[^>]*aria-label="Remove washdent.com"/);
  });

  it('has no remove button otherwise', () => {
    expect(card()).not.toContain('aria-label="Remove');
  });
});

describe('LeadResults', () => {
  const results = (onRemove?: (business: BusinessWithData) => void) =>
    renderToStaticMarkup(
      createElement(LeadResults, {
        businesses: [site('a.com', { search_id: 'search' }), site('b.com', { search_id: 'search' })],
        query: { niche: 'dentists', location: 'Austin, TX' },
        discovery: { done: 2, total: 2 },
        onUpdate: () => {},
        onRemove,
      })
    );

  it('offers to remove each lead', () => {
    const html = results(() => {});
    expect(html).toContain('aria-label="Remove a.com"');
    expect(html).toContain('aria-label="Remove b.com"');
  });

  it('has no remove buttons in the public demo', () => {
    expect(results()).not.toContain('aria-label="Remove');
  });
});

describe('UrlAuditPanel in the public demo', () => {
  it('lists the sample site without any way to remove it', () => {
    const demo: Demo = {
      data: { sites: [site('washdent.com'), site('other.com')] } as DemoData,
      links: demoLinks({}),
      replay: (async () => {
        throw new Error('not used');
      }) as Demo['replay'],
      restrict: () => {},
      playVideo: () => {},
    };
    const html = renderToStaticMarkup(createElement(DemoContext.Provider, { value: demo }, createElement(UrlAuditPanel)));
    expect(html).toContain('Audited websites');
    expect(html).toContain('washdent.com');
    expect(html).not.toContain('Clear all');
    expect(html).not.toContain('aria-label="Remove');
  });
});
