// app/_shared/components/auditely/logoutButton/logoutButton.tsx

'use client';

import { useLogout } from '@/app/_shared/lib/hooks/useLogout';

export function LogoutButton() {
  const logout = useLogout();

  return (
    <button
      onClick={logout}
      className="text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
    >
      Log out
    </button>
  );
}
