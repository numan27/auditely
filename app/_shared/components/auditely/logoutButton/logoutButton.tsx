// app/_shared/components/auditely/logoutButton/logoutButton.tsx

'use client';

import { useLogout } from '@/app/_shared/lib/hooks/useLogout';

export function LogoutButton() {
  const logout = useLogout();

  return (
    <button
      type="button"
      onClick={logout}
      className="cursor-pointer whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
    >
      Log out
    </button>
  );
}
