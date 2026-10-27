// app/_shared/lib/secrets/secrets.ts

// Encrypts what an account saves for the server to use on its behalf (a mailbox
// password, a HubSpot token) before it reaches the database. AES-256-GCM with
// SECRETS_KEY; the additional data names the account and the kind, so a row
// copied to another account, or into another kind, can't be read. Server-only.

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** SECRETS_KEY isn't set (or isn't 32 bytes of base64): nothing can be saved or read */
export class SecretsKeyMissing extends Error {
  constructor() {
    super('SECRETS_KEY is not set');
    this.name = 'SecretsKeyMissing';
  }
}

/** A token that doesn't open under this key, account and kind */
export class SecretUnreadable extends Error {
  constructor() {
    super('The saved secret could not be read');
    this.name = 'SecretUnreadable';
  }
}

/** The 32-byte key from SECRETS_KEY (base64), or null when there isn't a valid one */
export function secretsKey(env: NodeJS.ProcessEnv = process.env): Buffer | null {
  const value = env.SECRETS_KEY?.trim();
  if (!value || !BASE64.test(value)) return null;
  const key = Buffer.from(value, 'base64');
  return key.length === KEY_BYTES ? key : null;
}

/** `v1.<iv>.<tag>.<ciphertext>`, each part base64url */
export function encryptSecret(plain: string, aad: string, key: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), ciphertext].map((part) => (typeof part === 'string' ? part : part.toString('base64url'))).join('.');
}

/** The plain text, or SecretUnreadable for a token from another key, account or kind, or one that was changed */
export function decryptSecret(token: string, aad: string, key: Buffer): string {
  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== VERSION) throw new SecretUnreadable();
  const [iv, tag, ciphertext] = parts.slice(1).map((part) => Buffer.from(part, 'base64url'));
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) throw new SecretUnreadable();
  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
    decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    throw new SecretUnreadable();
  }
}
