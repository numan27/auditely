import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { randomBytes } from 'node:crypto';

// Fake service client over one user_secrets table, keyed by user and kind
const db = vi.hoisted(() => {
  type Row = { user_id: string; kind: string; ciphertext: string; label: string | null };
  const state = { rows: [] as Row[], error: null as { code: string; message: string } | null, selects: [] as string[], upserts: [] as { row: Row; options: unknown }[] };
  const from = (table: string) => {
    if (table !== 'user_secrets') throw new Error(`unexpected table ${table}`);
    const filters: Record<string, string> = {};
    const matching = () => state.rows.filter((r) => Object.entries(filters).every(([k, v]) => r[k as keyof Row] === v));
    const chain = {
      select: (columns: string) => {
        state.selects.push(columns);
        return chain;
      },
      eq: (column: string, value: string) => {
        filters[column] = value;
        return chain;
      },
      maybeSingle: async () => (state.error ? { data: null, error: state.error } : { data: matching()[0] ?? null, error: null }),
      then: (resolve: (v: unknown) => void) => resolve(state.error ? { data: null, error: state.error } : { data: matching(), error: null }),
      upsert: async (row: Row, options: unknown) => {
        if (state.error) return { error: state.error };
        state.upserts.push({ row, options });
        state.rows = state.rows.filter((r) => !(r.user_id === row.user_id && r.kind === row.kind)).concat(row);
        return { error: null };
      },
      delete: () => {
        const del = {
          eq: (column: string, value: string) => {
            filters[column] = value;
            return del;
          },
          then: (resolve: (v: unknown) => void) => {
            if (state.error) return resolve({ error: state.error });
            const gone = new Set(matching());
            state.rows = state.rows.filter((r) => !gone.has(r));
            resolve({ error: null });
          },
        };
        return del;
      },
    };
    return chain;
  };
  return { state, from };
});
vi.mock('@/app/_shared/lib/supabase/client', () => ({ serviceDb: { from: db.from } }));

const { SettingsNotMigrated, deleteSecret, readSecret, saveSecret, savedConnections } = await import('@/app/_shared/lib/secrets/userSecrets');
const { SecretUnreadable, SecretsKeyMissing } = await import('@/app/_shared/lib/secrets/secrets');

const MAILBOX = { host: 'smtp.gmail.com', port: 465, user: 'sam@acme.studio', pass: 'app-pass', fromEmail: 'sam@acme.studio' };

beforeEach(() => {
  vi.stubEnv('SECRETS_KEY', randomBytes(32).toString('base64'));
  db.state.rows = [];
  db.state.error = null;
  db.state.selects = [];
  db.state.upserts = [];
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('saved secrets', () => {
  it('stores only ciphertext, and lists connections without it', async () => {
    await saveSecret('u1', 'smtp', MAILBOX, 'sam@acme.studio');
    const [{ row, options }] = db.state.upserts;
    expect(row).toMatchObject({ user_id: 'u1', kind: 'smtp', label: 'sam@acme.studio' });
    expect(row.ciphertext).toMatch(/^v1\./);
    expect(row.ciphertext).not.toContain('app-pass');
    expect(options).toEqual({ onConflict: 'user_id,kind' });
    expect(await readSecret('u1', 'smtp')).toEqual(MAILBOX);

    expect(await savedConnections('u1')).toEqual({ smtp: 'sam@acme.studio' });
    expect(db.state.selects.at(-1)).toBe('kind, label');
  });

  it('replaces a saved secret, and forgets it when deleted', async () => {
    await saveSecret('u1', 'hubspot', 'pat-old', null);
    await saveSecret('u1', 'hubspot', 'pat-new', null);
    expect(await readSecret('u1', 'hubspot')).toBe('pat-new');
    await deleteSecret('u1', 'hubspot');
    expect(await readSecret('u1', 'hubspot')).toBeNull();
    expect(await savedConnections('u1')).toEqual({});
  });

  it('reads a row copied from another account as unreadable', async () => {
    await saveSecret('u1', 'smtp', MAILBOX, 'sam@acme.studio');
    db.state.rows.push({ ...db.state.rows[0], user_id: 'u2' });
    await expect(readSecret('u2', 'smtp')).rejects.toThrow(SecretUnreadable);
  });

  it('reads a row under another key as unreadable', async () => {
    await saveSecret('u1', 'smtp', MAILBOX, 'sam@acme.studio');
    vi.stubEnv('SECRETS_KEY', randomBytes(32).toString('base64'));
    await expect(readSecret('u1', 'smtp')).rejects.toThrow(SecretUnreadable);
  });

  it('saves nothing without a key, and reads nothing saved without one', async () => {
    vi.stubEnv('SECRETS_KEY', '');
    await expect(saveSecret('u1', 'smtp', MAILBOX, 'sam@acme.studio')).rejects.toThrow(SecretsKeyMissing);
    expect(db.state.upserts).toEqual([]);
    // Nothing saved: nothing to read, so the owner's own mailbox still works without a key
    expect(await readSecret('u1', 'smtp')).toBeNull();
    db.state.rows.push({ user_id: 'u1', kind: 'smtp', ciphertext: 'v1.a.b.c', label: null });
    await expect(readSecret('u1', 'smtp')).rejects.toThrow(SecretsKeyMissing);
  });

  it('reads a missing table as nothing saved', async () => {
    db.state.error = { code: 'PGRST205', message: "Could not find the table 'public.user_secrets'" };
    expect(await savedConnections('u1')).toEqual({});
    await expect(readSecret('u1', 'smtp')).rejects.toThrow(SettingsNotMigrated);
    await expect(saveSecret('u1', 'smtp', MAILBOX, null)).rejects.toThrow(SettingsNotMigrated);
    db.state.error = { code: '42P01', message: 'relation "user_secrets" does not exist' };
    await expect(deleteSecret('u1', 'smtp')).rejects.toThrow(SettingsNotMigrated);
  });

  it('passes on any other database error', async () => {
    db.state.error = { code: '57014', message: 'canceling statement due to statement timeout' };
    await expect(savedConnections('u1')).rejects.toThrow(/statement timeout/);
    await expect(readSecret('u1', 'smtp')).rejects.toThrow(/statement timeout/);
  });
});
