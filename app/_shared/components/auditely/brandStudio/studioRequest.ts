// app/_shared/components/auditely/brandStudio/studioRequest.ts

// Saving the studio's draft: the saved brand comes back as the server stored
// it (a website with its https://, a colour in lower case), or the server's own
// reason, with the field it names when it names one.

import { draftFrom, studioPayload, type StudioDraft } from '@/app/_shared/components/auditely/brandStudio/studioState';
import { readDesign } from '@/app/_shared/lib/brand/brandDesign';
import type { ProfileFields } from '@/app/_shared/lib/brand/profileInput';
import { STUDIO_NOT_SAVED } from '@/app/_shared/lib/brand/studioInput';
import { API_ROUTES } from '@/app/_shared/lib/config/routes';

const UNREACHABLE = "Couldn't reach Auditely. Check your connection and try again.";

export type StudioSaved = { ok: true; draft: StudioDraft } | { ok: false; error: string; field?: string };

export async function saveStudio(draft: StudioDraft): Promise<StudioSaved> {
  let res: Response;
  try {
    res = await fetch(API_ROUTES.STUDIO, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(studioPayload(draft)),
    });
  } catch {
    return { ok: false, error: UNREACHABLE };
  }
  const answer = (await res.json().catch(() => null)) as { profile?: ProfileFields; design?: unknown; error?: unknown; field?: unknown } | null;
  if (res.ok && answer?.profile) return { ok: true, draft: draftFrom(answer.profile, readDesign(answer.design)) };
  return {
    ok: false,
    error: typeof answer?.error === 'string' ? answer.error : STUDIO_NOT_SAVED,
    field: typeof answer?.field === 'string' ? answer.field : undefined,
  };
}
