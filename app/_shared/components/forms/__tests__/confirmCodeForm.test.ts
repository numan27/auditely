// The step after signing up: the code Supabase emailed confirms the address and
// signs the new account in. A new code can be sent, and a mistyped email fixed.

import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConfirmCodeForm } from '@/app/_shared/components/forms/confirmCodeForm/confirmCodeForm';

type Props = Parameters<typeof ConfirmCodeForm>[0];
const render = (props: Partial<Props> = {}) =>
  renderToStaticMarkup(
    createElement(ConfirmCodeForm, { email: 'new@example.com', password: 'correct horse battery', next: '/', onBack: () => {}, ...props })
  );
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim();

describe('ConfirmCodeForm', () => {
  it('says where the code went and how long it works', () => {
    const page = text(render());
    expect(page).toContain('Check your email');
    expect(page).toContain('We sent a 6-digit code to new@example.com. It works for an hour.');
  });

  it("asks for the code the way phones fill it in, and confirms with it", () => {
    const html = render();
    const input = html.match(/<input[^>]*>/)?.[0] ?? '';
    expect(input).toContain('autoComplete="one-time-code"');
    expect(input).toContain('inputMode="numeric"');
    expect(input).toContain('name="code"');
    expect(text(html)).toContain('Code');
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>(?:(?!<\/button>).)*Confirm and sign in/);
  });

  it('can send a new code, or go back to fix the email', () => {
    const html = render();
    expect(html).toMatch(/<button[^>]*type="button"[^>]*>(?:(?!<\/button>).)*Send a new code/);
    expect(html).toMatch(/<button[^>]*type="button"[^>]*>(?:(?!<\/button>).)*Use a different email/);
  });

  it('says why it is asking when a sign-in found the email not confirmed yet', () => {
    const page = text(render({ notice: "Your email isn't confirmed yet. We sent a new code to new@example.com." }));
    expect(page).toContain("Your email isn't confirmed yet. We sent a new code to new@example.com.");
    expect(page).not.toContain('It works for an hour.');
  });
});
