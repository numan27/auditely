// app/_shared/lib/demo/unbrand.ts

// The public demo reads as anyone's account, not the owner's: the sample emails
// were written for DevArtVentures, so their sign-off becomes the placeholder an
// account without a brand of its own gets. Used by the capture script, so no
// imports: it loads with plain `node`.

/** The sign-off of an account without a brand (AUDITELY_WRITER in brandRules.ts) */
export const DEMO_SIGN_OFF = '[Your name]';

// "The DevArtVentures team" or "Numan, DevArtVentures", at the very end, on its own line or not
const OWNER_SIGN_OFF = /(\s)(?:the\s+dev\s*art\s*ventures\s+team|numan,?\s+dev\s*art\s*ventures)\s*$/i;

/** An email with the owner's sign-off swapped for DEMO_SIGN_OFF; anyone else's as it was */
export function unbrandSignOff(email: string): string {
  return email.replace(OWNER_SIGN_OFF, `$1${DEMO_SIGN_OFF}`);
}
