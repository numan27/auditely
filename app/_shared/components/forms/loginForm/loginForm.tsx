'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useFormik } from 'formik';
import { emailLinkSchema, type EmailLinkFormValues } from '@/app/_shared/lib/validations/schemas';
import { Input } from '@/app/_shared/components/ui/input/input';
import { Button } from '@/app/_shared/components/ui/button/button';
import buttonStyles from '@/app/_shared/components/ui/button/button.module.scss';
import { API_ROUTES, ROUTES, safeCallbackUrl } from '@/app/_shared/lib/config/routes';
import { PLANS } from '@/app/_shared/lib/usage/plans';
import { ConsentLine } from '@/app/_shared/components/forms/consentLine/consentLine';

// What went wrong on the way back from a sign-in (/auth/callback, /auth/google), by ?error=
const SIGN_IN_ERRORS: Record<string, string> = {
  link: 'That sign-in link has expired or was already used. Send yourself a new one.',
  closed: 'Auditely is invite-only for now. Use the email you were invited with.',
  google: "Couldn't reach Google. Try again, or use your email.",
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
  /** Sign-ups are open (signupsOpen(), read on the server): anyone may make an account */
  open?: boolean;
}

// The heading, the line under it, and the way to the other page
function copyFor(mode: 'signin' | 'signup', open: boolean) {
  if (mode === 'signup') {
    return {
      heading: 'Create your Auditely account',
      lead: `Free, with ${PLANS.free.limits.audit} audits a month. We'll email you a link, or use Google.`,
      other: { prompt: 'Already have an account?', label: 'Sign in', path: ROUTES.LOGIN },
    };
  }
  if (!open) return { heading: 'Sign in to Auditely', lead: 'Use the email you were invited with.', other: null };
  return {
    heading: 'Sign in to Auditely',
    lead: "We'll email you a sign-in link, or use Google.",
    other: { prompt: 'New to Auditely?', label: 'Create an account', path: ROUTES.SIGNUP },
  };
}

export function LoginForm({ callbackUrl, error, mode = 'signin', open = false }: LoginFormProps) {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const next = safeCallbackUrl(callbackUrl);
  const copy = copyFor(mode, open);
  // Where the visitor was headed comes along to the other page
  const otherHref = copy.other && (next === ROUTES.HOME ? copy.other.path : `${copy.other.path}?callbackUrl=${encodeURIComponent(next)}`);
  // Own keys only: ?error=__proto__ would otherwise find Object.prototype and crash the form
  const signInError = error && Object.hasOwn(SIGN_IN_ERRORS, error) ? SIGN_IN_ERRORS[error] : undefined;

  const formik = useFormik<EmailLinkFormValues>({
    initialValues: {
      email: '',
    },
    initialErrors: signInError ? { email: signInError } : {},
    initialTouched: signInError ? { email: true } : {},
    validationSchema: emailLinkSchema,
    onSubmit: async (values, { setSubmitting, setErrors }) => {
      const email = values.email.trim();
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

  const heading = (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
        {copy.heading}
      </h1>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{copy.lead}</p>
    </div>
  );

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

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          isLoading={formik.isSubmitting}
        >
          Email me a link
        </Button>
      </form>

      {/* A full page load, not a client-side navigation: the route sends the browser on to Google */}
      <a href={`${ROUTES.AUTH_GOOGLE}?next=${encodeURIComponent(next)}`} className={googleLinkClasses}>
        Continue with Google
      </a>

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
