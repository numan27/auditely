// app/_shared/lib/config/legal.ts

// Who runs Auditely, for the Terms, the Privacy Policy and the footer. The owner
// fills these in before sign-ups open; docs/launch-setup.md checks legalReady().

export const LEGAL = {
  operator: '[LEGAL NAME]',
  contactEmail: '[CONTACT EMAIL]',
  mailingAddress: '[MAILING ADDRESS]',
  governingState: '[STATE]',
  effectiveDate: '[EFFECTIVE DATE]',
} as const;

export type LegalDetails = { [K in keyof typeof LEGAL]: string };

/** False while any detail is still a [PLACEHOLDER] */
export function legalReady(legal: LegalDetails = LEGAL): boolean {
  return Object.values(legal).every((value) => value.trim() !== '' && !value.startsWith('['));
}
