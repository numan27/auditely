// app/_shared/lib/utils/searchLabel.ts

// Display names for searches, which are stored lowercased ("dentists", "las vegas, nv, usa").

const titleWord = (word: string) => (word ? word[0].toUpperCase() + word.slice(1) : word);

/** "las vegas, nv, usa" → "Las Vegas, NV, USA": short parts after the city are codes */
export function formatPlace(location: string): string {
  return location
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part, i) => (i > 0 && part.length <= 3 ? part.toUpperCase() : part.split(/\s+/).map(titleWord).join(' ')))
    .join(', ');
}

/** "dentists" + "las vegas, nv, usa" → "Dentists in Las Vegas, NV, USA" */
export function searchTitle({ niche, location }: { niche: string; location: string }): string {
  return `${titleWord(niche.trim())} in ${formatPlace(location)}`;
}

/** "4 businesses", and "over 30 days old" once Google's details have to be fetched again */
export function searchCount({ business_count, expired }: { business_count: number; expired?: boolean }): string {
  const count = `${business_count} ${business_count === 1 ? 'business' : 'businesses'}`;
  return expired ? `${count} · over 30 days old` : count;
}
