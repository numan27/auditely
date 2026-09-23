'use client';

import { useFormik } from 'formik';
import { adminLoginSchema, type AdminLoginFormValues } from '@/app/_shared/lib/validations/schemas';
import { Input } from '@/app/_shared/components/ui/input/input';
import { Button } from '@/app/_shared/components/ui/button/button';
import { API_ROUTES, safeCallbackUrl } from '@/app/_shared/lib/config/routes';
import { useRouter } from 'next/navigation';

interface LoginFormProps {
  callbackUrl?: string;
}

export function LoginForm({ callbackUrl }: LoginFormProps) {
  const router = useRouter();

  const formik = useFormik<AdminLoginFormValues>({
    initialValues: {
      password: '',
    },
    validationSchema: adminLoginSchema,
    onSubmit: async (values, { setSubmitting, setErrors }) => {
      try {
        const res = await fetch(API_ROUTES.AUTH, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: values.password }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setErrors({ password: data.error ?? 'Invalid password' });
          return;
        }
        router.replace(safeCallbackUrl(callbackUrl));
        router.refresh();
      } catch {
        setErrors({ password: 'Something went wrong. Please try again.' });
      } finally {
        setSubmitting(false);
      }
    },
  });

  return (
    <form onSubmit={formik.handleSubmit} className="space-y-6">
      <Input
        id="password"
        name="password"
        type="password"
        label="Password"
        placeholder="Enter the admin password"
        autoComplete="current-password"
        onChange={formik.handleChange}
        onBlur={formik.handleBlur}
        value={formik.values.password}
        error={formik.touched.password && formik.errors.password ? formik.errors.password : undefined}
        required
      />

      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        isLoading={formik.isSubmitting}
      >
        Sign in
      </Button>
    </form>
  );
}
