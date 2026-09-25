// app/_shared/lib/places/geoapifyCategories.ts

// Geoapify Places only searches by category, while the niche is free text.
// Maps common lead-gen niches to Geoapify categories
// (https://apidocs.geoapify.com/docs/places/#categories). Niches with no
// category (plumbers, roofers, HVAC…) are searched by name via Overpass.

interface CategoryRule {
  pattern: RegExp;
  categories: string[];
}

// First matching rule wins. Patterns anchor on word starts so "barbers" never
// hits the bar rule and "spanish" never hits the spa rule.
const CATEGORY_RULES: CategoryRule[] = [
  { pattern: /\borthodont/, categories: ['healthcare.dentist.orthodontics'] },
  { pattern: /\b(dentist|dental)/, categories: ['healthcare.dentist'] },
  { pattern: /\bdermatolog/, categories: ['healthcare.clinic_or_praxis.dermatology'] },
  { pattern: /\b(pediatric|paediatric)/, categories: ['healthcare.clinic_or_praxis.paediatrics'] },
  { pattern: /\b(optometr|optician|eye doctor|eye care)/, categories: ['commercial.health_and_beauty.optician', 'healthcare.clinic_or_praxis.ophthalmology'] },
  { pattern: /\bpharmac/, categories: ['healthcare.pharmacy'] },
  { pattern: /\b(vets?\b|veterinar|animal hospital)/, categories: ['pet.veterinary'] },
  { pattern: /\bhospital/, categories: ['healthcare.hospital'] },
  { pattern: /\b(clinic|medical|doctor|physician)/, categories: ['healthcare.clinic_or_praxis'] },
  { pattern: /\b(lawyer|attorney|law firm|legal)/, categories: ['office.lawyer'] },
  { pattern: /\bnotar/, categories: ['office.notary'] },
  { pattern: /\btax\b/, categories: ['office.tax_advisor'] },
  { pattern: /\b(accountant|accounting|cpa|bookkeep)/, categories: ['office.accountant'] },
  { pattern: /\binsurance/, categories: ['office.insurance'] },
  { pattern: /\b(real estate|realtor|estate agent)/, categories: ['office.estate_agent', 'service.estate_agent'] },
  { pattern: /\b(financial|wealth)/, categories: ['office.financial_advisor', 'office.financial'] },
  { pattern: /\barchitect/, categories: ['office.architect'] },
  { pattern: /\b(marketing|advertising)/, categories: ['office.advertising_agency'] },
  { pattern: /\b(web design|software|it services)/, categories: ['office.it'] },
  { pattern: /\bconsult/, categories: ['office.consulting'] },
  { pattern: /\btravel/, categories: ['office.travel_agent', 'service.travel_agency'] },
  { pattern: /\belectric/, categories: ['service.electrician'] },
  { pattern: /\blocksmith/, categories: ['service.locksmith'] },
  { pattern: /\bcarpent/, categories: ['service.carpenter'] },
  { pattern: /\b(cleaning|cleaners|laundr)/, categories: ['service.cleaning'] },
  { pattern: /\bphotograph/, categories: ['service.photographer'] },
  { pattern: /\bfuneral/, categories: ['service.funeral_directors'] },
  { pattern: /\btailor/, categories: ['service.tailor'] },
  { pattern: /\b(beauty|nail|cosmetic)/, categories: ['service.beauty', 'commercial.health_and_beauty'] },
  { pattern: /\b(hair|barber|salon)/, categories: ['service.beauty.hairdresser'] },
  { pattern: /\bmassage/, categories: ['service.beauty.massage'] },
  { pattern: /\bspas?\b/, categories: ['service.beauty.spa'] },
  { pattern: /\btattoo/, categories: ['service.beauty.tattoo'] },
  { pattern: /\b(gym|fitness|yoga|pilates|crossfit)/, categories: ['sport.fitness'] },
  { pattern: /\b(martial|karate|dojo)/, categories: ['sport.dojo'] },
  { pattern: /\bcar wash/, categories: ['service.vehicle.car_wash'] },
  { pattern: /\b(auto|cars?\b|mechanic)/, categories: ['service.vehicle.repair', 'commercial.vehicle'] },
  { pattern: /\b(restaurant|diner|eatery|eateries)/, categories: ['catering.restaurant'] },
  { pattern: /\b(cafe|coffee)/, categories: ['catering.cafe'] },
  { pattern: /\b(bars?\b|pubs?\b)/, categories: ['catering.bar', 'catering.pub'] },
  { pattern: /\bbaker/, categories: ['commercial.food_and_drink.bakery'] },
  { pattern: /\b(hotel|motel)/, categories: ['accommodation.hotel', 'accommodation.motel'] },
  { pattern: /\b(daycare|childcare|preschool|kindergarten)/, categories: ['childcare'] },
  { pattern: /\bdriving school/, categories: ['education.driving_school'] },
  { pattern: /\b(school|tutor|academy)/, categories: ['education'] },
  { pattern: /\bflorist/, categories: ['commercial.florist'] },
  { pattern: /\bjewel/, categories: ['commercial.jewelry'] },
  { pattern: /\bfurniture/, categories: ['commercial.furniture_and_interior'] },
  { pattern: /\bpets?\b/, categories: ['pet.shop', 'pet.service'] },
  { pattern: /\bstorage/, categories: ['rental.storage'] },
];

// Niches with no category of their own. Geoapify files them under generic
// clinics (a Dallas "chiropractors" search returned 1 chiropractor in 93), so
// they're searched by name, with a match the generic stem would get wrong.
// Trusted constants: they go into the Overpass query as regexes.
const NAME_RULES: { pattern: RegExp; name: string }[] = [
  { pattern: /\bchiropract/, name: 'chiropract' },
  { pattern: /\b(physio|physical therap)/, name: 'physio|physical therap' },
];

const FILLER_WORDS = new Set(['best', 'top', 'local', 'general', 'the']);

// null when the niche is searched by name instead (plumbers, roofers, chiropractors…)
export function categoriesForNiche(niche: string): string[] | null {
  const n = niche.trim().toLowerCase();
  if (NAME_RULES.some((r) => r.pattern.test(n))) return null;
  return CATEGORY_RULES.find((r) => r.pattern.test(n))?.categories ?? null;
}

// "roofing contractors" → "roof", "plumbers" → "plumb": first meaningful word,
// suffixes stripped so it matches "Roofing" or "Plumbing" inside names.
// Letters and digits only, since it's embedded in an Overpass query.
export function nicheNameStem(niche: string): string {
  const rule = NAME_RULES.find((r) => r.pattern.test(niche.toLowerCase()));
  if (rule) return rule.name;
  const words = niche.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  const word = words.find((w) => !FILLER_WORDS.has(w)) ?? words[0] ?? '';
  const stem = word.replace(/(ers|er|ing|s)$/, '');
  return stem.length >= 3 ? stem : word;
}
