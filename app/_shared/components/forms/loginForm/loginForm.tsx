'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useFormik } from 'formik';
import {
  emailLinkSchema,
  passwordSignInSchema,
  signupSchema,
  type PasswordSignInFormValues,
} from '@/app/_shared/lib/validations/schemas';
import { Input } from '@/app/_shared/components/ui/input/input';
import { Button } from '@/app/_shared/components/ui/button/button';
import buttonStyles from '@/app/_shared/components/ui/button/button.module.scss';
import { API_ROUTES, ROUTES, safeCallbackUrl } from '@/app/_shared/lib/config/routes';
import { PLANS } from '@/app/_shared/lib/usage/plans';
import { countOf } from '@/app/_shared/lib/usage/usageCopy';
import { ConsentLine } from '@/app/_shared/components/forms/consentLine/consentLine';
import { ConfirmCodeForm } from '@/app/_shared/components/forms/confirmCodeForm/confirmCodeForm';
import { requestSignup, resendCode } from '@/app/_shared/lib/auth/signupRequests';
import { PASSWORD_MIN } from '@/app/_shared/lib/auth/passwordRules';

// What went wrong on the way back from a sign-in (/auth/callback, /auth/google), by ?error=
const INVITE_ONLY = 'Auditely is invite-only for now. Use the email you were invited with.';
const SIGN_IN_ERRORS: Record<string, string> = {
  link: 'That sign-in link has expired or was already used. Send yourself a new one.',
  closed: INVITE_ONLY,
  google: "Couldn't reach Google. Try again, or use your email.",
  'google-off': "Google sign-in isn't available yet. Use your email instead.",
};

// "Continue with Google" looks like the form's button, but it's a link: the browser leaves for Google
const googleLinkClasses = [
  buttonStyles.button,
  buttonStyles['button--outline'],
  buttonStyles['button--lg'],
  buttonStyles['button--full-width'],
].join(' ');

interface LoginFormProps {
  callbackUrl?: string;
  error?: string;
  /** The sign-up page or the sign-in page; the same form either way */
  mode?: 'signin' | 'signup';
  /** Sign-ups are open (signupsOpen(), read on the server): anyone may make an account, not only invited addresses */
  open?: boolean;
  /** Sign in with an emailed link, or with the password set in Settings (/login?method=password) */
  method?: 'link' | 'password';
  /** Google sign-in is turned on in Supabase (googleSignInOn(), read on the server) */
  google?: boolean;
}

/** The sign-in page, by link or by password, still headed where the visitor was going */
function loginHref(next: string, method: 'link' | 'password') {
  const params = new URLSearchParams();
  if (method === 'password') params.set('method', 'password');
  if (next !== ROUTES.HOME) params.set('callbackUrl', next);
  const query = params.toString();
  return query ? `${ROUTES.LOGIN}?${query}` : ROUTES.LOGIN;
}

// The heading, the line under it, and the way to the other page. Accounts are made
// on the sign-up page only, so an invited newcomer is sent there too.
function copyFor(mode: 'signin' | 'signup', open: boolean, byPassword: boolean, google: boolean) {
  const orGoogle = google ? ', or use Google' : '';
  if (mode === 'signup') {
    return {
      heading: 'Create your Auditely account',
      lead: open
        ? `Free, with ${countOf('search', PLANS.free.limits.search ?? 0)} and ${countOf('audit', PLANS.free.limits.audit ?? 0)} a month. We'll email you a code to confirm your address${orGoogle}.`
        : INVITE_ONLY,
      other: { prompt: 'Already have an account?', label: 'Sign in', path: ROUTES.LOGIN },
    };
  }
  if (!open) {
    return {
      heading: 'Sign in to Auditely',
      lead: 'Use the email you were invited with.',
      other: { prompt: 'Invited to Auditely?', label: 'Create your account', path: ROUTES.SIGNUP },
    };
  }
  return {
    heading: 'Sign in to Auditely',
    lead: byPassword ? `Sign in with your email and password${orGoogle}.` : `We'll email you a sign-in link${orGoogle}.`,
    other: { prompt: 'New to Auditely?', label: 'Create an account', path: ROUTES.SIGNUP },
  };
}

export function LoginForm({ callbackUrl, error, mode = 'signin', open = false, method = 'link', google = true }: LoginFormProps) {
  const [sentTo, setSentTo] = useState<string | null>(null);
  // Waiting for the code Supabase emailed, to confirm the address
  const [pending, setPending] = useState<{ email: string; password: string; notice?: string } | null>(null);
  const next = safeCallbackUrl(callbackUrl);
  // A new account starts with an email and a password, confirmed by an emailed code
  const signingUp = mode === 'signup';
  const byPassword = !signingUp && method === 'password';
  const copy = copyFor(mode, open, byPassword, google);
  // Where the visitor was headed comes along to the other page
  const otherHref = copy.other && (next === ROUTES.HOME ? copy.other.path : `${copy.other.path}?callbackUrl=${encodeURIComponent(next)}`);
  // Own keys only: ?error=__proto__ would otherwise find Object.prototype and crash the form
  const signInError = error && Object.hasOwn(SIGN_IN_ERRORS, error) ? SIGN_IN_ERRORS[error] : undefined;

  const formik = useFormik<PasswordSignInFormValues>({
    initialValues: {
      email: '',
      password: '',
    },
    initialErrors: signInError ? { email: signInError } : {},
    initialTouched: signInError ? { email: true } : {},
    validationSchema: signingUp ? signupSchema : byPassword ? passwordSignInSchema : emailLinkSchema,
    onSubmit: async (values, { setSubmitting, setErrors }) => {
      const email = values.email.trim();
      if (signingUp) return signUp(email, values.password, setErrors, setSubmitting);
      if (byPassword) return signInWithPassword(email, values.password, setErrors, setSubmitting);
      try {
        const res = await fetch(API_ROUTES.AUTH, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, callbackUrl: next }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setErrors({ email: data.error ?? "Couldn't send the link. Try again in a minute." });
          return;
        }
        setSentTo(email);
      } catch {
        setErrors({ email: "Couldn't send the link. Check your connection and try again." });
      } finally {
        setSubmitting(false);
      }
    },
  });

  type SetErrors = (errors: { email?: string; password?: string }) => void;

  // The code is on its way (the next step asks for it), or Supabase signed the account straight in
  async function signUp(email: string, password: string, setErrors: SetErrors, setSubmitting: (busy: boolean) => void) {
    const answer = await requestSignup(email, password, next);
    if (!answer.ok) {
      setErrors(answer.field === 'password' ? { password: answer.error } : { email: answer.error });
      setSubmitting(false);
      return;
    }
    if ('next' in answer) return window.location.assign(answer.next);
    setPending({ email, password });
    setSubmitting(false);
  }

  // An account made but never confirmed gets a new code, and the step that asks for it
  async function askForCode(email: string, password: string) {
    const resent = await resendCode(email, next);
    setPending({
      email,
      password,
      notice: resent.ok
        ? `Your email isn't confirmed yet. We sent a new code to ${email}.`
        : `Your email isn't confirmed yet. Enter the code we emailed you, or send yourself a new one.`,
    });
  }

  // Signed in: a full page load, so the server reads the new session cookies
  async function signInWithPassword(
    email: string,
    password: string,
    setErrors: SetErrors,
    setSubmitting: (busy: boolean) => void
  ) {
    try {
      const res = await fetch(API_ROUTES.AUTH_PASSWORD, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, callbackUrl: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && data.confirm === true) {
        await askForCode(email, password);
        setSubmitting(false);
        return;
      }
      if (!res.ok) {
        setErrors({ password: data.error ?? "Couldn't sign you in. Try again in a minute." });
        setSubmitting(false);
        return;
      }
      window.location.assign(typeof data.next === 'string' ? data.next : ROUTES.HOME);
    } catch {
      setErrors({ password: "Couldn't sign you in. Check your connection and try again." });
      setSubmitting(false);
    }
  }

  const heading = (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
        {copy.heading}
      </h1>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{copy.lead}</p>
    </div>
  );

  if (pending) {
    return (
      <ConfirmCodeForm
        email={pending.email}
        password={pending.password}
        next={next}
        notice={pending.notice}
        onBack={() => setPending(null)}
      />
    );
  }

  if (sentTo) {
    return (
      <div className="space-y-6">
        {heading}
        <p className="text-sm text-[var(--color-text-primary)]" role="status">
          Check your inbox: we sent a sign-in link to {sentTo}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {heading}
      <form onSubmit={formik.handleSubmit} className="space-y-6">
        <Input
          id="email"
          name="email"
          type="email"
          label="Email"
          placeholder="you@company.com"
          autoComplete="email"
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          value={formik.values.email}
          error={formik.touched.email && formik.errors.email ? formik.errors.email : undefined}
          required
        />

        {(byPassword || signingUp) && (
          <Input
            id="password"
            name="password"
            type="password"
            label="Password"
            autoComplete={signingUp ? 'new-password' : 'current-password'}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            value={formik.values.password}
            error={formik.touched.password && formik.errors.password ? formik.errors.password : undefined}
            helpText={
              signingUp
                ? `At least ${PASSWORD_MIN} characters.`
                : 'Forgot your password? Email yourself a sign-in link, then set a new one in Settings.'
            }
            required
          />
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          isLoading={formik.isSubmitting}
        >
          {signingUp ? 'Create account' : byPassword ? 'Sign in' : 'Email me a link'}
        </Button>
      </form>

      {mode === 'signin' && (
        <p className="text-center text-sm">
          <Link
            href={loginHref(next, byPassword ? 'link' : 'password')}
            className="font-medium text-[var(--color-text-primary)] underline underline-offset-2"
          >
            {byPassword ? 'Sign in with an emailed link instead' : 'Sign in with a password instead'}
          </Link>
        </p>
      )}

      {/* A full page load, not a client-side navigation: the route sends the browser on to Google */}
      {google && (
        <a href={`${ROUTES.AUTH_GOOGLE}?next=${encodeURIComponent(next)}`} className={googleLinkClasses}>
          Continue with Google
        </a>
      )}

      <ConsentLine />

      {copy.other && otherHref && (
        <p className="text-sm text-[var(--color-text-secondary)]">
          {copy.other.prompt}{' '}
          <Link href={otherHref} className="font-medium text-[var(--color-text-primary)] underline underline-offset-2">
            {copy.other.label}
          </Link>
        </p>
      )}
    </div>
  );
}
