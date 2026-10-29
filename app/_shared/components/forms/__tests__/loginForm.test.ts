import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LoginForm } from '@/app/_shared/components/forms/loginForm/loginForm';

type Props = Parameters<typeof LoginForm>[0];
const form = (error?: string) => renderToStaticMarkup(createElement(LoginForm, { error }));
const render = (props: Props) => renderToStaticMarkup(createElement(LoginForm, props));
// What a reader sees: the markup's text, entities decoded
const text = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'").replace(/\s+/g, ' ');

describe('LoginForm', () => {
  it("leaves Google out while it isn't turned on, so nobody is sent to a dead end", () => {
    for (const props of [{ open: true }, { mode: 'signup' as const, open: true }, { open: true, method: 'password' as const }]) {
      const html = render({ ...props, google: false });
      expect(html).not.toContain('/auth/google');
      expect(text(html)).not.toContain('Google');
    }
    expect(text(render({ open: true, google: false }))).toContain("We'll email you a sign-in link.");
    expect(text(render({ mode: 'signup', open: true, google: false }))).toContain(
      "Free, with 1 search and 2 audits a month. We'll email you a code to confirm your address."
    );
    expect(text(render({ open: true, method: 'password', google: false }))).toContain('Sign in with your email and password.');
    expect(render({ open: true })).toContain('href="/auth/google?next=%2F"');
  });

  it('says Google sign-in is off when an old link to it is followed', () => {
    expect(text(form('google-off'))).toContain("Google sign-in isn't available yet. Use your email instead.");
  });

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

  // Accounts are made on the sign-up page only, so an invited newcomer is sent there
  it('points an invited newcomer to the sign-up page while sign-ups are closed', () => {
    const html = render({});
    expect(text(html)).toContain('Sign in to Auditely');
    expect(text(html)).toContain('Use the email you were invited with.');
    expect(text(html)).toContain('Invited to Auditely? Create your account');
    expect(text(html)).not.toContain('Create an account');
    expect(html).toContain('href="/signup"');
  });

  it('says sign-up is for invited addresses while sign-ups are closed', () => {
    const page = text(render({ mode: 'signup', google: false }));
    expect(page).toContain('Create your Auditely account');
    expect(page).toContain('Auditely is invite-only for now. Use the email you were invited with.');
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
    expect(text(html)).toContain("Free, with 1 search and 2 audits a month. We'll email you a code to confirm your address, or use Google.");
    expect(text(html)).toContain('Already have an account? Sign in');
    expect(html).toContain('href="/login"');
  });

  it('offers a password instead of a link on the sign-in page, keeping where the visitor was headed', () => {
    expect(render({ open: true })).toContain('href="/login?method=password"');
    expect(render({})).toContain('href="/login?method=password"');
    const html = render({ open: true, callbackUrl: '/plans' });
    expect(text(html)).toContain('Sign in with a password instead');
    expect(html).toContain('href="/login?method=password&amp;callbackUrl=%2Fplans"');
  });

  it('asks for the email and password, and says what to do about a forgotten one', () => {
    const html = render({ open: true, method: 'password', callbackUrl: '/plans' });
    expect(html).toMatch(/<input[^>]*type="password"[^>]*autoComplete="current-password"|<input[^>]*autoComplete="current-password"[^>]*type="password"/i);
    expect(text(html)).toContain('Sign in with your email and password, or use Google.');
    expect(text(html)).toContain('Sign in');
    expect(text(html)).not.toContain('Email me a link');
    expect(text(html)).toContain('Forgot your password? Email yourself a sign-in link, then set a new one in Settings.');
    expect(html).toContain('href="/login?callbackUrl=%2Fplans"');
  });

  it('asks a new visitor for an email and a new password, not for a link', () => {
    const html = render({ mode: 'signup', open: true, google: false });
    expect(html).toMatch(/<input[^>]*type="password"[^>]*autoComplete="new-password"|<input[^>]*autoComplete="new-password"[^>]*type="password"/i);
    expect(text(html)).toContain('At least 8 characters.');
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>(?:(?!<\/button>).)*Create account/);
    expect(text(html)).not.toContain('Email me a link');
    expect(text(html)).not.toContain('password instead');
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
