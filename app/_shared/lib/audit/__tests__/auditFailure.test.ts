// Why a site couldn't be audited, in words a tester understands, never a status code
// or Google's error name.

import { describe, it, expect } from 'vitest';
import { auditFailureMessage, AUDIT_BROKE, AUDIT_NOT_SAVED, AUDITS_OFF, NO_WEBSITE } from '@/app/_shared/lib/audit/auditFailure';

describe('auditFailureMessage', () => {
  it.each([
    ['Site timed out', "Couldn't audit this site: it took too long to answer. Try again later."],
    ['Page timed out while loading', "Couldn't audit this site: it took too long to answer. Try again later."],
    ['Site unreachable', "Couldn't audit this site: it didn't respond. Check the website address, or try again later."],
    ['Blocked (403)', "Couldn't audit this site: it turns away automated visits."],
    ['Blocked (bot challenge)', "Couldn't audit this site: it turns away automated visits."],
    ['HTTP 404', "Couldn't audit this site: its home page answered with an error (404)."],
    ['Not an HTML page', "Couldn't audit this site: its home page isn't a web page."],
    ['Invalid website URL', "Couldn't audit this site: its website address isn't valid."],
    ['it points to a private address', "Couldn't audit this site: it points to a private address."],
  ])('says %s plainly', (reason, message) => expect(auditFailureMessage(reason)).toBe(message));

  it("doesn't pass on Google's error names", () => {
    for (const reason of ['NO_FCP', 'FAILED_DOCUMENT_REQUEST', 'PageSpeed HTTP 500', 'The operation was aborted due to timeout', undefined]) {
      expect(auditFailureMessage(reason)).toBe("Couldn't audit this site: Google's speed test couldn't load it. Try again later.");
    }
  });

  it('says what to do when the audit breaks or cannot be saved', () => {
    expect(AUDIT_BROKE).toBe("The audit didn't finish. Try again in a minute.");
    expect(AUDIT_NOT_SAVED).toBe("Couldn't save the audit. Try again in a minute.");
    expect(AUDITS_OFF).toBe("Audits aren't available right now. Try again later.");
    expect(NO_WEBSITE).toBe('This business has no website to audit.');
  });
});
