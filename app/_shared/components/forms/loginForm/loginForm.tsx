'use client';

import { useFormik } from 'formik';
import { loginSchema, type LoginFormValues } from '@/app/_shared/lib/validations/schemas';
import { Input } from '@/app/_shared/components/ui/input/input';
import { Button } from '@/app/_shared/components/ui/button/button';
import { useAuth } from '@/app/_shared/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface LoginFormProps {
  callbackUrl?: string;
}

export function LoginForm({ callbackUrl = '/dashboard' }: LoginFormProps) {
  const { login } = useAuth();
  const router = useRouter();

  const formik = useFormik<LoginFormValues>({
    initialValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
    validationSchema: loginSchema,
    onSubmit: async (values, { setSubmitting, setErrors }) => {
      try {
        // Mock login - replace with actual API call
        const mockToken = 'mock-token-' + Math.random().toString(36).substring(7);
        const mockRefreshToken = 'mock-refresh-' + Math.random().toString(36).substring(7);

        await login(mockToken, mockRefreshToken, {
          id: '1',
          email: values.email,
          name: 'John Doe',
        });

        router.push(callbackUrl);
      } catch (error) {
        setErrors({
          email: 'Invalid email or password',
          password: 'Invalid email or password',
        });
      } finally {
        setSubmitting(false);
      }
    },
  });

  return (
    <form onSubmit={formik.handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <Input
          id="email"
          name="email"
          type="email"
          label="Email"
          placeholder="Enter your email"
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          value={formik.values.email}
          error={formik.touched.email && formik.errors.email ? formik.errors.email : undefined}
          required
        />

        <Input
          id="password"
          name="password"
          type="password"
          label="Password"
          placeholder="Enter your password"
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          value={formik.values.password}
          error={formik.touched.password && formik.errors.password ? formik.errors.password : undefined}
          required
        />
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            name="rememberMe"
            checked={formik.values.rememberMe}
            onChange={formik.handleChange}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-[var(--color-text-secondary)]">Remember me</span>
        </label>

        <Link
          href="/forgot-password"
          className="text-sm text-[var(--color-primary-600)] hover:text-[var(--color-primary-700)]"
        >
          Forgot password?
        </Link>
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        isLoading={formik.isSubmitting}
      >
        Sign in
      </Button>

      <p className="text-center text-sm text-[var(--color-text-secondary)]">
        Don&apos;t have an account?{' '}
        <Link
          href="/register"
          className="text-[var(--color-primary-600)] hover:text-[var(--color-primary-700)] font-medium"
        >
          Sign up
        </Link>
      </p>
    </form>
  );
}
