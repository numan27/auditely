import { describe, it, expect } from 'vitest';
import { allSamples, startingLeads, type DemoData } from '@/app/_shared/lib/demo/demoSamples';
import type { BusinessWithData } from '@/app/_shared/lib/types/auditely';

const business = (id: string) =>
  ({ id, name: id, website: `https://${id}.com`, audit: { id: `a-${id}` }, ai_report: { id: `r-${id}` } }) as BusinessWithData;

const data: DemoData = {
  capturedAt: '2026-10-02T00:00:00Z',
  query: { niche: 'dentists', location: 'houston, tx, usa' },
  leads: [business('b1'), business('b2'), business('b3')],
  sites: [business('s1')],
  replayIds: ['b2'],
};

describe('startingLeads', () => {
  it('holds back the audit and summary of the replay businesses only', () => {
    expect(startingLeads(data).map((b) => [b.id, !!b.audit, !!b.ai_report])).toEqual([
      ['b1', true, true],
      ['b2', false, false],
      ['b3', true, true],
    ]);
  });

  it('leaves the saved sample untouched', () => {
    startingLeads(data);
    expect(data.leads[1].audit).toBeDefined();
  });
});

describe('allSamples', () => {
  it('lists every business with its saved audit, leads then websites', () => {
    expect(allSamples(data).map((b) => b.id)).toEqual(['b1', 'b2', 'b3', 's1']);
    expect(allSamples(data)[1].audit).toBeDefined();
  });
});
