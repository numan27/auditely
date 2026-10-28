// app/_shared/lib/settings/profileCard.ts

// Who the header's profile menu says is signed in: the name and company saved in
// Settings, the account's email, and its logo by an address of its own, which
// changes with each save so the browser can keep the image until then. The logo's
// data never rides along with every page. A profile that can't be read leaves
// just the email. Server-only.

import type { Account } from '@/app/_shared/lib/auth/account';
import { API_ROUTES } from '@/app/_shared/lib/config/routes';
import type { Db } from '@/app/_shared/lib/supabase/client';

export interface ProfileCard {
  name: string | null;
  company: string | null;
  email: string;
  /** Where the logo image is, or null without one */
  logo: string | null;
}

interface CardRow {
  display_name: string | null;
  company: string | null;
  updated_at: string | null;
}

/** The signed-in account's card, read as the user */
export async function profileCardFor(db: Db, account: Pick<Account, 'id' | 'email'>): Promise<ProfileCard> {
  const blank: ProfileCard = { name: null, company: null, email: account.email, logo: null };
  const [row, logos] = await Promise.all([
    db.from('profiles').select('display_name, company, updated_at').eq('id', account.id).maybeSingle(),
    // Whether there is a logo, without reading it
    db.from('profiles').select('id', { count: 'exact', head: true }).eq('id', account.id).not('logo_data_url', 'is', null),
  ]);
  if (row.error) {
    console.error('[settings] Read the profile menu without the profile:', row.error.message);
    return blank;
  }
  if (!row.data) return blank;

  const { display_name, company, updated_at } = row.data as CardRow;
  const hasLogo = !logos.error && (logos.count ?? 0) > 0;
  return {
    name: display_name ?? null,
    company: company ?? null,
    email: account.email,
    logo: hasLogo ? `${API_ROUTES.SETTINGS_PROFILE_LOGO}?v=${encodeURIComponent(updated_at ?? '')}` : null,
  };
}
