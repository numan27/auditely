// app/_shared/lib/secrets/userSecrets.ts

// An account's saved mailbox and HubSpot token, in user_secrets. The table has
// no policies and no grants to signed-in users, so only this module reads it,
// with the service client: a user never sees a ciphertext, even their own.
// The label (the mailbox address) is plain, so Settings can say what's
// connected without decrypting anything. Server-only.

import { serviceDb } from '@/app/_shared/lib/supabase/client';
import { SecretUnreadable, SecretsKeyMissing, decryptSecret, encryptSecret, secretsKey } from '@/app/_shared/lib/secrets/secrets';

export type SecretKind = 'smtp' | 'hubspot';

/** user_secrets doesn't exist yet: docs/migrations/2026-10-29-settings.sql hasn't run */
export class SettingsNotMigrated extends Error {
  constructor() {
    super('user_secrets is missing: run docs/migrations/2026-10-29-settings.sql');
    this.name = 'SettingsNotMigrated';
  }
}

const TABLE = 'user_secrets';
// Postgres's "no such table" and PostgREST's
const MISSING_TABLE = ['42P01', 'PGRST205'];

// Binds each ciphertext to its account and kind
const aadFor = (userId: string, kind: SecretKind) => `${userId}:${kind}`;

function keyOrThrow(): Buffer {
  const key = secretsKey();
  if (!key) throw new SecretsKeyMissing();
  return key;
}

function failed(error: { code?: string; message: string }): Error {
  return MISSING_TABLE.includes(error.code ?? '') ? new SettingsNotMigrated() : new Error(`user_secrets: ${error.message}`);
}

/** Saves (or replaces) one secret; `value` is stored as encrypted JSON */
export async function saveSecret(userId: string, kind: SecretKind, value: unknown, label: string | null): Promise<void> {
  const ciphertext = encryptSecret(JSON.stringify(value), aadFor(userId, kind), keyOrThrow());
  const { error } = await serviceDb
    .from(TABLE)
    .upsert({ user_id: userId, kind, ciphertext, label, updated_at: new Date().toISOString() }, { onConflict: 'user_id,kind' });
  if (error) throw failed(error);
}

/** The saved secret, or null when there is none. A saved one needs the key, even to say it's unreadable */
export async function readSecret<T>(userId: string, kind: SecretKind): Promise<T | null> {
  const { data, error } = await serviceDb.from(TABLE).select('ciphertext').eq('user_id', userId).eq('kind', kind).maybeSingle();
  if (error) throw failed(error);
  if (!data) return null;
  const plain = decryptSecret((data as { ciphertext: string }).ciphertext, aadFor(userId, kind), keyOrThrow());
  try {
    return JSON.parse(plain) as T;
  } catch {
    throw new SecretUnreadable();
  }
}

export async function deleteSecret(userId: string, kind: SecretKind): Promise<void> {
  const { error } = await serviceDb.from(TABLE).delete().eq('user_id', userId).eq('kind', kind);
  if (error) throw failed(error);
}

/** What's connected, by kind, with each label; never a ciphertext. Before the migration, nothing */
export async function savedConnections(userId: string): Promise<Partial<Record<SecretKind, string | null>>> {
  const { data, error } = await serviceDb.from(TABLE).select('kind, label').eq('user_id', userId);
  if (error) {
    if (MISSING_TABLE.includes(error.code ?? '')) return {};
    throw failed(error);
  }
  return Object.fromEntries(((data ?? []) as { kind: SecretKind; label: string | null }[]).map((row) => [row.kind, row.label]));
}
