import type { Metadata } from 'next';
import { LoginForm } from '@/app/_shared/components/forms/loginForm/loginForm';
import { signupsOpen } from '@/app/_shared/lib/auth/account';
import { googleSignInOn } from '@/app/_shared/lib/auth/googleSignIn';

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

// Making an account with an email and a password: the sign-in form in its sign-up
// words. Accounts are made only here, so while sign-ups are closed it's for invited
// addresses (the route checks), and where the visitor was headed comes along.
export default async function SignupPage({ searchParams }: SignupPageProps) {
  const callbackUrl = first((await searchParams).callbackUrl);
  return <LoginForm mode="signup" open={signupsOpen()} callbackUrl={callbackUrl} google={await googleSignInOn()} />;
}
