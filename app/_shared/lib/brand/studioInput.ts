// app/_shared/lib/brand/studioInput.ts

// What the Brand studio sends: the profile (profileInput.ts) and the design
// (brandDesign.ts). A save checks both and names what's wrong; a preview, sent
// while the user is still typing, leaves out a field that isn't finished yet.
// Client-safe.

import { parseDesignInput, readDesign, type BrandDesign } from '@/app/_shared/lib/brand/brandDesign';
import { parseProfileInput, type ProfileFields } from '@/app/_shared/lib/brand/profileInput';

export type StudioInputResult =
  | { ok: true; profile: ProfileFields; design: BrandDesign }
  | { ok: false; field: string; error: string };

export const STUDIO_NOT_SAVED = "Your brand wasn't saved. Try again.";

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

export function parseStudioInput(body: unknown): StudioInputResult {
  const input = asRecord(body);
  // The whole profile is replaced, so a body without one is refused rather than saved as blank
  if (!input || !asRecord(input.profile)) return { ok: false, field: 'profile', error: STUDIO_NOT_SAVED };
  const profile = parseProfileInput(input.profile);
  if (!profile.ok) return profile;
  const design = parseDesignInput(input.design);
  if (!design.ok) return design;
  return { ok: true, profile: profile.profile, design: design.design };
}

/** The draft as the preview draws it: each field that wouldn't save yet is left blank */
export function previewInput(body: unknown): { profile: ProfileFields; design: BrandDesign } {
  const input = asRecord(body) ?? {};
  const draft: Record<string, unknown> = { ...asRecord(input.profile) };
  // A refused field is blanked and the rest tried again; a blank field is never refused
  let parsed = parseProfileInput(draft);
  while (!parsed.ok) {
    draft[parsed.field] = null;
    parsed = parseProfileInput(draft);
  }
  return { profile: parsed.profile, design: readDesign(input.design) };
}
