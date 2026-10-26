// app/_shared/lib/config/auditRequests.ts

// Free audits requested on devartventures.com arrive through
// /api/inbound/audit-request and are stored as businesses of one reserved
// search, like the websites added by URL (directAudits.ts), so every card
// action works on them unchanged. Saved Searches hides it; the Requests tab lists it.

import { isDirectAuditSearch } from '@/app/_shared/lib/config/directAudits';

export const AUDIT_REQUEST_SEARCH = { niche: 'audit requests', location: 'devartventures.com' } as const;

type SearchLike = { niche: string; location: string } | null | undefined;

export function isAuditRequestSearch(search: SearchLike): boolean {
  return search?.niche === AUDIT_REQUEST_SEARCH.niche && search.location === AUDIT_REQUEST_SEARCH.location;
}

/** Sites known only by their address (added by URL, or requested): no listing to compare the site with */
export function isUrlOnlySearch(search: SearchLike): boolean {
  return isDirectAuditSearch(search) || isAuditRequestSearch(search);
}
