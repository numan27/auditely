// app/_shared/lib/places/nicheSuggestions.ts

// Business types suggested while typing in the search bar's Business type field.
// A fixed list matched in the browser: no Places request, so suggestions cost nothing.
// Any text still searches; these only save typing.

export const NICHE_SUGGESTIONS = [
  // Health
  'Dentists',
  'Orthodontists',
  'Chiropractors',
  'Physical therapists',
  'Medical clinics',
  'Med spas',
  'Optometrists',
  'Veterinarians',
  // Home services
  'Plumbers',
  'Electricians',
  'HVAC contractors',
  'Roofing contractors',
  'General contractors',
  'Landscapers',
  'Pest control',
  'Cleaning services',
  'Movers',
  // Professional services
  'Law firms',
  'Personal injury lawyers',
  'Accountants',
  'Insurance agencies',
  'Real estate agents',
  'Financial advisors',
  // Agencies
  'Marketing agencies',
  'Digital marketing agencies',
  'SEO agencies',
  'Web design agencies',
  'Advertising agencies',
  'Branding agencies',
  'Social media marketing agencies',
  'PPC agencies',
  // Local businesses
  'Restaurants',
  'Hair salons',
  'Barbers',
  'Gyms',
  'Auto repair shops',
  'Car dealerships',
  'Schools',
  'Daycares',
] as const;

const MAX_SUGGESTIONS = 6;

// Suggestions whose name starts with the input come first, then those with a later
// word starting with it ("agen" finds every agency). Nothing for an empty input or
// one that already matches a suggestion exactly.
export function suggestNiches(input: string): string[] {
  const query = input.trim().toLowerCase();
  if (!query) return [];
  if (NICHE_SUGGESTIONS.some((niche) => niche.toLowerCase() === query)) return [];

  const startsWith: string[] = [];
  const wordStartsWith: string[] = [];
  for (const niche of NICHE_SUGGESTIONS) {
    const name = niche.toLowerCase();
    if (name.startsWith(query)) startsWith.push(niche);
    else if (name.split(' ').some((word) => word.startsWith(query))) wordStartsWith.push(niche);
  }
  return [...startsWith, ...wordStartsWith].slice(0, MAX_SUGGESTIONS);
}
