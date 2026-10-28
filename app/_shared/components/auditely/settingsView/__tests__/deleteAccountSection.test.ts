// Deleting the account from Settings: what goes, a box that asks for the account's
// email before the button works, and the request that deletes it.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  DeleteAccountConfirm,
  DeleteAccountSection,
  confirmMatches,
  deleteAccount,
} from '@/app/_shared/components/auditely/settingsView/deleteAccountSection';

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim();

const confirm = (props: Partial<Parameters<typeof DeleteAccountConfirm>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(DeleteAccountConfirm, {
      email: 'tester@x.com',
      subscribed: false,
      typed: '',
      error: null,
      deleting: false,
      onType: () => {},
      onDelete: () => {},
      onClose: () => {},
      ...props,
    })
  );

const deleteButton = (html: string) => /<button[^>]*>(?:(?!<\/button>).)*Delete my account/.exec(html)?.[0] ?? '';

afterEach(() => vi.unstubAllGlobals());

describe('DeleteAccountSection', () => {
  it("says what goes and that it can't be undone", () => {
    const html = renderToStaticMarkup(createElement(DeleteAccountSection, { email: 'tester@x.com', subscribed: false }));
    expect(html).toMatch(/<h2[^>]*>Delete account<\/h2>/);
    expect(text(html)).toContain(
      "Delete your account and everything in it: your searches, leads, audits, reports and settings. It can't be undone."
    );
    expect(text(html)).not.toContain('refund');
    expect(text(html)).toContain('Delete account');
  });

  it('says a subscription ends at once, with no refund', () => {
    const html = renderToStaticMarkup(createElement(DeleteAccountSection, { email: 'tester@x.com', subscribed: true }));
    expect(text(html)).toContain('Your subscription ends straight away, with no refund.');
  });
});

describe('DeleteAccountConfirm', () => {
  it("asks for the account's email, and the button waits for it", () => {
    const html = confirm();
    expect(text(html)).toContain('Delete your account?');
    expect(text(html)).toContain(
      'This deletes tester@x.com and everything in it, for good: your searches, leads, audits, reports and settings.'
    );
    expect(text(html)).toContain('Type your email to confirm');
    expect(html).toContain('placeholder="tester@x.com"');
    expect(text(html)).toContain('Cancel');
    expect(deleteButton(html)).toContain('disabled');
  });

  it('lets the button work once the email is typed', () => {
    expect(deleteButton(confirm({ typed: 'Tester@x.com ' }))).not.toContain('disabled=""');
  });

  it("shows the server's reason under the field", () => {
    const html = confirm({ typed: 'tester@x.com', error: "Your account wasn't deleted. Try again in a minute." });
    expect(text(html)).toContain("Your account wasn't deleted. Try again in a minute.");
  });

  it('mentions the subscription when there is one', () => {
    expect(text(confirm({ subscribed: true }))).toContain('Your subscription ends straight away, with no refund.');
  });
});

describe('confirmMatches', () => {
  it("matches the account's email, whatever the case or spaces", () => {
    expect(confirmMatches('tester@x.com', 'tester@x.com')).toBe(true);
    expect(confirmMatches('  TESTER@x.com ', 'tester@x.com')).toBe(true);
    expect(confirmMatches('', 'tester@x.com')).toBe(false);
    expect(confirmMatches('tester@x.co', 'tester@x.com')).toBe(false);
  });
});

describe('deleteAccount', () => {
  it('sends the typed email to the account route', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ deleted: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    expect(await deleteAccount('tester@x.com')).toEqual({ ok: true });
    expect(fetch.mock.calls[0][0]).toBe('/api/settings/account');
    expect(fetch.mock.calls[0][1]).toMatchObject({ method: 'DELETE', body: JSON.stringify({ confirm: 'tester@x.com' }) });
  });

  it("says the account wasn't deleted when the answer isn't readable", async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>timeout</html>', { status: 504 })));
    expect(await deleteAccount('tester@x.com')).toEqual({
      ok: false,
      error: "Your account wasn't deleted. Try again in a minute.",
      field: undefined,
    });
  });
});
