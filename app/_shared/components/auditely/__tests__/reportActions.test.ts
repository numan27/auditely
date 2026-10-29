import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReportActions } from '@/app/_shared/components/auditely/reportActions/reportActions';

type Props = Parameters<typeof ReportActions>[0];

const render = (state: Record<string, unknown> = {}, crm: Record<string, unknown> = {}) =>
  renderToStaticMarkup(
    createElement(ReportActions, {
      businessName: 'Smile Dental',
      state: { email: null, report: undefined, audit: undefined, pdfLoading: null, pdfError: null, downloadPdf: async () => {}, ...state } as unknown as Props['state'],
      crm: { error: null, sending: false, sentAt: null, send: async () => {}, ...crm } as unknown as Props['crm'],
      mail: { warning: null, sentAt: null, sending: false } as unknown as Props['mail'],
    })
  );

describe('ReportActions', () => {
  it('offers the PDF', () => {
    expect(render()).toContain('Download PDF report');
  });

  // Pressing Download again is the retry; the message says so
  it("says why the PDF didn't download, in place of the hint", () => {
    const html = render({ pdfError: "Couldn't make the PDF. Try again in a minute." });
    expect(html).toContain("Couldn&#x27;t make the PDF. Try again in a minute.");
    expect(html).not.toContain('A branded PDF of this audit, ready to send.');
  });

  // Sending from a mailbox is a paid feature: a Free account sees the button, and
  // pressing it says so (during the beta, that paid plans open later). It sends nothing.
  it("shows a Free account Send email beside its drafts, as a feature it doesn't have", () => {
    const html = render({ email: 'hello@smiledental.com' });
    const send = html.match(/<button[^>]*>(?:(?!<\/button>).)*Send email(?:(?!<\/button>).)*<\/button>/)?.[0] ?? '';
    expect(send).not.toBe('');
    expect(send).not.toContain('disabled');
    expect(html).toContain('Open in Gmail');
    expect(html).toContain('Open in Outlook');
    expect(html.indexOf('Send email')).toBeLessThan(html.indexOf('Open in Gmail'));
  });

  it('shows the PDF problem first, as the latest thing pressed', () => {
    const html = render({ pdfError: "Couldn't make the PDF. Try again in a minute." }, { error: 'HubSpot said no' });
    expect(html).toContain("Couldn&#x27;t make the PDF.");
    expect(html).not.toContain('HubSpot said no');
  });
});
