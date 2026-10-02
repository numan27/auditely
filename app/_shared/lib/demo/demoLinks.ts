// app/_shared/lib/demo/demoLinks.ts

// The public demo's optional links, from the environment. Read on the server
// (app/demo/page.tsx) and handed to the page.

export interface DemoLinks {
  /** The recorded walkthrough (DEMO_VIDEO_URL) */
  videoUrl: string | null;
  /** Its player, when the walkthrough is a Loom video: it then opens inside the demo instead of a new tab */
  videoPlayerUrl: string | null;
  /** Where "Get in touch" leads (DEMO_CONTACT_URL) */
  contactUrl: string | null;
}

// Web links only: these end up in an href on a public page
function webLink(value: string | undefined): string | null {
  const link = value?.trim();
  if (!link) return null;
  try {
    return ['http:', 'https:'].includes(new URL(link).protocol) ? link : null;
  } catch {
    return null;
  }
}

const LOOM_HOSTS = ['loom.com', 'www.loom.com'];
// Starts by itself, without Loom's bar, title, owner and share button
const LOOM_PLAYER_OPTIONS = 'autoplay=1&hide_owner=true&hide_share=true&hide_title=true&hideEmbedTopBar=true';

/** A Loom share link (loom.com/share/{id}) as its embeddable player; null for any other link */
export function loomPlayerUrl(link: string): string | null {
  try {
    const url = new URL(link);
    if (!['http:', 'https:'].includes(url.protocol) || !LOOM_HOSTS.includes(url.hostname)) return null;
    const id = /^\/(?:share|embed)\/([A-Za-z0-9]+)\/?$/.exec(url.pathname)?.[1];
    return id ? `https://www.loom.com/embed/${id}?${LOOM_PLAYER_OPTIONS}` : null;
  } catch {
    return null;
  }
}

export function demoLinks(env: Record<string, string | undefined> = process.env): DemoLinks {
  const videoUrl = webLink(env.DEMO_VIDEO_URL);
  return {
    videoUrl,
    videoPlayerUrl: videoUrl && loomPlayerUrl(videoUrl),
    contactUrl: webLink(env.DEMO_CONTACT_URL),
  };
}
