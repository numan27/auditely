import { LoginForm } from '@/app/_shared/components/forms/loginForm/loginForm';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to Auditely',
};

interface LoginPageProps {
  searchParams: Promise<{ callbackUrl?: string | string[]; error?: string | string[] }>;
}

// A repeated query parameter arrives as a list; the first one counts
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { callbackUrl, error } = await searchParams;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
          Sign in to Auditely
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Use the email you were invited with.</p>
      </div>
      <LoginForm callbackUrl={first(callbackUrl)} error={first(error)} />
    </div>
  );
}
