// app/_shared/components/auditely/settingsView/passwordSection.tsx

'use client';

// The account's password, so it can sign in with one instead of an emailed link.
// A forgotten one is replaced here too, after signing in with a link.

import { useState, type FormEvent } from 'react';
import { Button } from '@/app/_shared/components/ui/button/button';
import { Input } from '@/app/_shared/components/ui/input/input';
import { useToast } from '@/app/_shared/components/ui/toast/toast';
import { Section } from '@/app/_shared/components/auditely/settingsView/settingsSection';
import { sendSettings } from '@/app/_shared/components/auditely/settingsView/settingsRequest';
import { API_ROUTES } from '@/app/_shared/lib/config/routes';

type Field = 'password' | 'again';

// The same limits /api/settings/password holds it to
const MIN = 8;
const MAX = 72;

/** What's wrong with the new password before it's sent, or null */
export function passwordProblem(password: string, again: string): { field: Field; error: string } | null {
  if (password.length < MIN) return { field: 'password', error: `Use at least ${MIN} characters.` };
  if (new TextEncoder().encode(password).length > MAX) return { field: 'password', error: `Use ${MAX} characters or fewer.` };
  if (again !== password) return { field: 'again', error: "The two passwords don't match." };
  return null;
}

export function PasswordSection() {
  const { addToast } = useToast();
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [problem, setProblem] = useState<{ field: Field; error: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const errorFor = (field: Field) => (problem?.field === field ? problem.error : undefined);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const found = passwordProblem(password, again);
    setProblem(found);
    if (found) return;
    setSaving(true);
    const answer = await sendSettings(API_ROUTES.SETTINGS_PASSWORD, 'PUT', { password });
    setSaving(false);
    if (!answer.ok) {
      setProblem({ field: 'password', error: answer.error });
      return;
    }
    setPassword('');
    setAgain('');
    addToast({ title: 'Password saved', description: 'Use it next time you sign in.', variant: 'success' });
  };

  return (
    <Section
      id="password"
      title="Password"
      lead={
        <p>
          Set a password to sign in without an emailed link. Forgot it? Sign in with a link, then set a new one here.
        </p>
      }
    >
      <form onSubmit={save} className="space-y-5" noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errorFor('password')}
            helpText={`At least ${MIN} characters`}
          />
          <Input
            label="Type it again"
            type="password"
            autoComplete="new-password"
            value={again}
            onChange={(e) => setAgain(e.target.value)}
            error={errorFor('again')}
          />
        </div>
        <Button type="submit" variant="outline" isLoading={saving}>
          Save password
        </Button>
      </form>
    </Section>
  );
}
