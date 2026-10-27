import { describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { SecretUnreadable, decryptSecret, encryptSecret, secretsKey } from '@/app/_shared/lib/secrets/secrets';

const key = randomBytes(32);
const other = randomBytes(32);

const env = (vars: Record<string, string>) => vars as unknown as NodeJS.ProcessEnv;

// One character of the ciphertext swapped for another
const tamper = (token: string) => {
  const at = token.length - 2;
  return token.slice(0, at) + (token[at] === 'A' ? 'B' : 'A') + token.slice(at + 1);
};

describe('encryptSecret and decryptSecret', () => {
  it('round-trips, with a fresh IV each time', () => {
    const a = encryptSecret('app-pass', 'u1:smtp', key);
    expect(a).toMatch(/^v1\.[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(encryptSecret('app-pass', 'u1:smtp', key)).not.toBe(a);
    expect(decryptSecret(a, 'u1:smtp', key)).toBe('app-pass');
    expect(a).not.toContain('app-pass');
  });

  it('fails closed for another account, another kind, another key or a changed byte', () => {
    const a = encryptSecret('app-pass', 'u1:smtp', key);
    const cases = [
      [a, 'u2:smtp', key],
      [a, 'u1:hubspot', key],
      [a, 'u1:smtp', other],
      [tamper(a), 'u1:smtp', key],
      ['garbage', 'u1:smtp', key],
      [a.replace(/^v1/, 'v2'), 'u1:smtp', key],
    ] as const;
    for (const [token, aad, k] of cases) expect(() => decryptSecret(token, aad, k)).toThrow(SecretUnreadable);
  });
});

describe('secretsKey', () => {
  it('takes only a 32-byte base64 key', () => {
    expect(secretsKey(env({ SECRETS_KEY: key.toString('base64') }))?.length).toBe(32);
    expect(secretsKey(env({ SECRETS_KEY: ` ${key.toString('base64')}\n` }))?.length).toBe(32);
    expect(secretsKey(env({ SECRETS_KEY: 'short' }))).toBeNull();
    expect(secretsKey(env({ SECRETS_KEY: randomBytes(16).toString('base64') }))).toBeNull();
    expect(secretsKey(env({}))).toBeNull();
  });
});
