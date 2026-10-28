// app/_shared/lib/hooks/useProfileCard.ts

'use client';

import { createContext, useContext } from 'react';
import type { ProfileCard } from '@/app/_shared/lib/settings/profileCard';

export type { ProfileCard };

export const ProfileCardContext = createContext<ProfileCard | null>(null);

/** Who the header's profile menu shows, or null outside the signed-in app (the public demo) */
export const useProfileCard = (): ProfileCard | null => useContext(ProfileCardContext);
