// app/_shared/lib/config/directAudits.ts

// Websites entered in the "Audit a website" form are stored as businesses of
// one reserved search, so they reuse the businesses / audits / ai_reports
// tables unchanged. Saved Searches hides it; the Audit tab lists it.

export const DIRECT_AUDIT_SEARCH = { niche: 'website audits', location: 'added by url' } as const;

export function isDirectAuditSearch(search: { niche: string; location: string } | null | undefined): boolean {
  return search?.niche === DIRECT_AUDIT_SEARCH.niche && search.location === DIRECT_AUDIT_SEARCH.location;
}
