'use client';

// app/_shared/components/forms/confirmCodeForm/confirmCodeForm.tsx

// The step after signing up: Supabase emailed a 6-digit code, and typing it here
// confirms the address and signs the new account in. A new code can be sent, and
// a mistyped email fixed by going back to the form.

import { useState, type FormEvent } from 'react';
import { Input } from '@/app/_shared/components/ui/input/input';
import { Button } from '@/app/_shared/components/ui/button/button';
import { CODE_LENGTH, readCode } from '@/app/_shared/lib/auth/passwordRules';
import { confirmCode, resendCode } from '@/app/_shared/lib/auth/signupRequests';

const textButtonClasses =
  'font-medium text-[var(--color-text-primary)] underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

interface ConfirmCodeFormProps {
  email: string;
  /** The password chosen on sign-up, set on the account once the code confirms it */
  password: string;
  /** Where the new account goes once signed in */
  next: string;
  /** Said instead of the usual line, when a sign-in found the email not confirmed yet */
  notice?: string;
  /** Back to the form, to fix the email */
  onBack: () => void;
}

export function ConfirmCodeForm({ email, password, next, notice, onBack }: ConfirmCodeFormProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const typed = readCode(code);
    if (!typed) {
      setError(`Enter the ${CODE_LENGTH}-digit code from the email.`);
      return;
    }
    setBusy(true);
    setError(null);
    const answer = await confirmCode(email, password, typed, next);
    // Signed in: a full page load, so the server reads the new session cookies
    if (answer.ok) return window.location.assign(answer.next);
    setError(answer.error);
    setBusy(false);
  }

  async function sendAgain() {
    setResending(true);
    const answer = await resendCode(email, next);
    setResent(answer.ok ? `We sent a new code to ${email}.` : answer.error);
    setResending(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">Check your email</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {notice ?? `We sent a ${CODE_LENGTH}-digit code to ${email}. It works for an hour.`}
        </p>
      </div>

      <form onSubmit={submit} className="space-y-6" noValidate>
        <Input
          id="code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          label="Code"
          placeholder="123456"
          onChange={(event) => setCode(event.target.value)}
          value={code}
          error={error ?? undefined}
          required
        />
        <Button type="submit" variant="primary" size="lg" fullWidth isLoading={busy}>
          Confirm and sign in
        </Button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <button type="button" onClick={sendAgain} disabled={resending} className={textButtonClasses}>
          Send a new code
        </button>
        <button type="button" onClick={onBack} className={textButtonClasses}>
          Use a different email
        </button>
      </div>
      {resent && (
        <p className="text-sm text-[var(--color-text-secondary)]" role="status">
          {resent}
        </p>
      )}
    </div>
  );
}
