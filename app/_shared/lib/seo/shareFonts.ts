// app/_shared/lib/seo/shareFonts.ts

// The share image's faces, the landing page's own: Bricolage Grotesque for the
// headline and Geist for the rest. Google Fonts serves a server TrueType, which
// the image renderer reads. Fetched when the image is built; if Google can't be
// reached, the image is drawn in its default face instead of failing the build.

export interface ShareFont {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 600 | 700;
  style: 'normal';
}

const FACES = 'family=Bricolage+Grotesque:wght@700&family=Geist:wght@400;600';
const CSS_URL = `https://fonts.googleapis.com/css2?${FACES}`;
const FACE_COUNT = 3;
const TIMEOUT_MS = 10_000;

const FACE_RULE = /@font-face\s*{([^}]*)}/g;

/** Each TrueType face in Google's stylesheet: its family, weight and file */
function facesIn(css: string): { name: string; weight: ShareFont['weight']; url: string }[] {
  return [...css.matchAll(FACE_RULE)].flatMap(([, rule]) => {
    const name = rule.match(/font-family:\s*'([^']+)'/)?.[1];
    const weight = Number(rule.match(/font-weight:\s*(\d+)/)?.[1]);
    const url = rule.match(/url\(([^)]+)\)\s*format\('truetype'\)/)?.[1];
    return name && url && (weight === 400 || weight === 600 || weight === 700) ? [{ name, weight, url }] : [];
  });
}

async function fetched(fetcher: typeof fetch, url: string): Promise<Response> {
  const response = await fetcher(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response;
}

/** The three faces, or none: a mix would set the headline in one face and the rest in another */
export async function shareFonts(fetcher: typeof fetch = fetch): Promise<ShareFont[]> {
  try {
    const faces = facesIn(await (await fetched(fetcher, CSS_URL)).text());
    if (faces.length !== FACE_COUNT) throw new Error(`Google Fonts sent ${faces.length} of ${FACE_COUNT} faces`);
    return await Promise.all(
      faces.map(async ({ name, weight, url }) => ({
        name,
        weight,
        style: 'normal' as const,
        data: await (await fetched(fetcher, url)).arrayBuffer(),
      }))
    );
  } catch (error) {
    console.warn(`[share-image] Drawing in the default face: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}
