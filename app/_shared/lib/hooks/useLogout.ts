'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { API_ROUTES, DEFAULT_LOGOUT_REDIRECT } from '@/app/_shared/lib/config/routes';

// Signs out server-side (clearing the Supabase session cookies), then returns to the login page
export function useLogout() {
  const router = useRouter();

  return useCallback(async () => {
    try {
      await fetch(API_ROUTES.AUTH, { method: 'DELETE' });
    } finally {
      router.replace(DEFAULT_LOGOUT_REDIRECT);
      router.refresh();
    }
  }, [router]);
}
