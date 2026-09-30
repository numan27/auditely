import { describe, it, expect } from 'vitest';
import { emailLookupCandidates } from '@/app/_shared/lib/hooks/useEmailDiscovery';
import type { BusinessWithData } from '@/app/_shared/lib/types/auditely';

const biz = (id: string, over: Partial<BusinessWithData> = {}) =>
  ({ id, website: 'https://x.com', email: null, email_lookup_at: null, ...over }) as BusinessWithData;

describe('emailLookupCandidates', () => {
  it('picks businesses with a website, no email and no lookup yet', () => {
    const list = [
      biz('a'),
      biz('b', { email: 'b@x.com' }),
      biz('c', { website: null }),
      biz('d', { email_lookup_at: '2026-09-30T10:00:00Z' }),
      biz('e'),
    ];
    // 'e' got an email during this run's scraping pass
    expect(emailLookupCandidates(list, new Set(['e']))).toEqual(['a']);
  });
});
