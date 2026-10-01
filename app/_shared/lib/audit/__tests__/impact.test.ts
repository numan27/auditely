import { describe, it, expect } from 'vitest';
import { impactFor, plainLabel, rankedProblems } from '@/app/_shared/lib/audit/impact';
import { IMPACT_LIBRARY, STATS } from '@/app/_shared/lib/audit/impactLibrary';
import type { AuditLike } from '@/app/_shared/lib/audit/reportData';
import type { AuditChecks, Finding, KeyAudit, LighthouseSummary } from '@/app/_shared/lib/audit/types';

const f = (id: string, status: Finding['status'], detail?: string): Finding => ({ id, status, label: `label of ${id}`, ...(detail && { detail }) });
const findings = (list: Finding[]) => ({ findings: list });

function audit(over: { checks?: Partial<AuditChecks>; mobile?: Partial<LighthouseSummary>; ssl?: boolean | null; engine?: number } = {}): AuditLike {
  return {
    created_at: '2026-10-01T00:00:00Z',
    performance_score: 50,
    seo_score: 80,
    mobile_score: 40,
    ssl_valid: over.ssl ?? true,
    raw_json: { mobile: { categories: {}, keyAudits: {}, ...over.mobile }, desktop: null },
    checks: over.checks ?? {},
    engine_version: over.engine ?? 2,
  };
}
const lab = (score: number, displayValue: string): KeyAudit => ({ score, title: 't', displayValue });
const ids = (a: AuditLike) => rankedProblems(a).map((p) => p.id);

describe('impact library', () => {
  it('follows the writing rules: short, plain, drawable, one entry per result', () => {
    const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
    for (const entry of IMPACT_LIBRARY) {
      expect(words(entry.problem), entry.id).toBeLessThanOrEqual(12);
      expect(words(entry.cost), entry.id).toBeLessThanOrEqual(25);
      expect(words(entry.fix), entry.id).toBeLessThanOrEqual(20);
      expect(`${entry.problem}${entry.cost}${entry.fix}`, entry.id).not.toMatch(/[‘’“”]/);
    }
    const keys = IMPACT_LIBRARY.map((e) => `${e.id}|${e.status}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('makes no claim the checks cannot back', () => {
    const text = (e: (typeof IMPACT_LIBRARY)[number]) => `${e.problem} ${e.cost} ${e.fix}`;
    for (const entry of IMPACT_LIBRARY) {
      // Phones make plain-text numbers tappable; the check only knows there's no call link
      expect(text(entry), entry.id).not.toMatch(/one tap|every extra step|have to copy/i);
      // The listing compared may come from another provider than Google
      if (entry.id.startsWith('geo.nap.')) expect(`${entry.problem} ${entry.cost}`, entry.id).not.toMatch(/google/i);
      // Fixes describe the work, never a measured result
      expect(entry.fix, entry.id).not.toMatch(/under \d|seconds|guarantee/i);
    }
    // Only mailto links are detected: other ways to write in may exist
    expect(text(impactFor('lead.form', 'fail')!)).not.toMatch(/no way to/i);
    expect(impactFor('lead.form', 'warn')?.problem).not.toMatch(/only email/i);
  });

  it("gives a failing check's owner-language label, or its own label when it has no entry", () => {
    expect(plainLabel(f('lead.form', 'fail'))).toBe(impactFor('lead.form', 'fail')?.problem);
    expect(plainLabel(f('geo.somethingNew', 'fail'))).toBe('label of geo.somethingNew');
  });
});

describe('rankedProblems', () => {
  it("never lists passes, couldn't-check results or a Google listing without a value", () => {
    const a = audit({
      checks: {
        lead: { ...findings([f('lead.formUnchecked', 'warn'), f('lead.brokenLinks', 'warn'), f('lead.clickToCall', 'pass')]), pages: [], links: { checked: 0, broken: [] } },
        geo: { ...findings([f('geo.nap.phone', 'warn'), f('geo.jsonld', 'pass')]), schemaTypes: [], nap: { name: 'n/a', address: 'n/a', phone: 'n/a', site: { name: null, address: null, phones: [] } } },
      },
    });
    expect(rankedProblems(a)).toEqual([]);
  });

  it('lists problems worst first, one per group, with their evidence', () => {
    const a = audit({
      checks: {
        aeo: { ...findings([f('aeo.h1', 'fail'), f('aeo.questions', 'fail')]), h1Count: 0, h2Count: 0, questionHeadings: 0, hasFaqSchema: false },
        geo: {
          ...findings([f('geo.jsonld', 'fail'), f('geo.nap.address', 'fail'), f('geo.nap.phone', 'fail', 'Site shows: (555) 000-1111')]),
          schemaTypes: [],
          nap: { name: 'match', address: 'missing', phone: 'mismatch', site: { name: null, address: null, phones: [] } },
        },
        lead: { ...findings([f('lead.form', 'fail')]), pages: [], links: { checked: 0, broken: [] } },
      },
    });
    expect(ids(a)).toEqual(['lead.form', 'geo.nap.phone', 'geo.jsonld', 'aeo.questions']);
    expect(rankedProblems(a)[1]).toMatchObject({ evidence: 'Site shows: (555) 000-1111', stat: STATS.nearbyVisit });
  });

  it('uses real-visitor load time when Google has it, else the mobile test', () => {
    const slowLab = { 'largest-contentful-paint': lab(0.1, '12.8 s') };
    expect(rankedProblems(audit({ mobile: { keyAudits: slowLab, field: { lcpMs: 4100, scope: 'page' } } }))[0]).toMatchObject({
      id: 'speed.slowLoad',
      evidence: 'Real visitors on phones wait about 4.1 s',
      stat: STATS.mobileAbandon,
    });
    // Real visitors are fast: the lab result alone doesn't make the site "slow"
    expect(ids(audit({ mobile: { keyAudits: slowLab, field: { lcpMs: 2000, scope: 'page' } } }))).toEqual([]);
    expect(rankedProblems(audit({ mobile: { keyAudits: slowLab } }))[0]).toMatchObject({ id: 'speed.slowLoad', evidence: "Google's mobile test: 12.8 s" });
    expect(ids(audit({ mobile: { keyAudits: { 'largest-contentful-paint': lab(0.6, '3.6 s') } } }))).toEqual([]);
  });

  it('flags an invalid certificate, layout jumps and heavy images, in that order', () => {
    const a = audit({
      ssl: false,
      mobile: {
        keyAudits: {
          'uses-optimized-images': lab(0.3, 'Potential savings of 1,234 KiB'),
          'cumulative-layout-shift': lab(0.2, '0.45'),
        },
      },
    });
    expect(ids(a)).toEqual(['ssl.invalid', 'speed.layoutShift', 'speed.heavyImages']);
    expect(rankedProblems(a)[2].evidence).toBe("Google's mobile test: Potential savings of 1,234 KiB");
  });

  it('shows each statistic once, on the first problem it supports', () => {
    const a = audit({
      checks: {
        lead: { ...findings([f('lead.clickToCall', 'fail')]), pages: [], links: { checked: 0, broken: [] } },
        geo: { ...findings([f('geo.nap.phone', 'fail')]), schemaTypes: [], nap: { name: 'match', address: 'match', phone: 'mismatch', site: { name: null, address: null, phones: [] } } },
      },
    });
    expect(rankedProblems(a).map((p) => p.stat)).toEqual([STATS.nearbyVisit, undefined]);
  });

  it('ignores SSL on an outdated audit, which never measured it', () => {
    expect(ids(audit({ ssl: false, engine: 1 }))).toEqual([]);
  });

  it('lists a failing check the library does not know by its own label, last', () => {
    const a = audit({ checks: { lead: { ...findings([f('lead.newCheck', 'fail'), f('lead.form', 'fail')]), pages: [], links: { checked: 0, broken: [] } } } });
    expect(rankedProblems(a)).toEqual([
      expect.objectContaining({ id: 'lead.form' }),
      { id: 'lead.newCheck', problem: 'label of lead.newCheck', cost: '', fix: '' },
    ]);
  });
});
