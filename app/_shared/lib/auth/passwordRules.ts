// app/_shared/lib/auth/passwordRules.ts

// What a password must be, for a new account and in Settings alike, and the code a
// new account confirms its email with. Client-safe: no server imports.

export const PASSWORD_MIN = 8;
// Supabase hashes with bcrypt, which reads only the first 72 bytes
export const PASSWORD_MAX_BYTES = 72;

/** What's wrong with a password, or null when it will do */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) return `Use ${PASSWORD_MAX_BYTES} characters or fewer.`;
  return null;
}

// Supabase's "Confirm signup" email sends it as {{ .Token }}; its length is set in
// Supabase too (docs/accounts-setup.md, step 3)
export const CODE_LENGTH = 6;

/** The code as typed or pasted, spaces taken out, or null unless it's CODE_LENGTH digits */
export function readCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const code = value.replace(/\s/g, '');
  return new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code) ? code : null;
}
