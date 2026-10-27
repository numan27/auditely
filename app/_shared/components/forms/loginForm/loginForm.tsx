'use client';

import { useState } from 'react';
import { useFormik } from 'formik';
import { emailLinkSchema, type EmailLinkFormValues } from '@/app/_shared/lib/validations/schemas';
import { Input } from '@/app/_shared/components/ui/input/input';
import { Button } from '@/app/_shared/components/ui/button/button';
import buttonStyles from '@/app/_shared/components/ui/button/button.module.scss';
import { API_ROUTES, ROUTES, safeCallbackUrl } from '@/app/_shared/lib/config/routes';

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
}

export function LoginForm({ callbackUrl, error }: LoginFormProps) {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const next = safeCallbackUrl(callbackUrl);
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

  if (sentTo) {
    return (
      <p className="text-sm text-[var(--color-text-primary)]" role="status">
        Check your inbox: we sent a sign-in link to {sentTo}.
      </p>
    );
  }

  return (
    <div className="space-y-6">
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
    </div>
  );
}
