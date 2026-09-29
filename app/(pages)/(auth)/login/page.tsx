import { LoginForm } from '@/app/_shared/components/forms/loginForm/loginForm';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to Auditely',
};

interface LoginPageProps {
  searchParams: Promise<{ callbackUrl?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { callbackUrl } = await searchParams;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
          Sign in to Auditely
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Enter the admin password to continue.</p>
      </div>
      <LoginForm callbackUrl={callbackUrl} />
    </div>
  );
}
