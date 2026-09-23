// app/_shared/lib/audit/analyzers/structuredData.ts

// Reads JSON-LD blocks and picks the business entity GEO and NAP check against.

import type { CheerioAPI } from 'cheerio';
import { isLocalBusinessType } from '@/app/_shared/lib/audit/nicheTypes';
import { nameSimilarity, phoneDigits } from '@/app/_shared/lib/audit/analyzers/text';

export interface BusinessEntity {
  types: string[];
  name: string | null;
  address: string | null;
  telephone: string | null;
  hasHours: boolean;
  hasGeo: boolean;
  hasSameAs: boolean;
}

export interface StructuredData {
  /** Number of parseable JSON-LD blocks */
  blocks: number;
  /** Every @type seen, deduped */
  types: string[];
  entity: BusinessEntity | null;
}

type JsonNode = Record<string, unknown>;

const MAX_DEPTH = 8;

function toArray(value: unknown): unknown[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function typesOf(node: JsonNode): string[] {
  return toArray(node['@type'])
    .filter((t): t is string => typeof t === 'string')
    .map((t) => t.replace(/^https?:\/\/schema\.org\//, ''));
}

// Walks @graph, arrays and nested values, collecting every typed object
function collectNodes(value: unknown, out: JsonNode[], depth = 0): void {
  if (depth > MAX_DEPTH || value == null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectNodes(item, out, depth + 1));
    return;
  }
  const node = value as JsonNode;
  if (node['@type']) out.push(node);
  for (const child of Object.values(node)) collectNodes(child, out, depth + 1);
}

function text(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number') return String(value);
  return null;
}

function formatAddress(value: unknown): string | null {
  const first = toArray(value)[0];
  if (typeof first === 'string') return first.trim() || null;
  if (first && typeof first === 'object') {
    const a = first as JsonNode;
    const parts = [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode].map(text).filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  }
  return null;
}

function toEntity(node: JsonNode): BusinessEntity {
  return {
    types: typesOf(node),
    name: text(node.name),
    address: formatAddress(node.address),
    telephone: text(toArray(node.telephone)[0]),
    hasHours: Boolean(node.openingHours || node.openingHoursSpecification),
    hasGeo: Boolean(node.geo),
    hasSameAs: toArray(node.sameAs).length > 0,
  };
}

// Multi-location sites list several businesses: prefer the Google name and phone, then completeness
function pickBest(
  nodes: JsonNode[],
  preferredName: string | null,
  preferredPhone: string | null = null
): JsonNode | null {
  if (nodes.length === 0) return null;
  const targetPhone = preferredPhone ? phoneDigits(preferredPhone) : null;
  const rank = (node: JsonNode) => {
    const e = toEntity(node);
    const nameScore = preferredName && e.name ? nameSimilarity(preferredName, e.name) : 0;
    const phone = e.telephone ? phoneDigits(e.telephone) : null;
    const phoneScore = phone && targetPhone && phone === targetPhone ? 5 : 0;
    const completeness = [e.name, e.address, e.telephone].filter(Boolean).length;
    return nameScore * 10 + phoneScore + completeness;
  };
  return [...nodes].sort((a, b) => rank(b) - rank(a))[0];
}

export function parseStructuredData(
  $: CheerioAPI,
  preferredName: string | null,
  preferredPhone: string | null = null
): StructuredData {
  const nodes: JsonNode[] = [];
  let blocks = 0;

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el)
      .text()
      .replace(/^\s*\/\*\s*<!\[CDATA\[\s*\*\/|\/\*\s*\]\]>\s*\*\/\s*$/g, '');
    try {
      collectNodes(JSON.parse(raw), nodes);
      blocks++;
    } catch {
      /* invalid JSON-LD block — skip it */
    }
  });

  const types = [...new Set(nodes.flatMap(typesOf))];
  const businesses = nodes.filter((n) => typesOf(n).some(isLocalBusinessType));
  const organizations = nodes.filter((n) => typesOf(n).includes('Organization'));
  const best =
    pickBest(businesses, preferredName, preferredPhone) ?? pickBest(organizations, preferredName, preferredPhone);

  return { blocks, types, entity: best ? toEntity(best) : null };
}
