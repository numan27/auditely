// app/_shared/lib/utils/businessRows.ts

import type { AiReport, Audit, BusinessWithData } from '@/app/_shared/lib/types/auditely';

type AuditRow = Audit & { ai_reports?: AiReport | AiReport[] | null };

/** A businesses row selected with `audits (*, ai_reports (*))` embedded */
export type BusinessRow = BusinessWithData & { audits?: AuditRow | AuditRow[] | null };

/** The PostgREST select that embeds a business's audit and AI report */
export const BUSINESS_WITH_AUDIT = '*, audits (*, ai_reports (*))';

// UNIQUE FKs make PostgREST embed audits / ai_reports as an object (or null), not an array
const one = <T>(v: T | T[] | null | undefined): T | undefined => (Array.isArray(v) ? v[0] : v ?? undefined);

/** Flattens the embedded audit and AI report into `audit` / `ai_report` */
export function withAuditData({ audits, ...business }: BusinessRow): BusinessWithData {
  const row = one(audits);
  if (!row) return business;
  const { ai_reports, ...audit } = row;
  return { ...business, audit, ai_report: one(ai_reports) };
}
