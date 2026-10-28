// app/_shared/components/providers/ProfileCardProvider.tsx

'use client';

import type { ReactNode } from 'react';
import { ProfileCardContext, type ProfileCard } from '@/app/_shared/lib/hooks/useProfileCard';

interface ProfileCardProviderProps {
  /** The signed-in account's name, company, email and logo, read on the server */
  card: ProfileCard | null;
  children: ReactNode;
}

/** Tells the header's profile menu who is signed in; a Settings save refreshes it */
export function ProfileCardProvider({ card, children }: ProfileCardProviderProps) {
  return <ProfileCardContext.Provider value={card}>{children}</ProfileCardContext.Provider>;
}
