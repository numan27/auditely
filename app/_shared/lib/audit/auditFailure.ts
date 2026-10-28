// app/_shared/lib/audit/auditFailure.ts

// Why an audit didn't happen, in words a tester understands. The site check
// (siteFetch) and Google's speed test (pageSpeed) give their reasons in our terms,
// a status code or a Lighthouse error name; this says the same thing plainly.
// Anything from the speed test reads as the speed test not loading the site.

const PREFIX = "Couldn't audit this site:";

export const AUDIT_BROKE = "The audit didn't finish. Try again in a minute.";
export const AUDIT_NOT_SAVED = "Couldn't save the audit. Try again in a minute.";
export const AUDITS_OFF = "Audits aren't available right now. Try again later.";
export const NO_WEBSITE = 'This business has no website to audit.';

function plainReason(reason: string): string {
  if (/^(Site|Page) timed out/.test(reason)) return 'it took too long to answer. Try again later.';
  if (/^(Site|Page) unreachable$/.test(reason)) return "it didn't respond. Check the website address, or try again later.";
  if (reason.startsWith('Blocked (')) return 'it turns away automated visits.';
  const http = /^HTTP (\d{3})$/.exec(reason);
  if (http) return `its home page answered with an error (${http[1]}).`;
  if (reason === 'Not an HTML page') return "its home page isn't a web page.";
  if (reason === 'Invalid website URL') return "its website address isn't valid.";
  if (reason === 'it points to a private address') return 'it points to a private address.';
  return "Google's speed test couldn't load it. Try again later.";
}

export function auditFailureMessage(reason: string | undefined): string {
  return `${PREFIX} ${plainReason(reason ?? '')}`;
}
