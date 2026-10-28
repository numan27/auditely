// The account's password, for signing in without an emailed link: two fields for
// the new one, checked here before it's sent, and what to do if it's forgotten.

import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ToastProvider } from '@/app/_shared/components/ui/toast/toast';
import { PasswordSection, passwordProblem } from '@/app/_shared/components/auditely/settingsView/passwordSection';

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim();

describe('PasswordSection', () => {
  it('asks for a new password twice, as a password manager expects', () => {
    const html = renderToStaticMarkup(createElement(ToastProvider, null, createElement(PasswordSection)));
    expect(html).toMatch(/<h2[^>]*>Password<\/h2>/);
    expect(text(html)).toContain('Set a password to sign in without an emailed link.');
    expect(html.match(/type="password"/g)).toHaveLength(2);
    expect(html.match(/autoComplete="new-password"/gi)).toHaveLength(2);
    expect(text(html)).toContain('New password');
    expect(text(html)).toContain('Type it again');
    expect(text(html)).toContain('Save password');
  });
});

describe('passwordProblem', () => {
  it('asks for 8 to 72 characters, typed the same twice', () => {
    expect(passwordProblem('', '')).toEqual({ field: 'password', error: 'Use at least 8 characters.' });
    expect(passwordProblem('short', 'short')).toEqual({ field: 'password', error: 'Use at least 8 characters.' });
    expect(passwordProblem('x'.repeat(73), 'x'.repeat(73))).toEqual({ field: 'password', error: 'Use 72 characters or fewer.' });
    expect(passwordProblem('correct horse', 'correct hoarse')).toEqual({ field: 'again', error: "The two passwords don't match." });
    expect(passwordProblem('correct horse', 'correct horse')).toBeNull();
  });
});
