// app/_shared/lib/settings/connections.ts

// What an account has connected, as the browser may see it: the brand its emails
// are signed with, the address it sends from and whether HubSpot is set up. The
// owner with nothing saved falls back to the Vercel mailbox and HUBSPOT_TOKEN, as
// senders.ts does; nobody else does. Server-only.

import type { Account } from '@/app/_shared/lib/auth/account';
import { BrandUnavailable, brandFor } from '@/app/_shared/lib/brand/brand';
import { resolveBrand, type Brand } from '@/app/_shared/lib/brand/brandRules';
import { emailSetupProblem } from '@/app/_shared/lib/email/mailer';
import type { Connections } from '@/app/_shared/lib/hooks/useConnections';
import { savedConnections, type SecretKind } from '@/app/_shared/lib/secrets/userSecrets';
import { planFor } from '@/app/_shared/lib/usage/plans';

/** The address in FROM_EMAIL, which may be written "Name <address>" */
function fromAddress(from: string): string {
  return (from.match(/<([^>]+)>/)?.[1] ?? from).trim();
}

async function brandOf(account: Account): Promise<Brand> {
  try {
    return await brandFor(account.id);
  } catch (err) {
    if (!(err instanceof BrandUnavailable)) throw err;
    console.error('[settings] Read the connections without the profile:', err.message);
    // The owner's emails stay DevArtVentures'; anyone else's read as unbranded until it loads
    return resolveBrand({ profile: null, isOwner: account.isOwner, plan: account.isOwner ? 'owner' : 'free' });
  }
}

async function savedOf(account: Account): Promise<Partial<Record<SecretKind, string | null>>> {
  try {
    return await savedConnections(account.id);
  } catch (err) {
    // Every page of the app reads this: a slow table mustn't stop them opening
    console.error('[settings] Read the connections as nothing saved:', err instanceof Error ? err.message : err);
    return {};
  }
}

export async function connectionsFor(account: Account): Promise<Connections> {
  const [brand, saved] = await Promise.all([brandOf(account), savedOf(account)]);
  const from = process.env.FROM_EMAIL;
  const envMailbox = account.isOwner && from && !emailSetupProblem() ? fromAddress(from) : null;
  const envHubSpot = account.isOwner && !!process.env.HUBSPOT_TOKEN?.trim();

  return {
    plan: planFor(account).id,
    branded: brand.kind !== 'auditely',
    sender: { name: brand.name, signOff: brand.writer.signOff },
    mailbox:
      'smtp' in saved
        ? { address: saved.smtp ?? '', source: 'saved' }
        : envMailbox
          ? { address: envMailbox, source: 'env' }
          : null,
    hubspot: 'hubspot' in saved ? { source: 'saved' } : envHubSpot ? { source: 'env' } : null,
  };
}
