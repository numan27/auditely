// app/_shared/components/auditely/logoutButton/logoutButton.tsx

'use client';

import { useAccount } from '@/app/_shared/lib/hooks/useAccount';
import { useLogout } from '@/app/_shared/lib/hooks/useLogout';

export function LogoutButton() {
  const logout = useLogout();
  const account = useAccount();

  return (
    <button
      type="button"
      onClick={logout}
      title={account ? `Signed in as ${account.email}` : undefined}
      className="cursor-pointer whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
    >
      Log out
    </button>
  );
}
