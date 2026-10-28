import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { LoginForm } from '@/app/_shared/components/forms/loginForm/loginForm';
import { signupsOpen } from '@/app/_shared/lib/auth/account';
import { googleSignInOn } from '@/app/_shared/lib/auth/googleSignIn';
import { ROUTES } from '@/app/_shared/lib/config/routes';

export const metadata: Metadata = {
  title: 'Create an account',
  description: 'Create a free Auditely account',
  robots: { index: true, follow: true },
};

interface SignupPageProps {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}

// A repeated query parameter arrives as a list; the first one counts
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

// Making an account: the sign-in form in its sign-up words. While sign-ups are closed
// it's the login, and where the visitor was headed comes along either way.
export default async function SignupPage({ searchParams }: SignupPageProps) {
  const callbackUrl = first((await searchParams).callbackUrl);
  if (!signupsOpen()) {
    redirect(callbackUrl ? `${ROUTES.LOGIN}?callbackUrl=${encodeURIComponent(callbackUrl)}` : ROUTES.LOGIN);
  }
  return <LoginForm mode="signup" open callbackUrl={callbackUrl} google={await googleSignInOn()} />;
}
