import { LoginForm } from '@/app/_shared/components/forms/loginForm/loginForm';
import { signupsOpen } from '@/app/_shared/lib/auth/account';
import { googleSignInOn } from '@/app/_shared/lib/auth/googleSignIn';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to Auditely',
  robots: { index: true, follow: true },
};

interface LoginPageProps {
  searchParams: Promise<{ callbackUrl?: string | string[]; error?: string | string[]; method?: string | string[] }>;
}

// A repeated query parameter arrives as a list; the first one counts
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { callbackUrl, error, method } = await searchParams;
  return (
    <LoginForm
      callbackUrl={first(callbackUrl)}
      error={first(error)}
      open={signupsOpen()}
      method={first(method) === 'password' ? 'password' : 'link'}
      google={await googleSignInOn()}
    />
  );
}
