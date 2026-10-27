import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LoginForm } from '@/app/_shared/components/forms/loginForm/loginForm';

const form = (error?: string) => renderToStaticMarkup(createElement(LoginForm, { error }));

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
});
