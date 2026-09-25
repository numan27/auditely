// app/_shared/lib/utils/businessOrder.ts

/**
 * Businesses with a website first — those are the ones that can be audited —
 * keeping the provider's order within each group (Array.sort is stable).
 */
export function websiteFirst<T extends { website: string | null }>(businesses: T[]): T[] {
  return [...businesses].sort((a, b) => Number(!a.website) - Number(!b.website));
}
