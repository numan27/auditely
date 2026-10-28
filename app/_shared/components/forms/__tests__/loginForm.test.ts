import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LoginForm } from '@/app/_shared/components/forms/loginForm/loginForm';
import { PLANS } from '@/app/_shared/lib/usage/plans';

type Props = Parameters<typeof LoginForm>[0];
const form = (error?: string) => renderToStaticMarkup(createElement(LoginForm, { error }));
const render = (props: Props) => renderToStaticMarkup(createElement(LoginForm, props));
// What a reader sees: the markup's text, entities decoded
const text = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'").replace(/\s+/g, ' ');

describe('LoginForm', () => {
  it('says what went wrong on the way back from a sign-in', () => {
    expect(form('link')).toContain('That sign-in link has expired or was already used. Send yourself a new one.');
    expect(form('closed')).toContain('Auditely is invite-only for now. Use the email you were invited with.');
  });

  it("shows no error for an ?error= it doesn't know, a built-in object key among them", () => {
    const plain = form();
    for (const error of ['nope', '__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
      expect(form(error), error).toBe(plain);
    }
  });

  it('keeps the invite-only sign-in as it was while sign-ups are closed', () => {
    const page = text(render({}));
    expect(page).toContain('Sign in to Auditely');
    expect(page).toContain('Use the email you were invited with.');
    expect(page).not.toContain('Create an account');
  });

  it('offers a new visitor an account from the sign-in once sign-ups are open', () => {
    const html = render({ open: true, callbackUrl: '/plans' });
    expect(text(html)).toContain('Sign in to Auditely');
    expect(text(html)).toContain("We'll email you a sign-in link, or use Google.");
    expect(text(html)).toContain('New to Auditely? Create an account');
    expect(html).toContain('href="/signup?callbackUrl=%2Fplans"');
  });

  it('invites a new visitor to make a free account', () => {
    const html = render({ mode: 'signup', open: true });
    expect(text(html)).toContain('Create your Auditely account');
    expect(text(html)).toContain(`Free, with ${PLANS.free.limits.audit} audits a month. We'll email you a link, or use Google.`);
    expect(text(html)).toContain('Already have an account? Sign in');
    expect(html).toContain('href="/login"');
  });

  it('asks a new visitor to agree to the Terms and Privacy Policy', () => {
    for (const props of [{ mode: 'signup', open: true }, { open: true }, {}] as Props[]) {
      const html = render(props);
      expect(text(html)).toContain("By continuing, you agree to Auditely's Terms and Privacy Policy.");
      expect(html).toContain('href="/terms"');
      expect(html).toContain('href="/privacy"');
    }
  });
});
