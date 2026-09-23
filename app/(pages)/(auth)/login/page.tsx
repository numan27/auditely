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
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
          Welcome back
        </h1>
        <p className="text-[var(--color-text-secondary)]">
          Enter the admin password to continue
        </p>
      </div>
      <LoginForm callbackUrl={callbackUrl} />
    </div>
  );
}
