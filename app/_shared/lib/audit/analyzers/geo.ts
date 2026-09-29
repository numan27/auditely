// GEO (Generative Engine Optimization): can AI search engines read who this
// business is, and does it agree with its business listing? Rubric: see spec.

import type { Finding, GeoChecks, NapResult, NapStatus } from '@/app/_shared/lib/audit/types';
import type { StructuredData } from '@/app/_shared/lib/audit/analyzers/structuredData';
import { expectedTypesForNiche, isLocalBusinessType, isMedicalNiche } from '@/app/_shared/lib/audit/nicheTypes';
import { formatPhone } from '@/app/_shared/lib/audit/analyzers/text';

function napPoints(status: NapStatus, points: number): number {
  // n/a = Google has no value to compare — not the website's fault
  return status === 'match' || status === 'n/a' ? points : 0;
}

function napFinding(id: string, label: string, status: NapStatus, siteValue: string | null): Finding {
  switch (status) {
    case 'match':
      return { id, status: 'pass', label: `${label} matches business listing` };
    case 'mismatch':
      return {
        id,
        status: 'fail',
        label: `${label} on site doesn't match business listing`,
        ...(siteValue ? { detail: `Site shows: ${siteValue}` } : {}),
      };
    case 'missing':
      return { id, status: 'fail', label: `${label} not found on the homepage` };
    case 'n/a':
      return { id, status: 'warn', label: `Business listing has no ${label.toLowerCase()}` };
  }
}

export function analyzeGeo(
  structured: StructuredData,
  nap: NapResult,
  niche: string | null
): { score: number; checks: GeoChecks } {
  const findings: Finding[] = [];
  let score = 0;
  const add = (points: number, finding: Finding | null) => {
    score += points;
    if (finding) findings.push(finding);
  };

  // 1. JSON-LD present (15)
  add(
    structured.blocks > 0 ? 15 : 0,
    structured.blocks > 0
      ? { id: 'geo.jsonld', status: 'pass', label: 'Structured data (JSON-LD) found' }
      : { id: 'geo.jsonld', status: 'fail', label: 'No structured data (JSON-LD) on the homepage' }
  );

  // 2. Business-type entity (25), niche-aware
  const entity = structured.entity;
  const entityTypes = entity?.types ?? [];
  const expected = expectedTypesForNiche(niche);
  const wanted = expected?.[0] ?? 'LocalBusiness';
  const isBusiness = entityTypes.some(isLocalBusinessType);

  if (isBusiness && (!expected || entityTypes.some((t) => expected.includes(t)))) {
    add(25, { id: 'geo.businessType', status: 'pass', label: `Business schema type: ${entityTypes.join(', ')}` });
  } else if (isBusiness) {
    add(15, {
      id: 'geo.businessType',
      status: 'warn',
      label: `Use the more specific ${wanted} schema type`,
      detail: `Found ${entityTypes.join(', ')}`,
    });
  } else if (entityTypes.includes('Organization')) {
    add(5, { id: 'geo.businessType', status: 'warn', label: `Only generic Organization schema — add ${wanted}` });
  } else {
    add(0, { id: 'geo.businessType', status: 'fail', label: `No ${wanted} schema for AI search engines to read` });
  }

  // 3. Entity completeness (5 each for name, address, telephone)
  const fields: [string, string | null | undefined][] = [
    ['name', entity?.name],
    ['address', entity?.address],
    ['telephone', entity?.telephone],
  ];
  const missing = fields.filter(([, value]) => !value).map(([key]) => key);
  add(
    (fields.length - missing.length) * 5,
    missing.length === 0
      ? { id: 'geo.entityComplete', status: 'pass', label: 'Schema includes name, address and phone' }
      : { id: 'geo.entityComplete', status: entity ? 'warn' : 'fail', label: `Schema is missing ${missing.join(', ')}` }
  );

  // 4. NAP vs Google (10 / 15 / 15). A site audited by URL has no listing at
  //    all: it keeps the points, without findings about a listing that doesn't exist.
  const hasListing = [nap.name, nap.address, nap.phone].some((status) => status !== 'n/a');
  const napCheck = (finding: Finding) => (hasListing ? finding : null);
  add(napPoints(nap.name, 10), napCheck(napFinding('geo.nap.name', 'Business name', nap.name, nap.site.name)));
  add(napPoints(nap.address, 15), napCheck(napFinding('geo.nap.address', 'Address', nap.address, nap.site.address)));
  add(
    napPoints(nap.phone, 15),
    napCheck(napFinding('geo.nap.phone', 'Phone number', nap.phone, nap.site.phones.map(formatPhone).join(', ') || null))
  );

  // 5. Extras (5)
  const hasMedicalPage = isMedicalNiche(niche) && structured.types.includes('MedicalWebPage');
  const hasExtras = Boolean(entity?.hasHours || entity?.hasGeo || entity?.hasSameAs || hasMedicalPage);
  add(
    hasExtras ? 5 : 0,
    hasExtras
      ? { id: 'geo.extras', status: 'pass', label: 'Schema includes hours, map location or social profiles' }
      : { id: 'geo.extras', status: 'warn', label: 'Add opening hours, map coordinates or social profiles to the schema' }
  );

  return { score, checks: { findings, schemaTypes: structured.types, nap } };
}
