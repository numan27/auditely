// app/_shared/lib/demo/demoLinks.ts

// The public demo's optional links, from the environment. Read on the server
// (app/demo/page.tsx) and handed to the page.

export interface DemoLinks {
  /** The recorded walkthrough (DEMO_VIDEO_URL) */
  videoUrl: string | null;
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

export const demoLinks = (env: Record<string, string | undefined> = process.env): DemoLinks => ({
  videoUrl: webLink(env.DEMO_VIDEO_URL),
  contactUrl: webLink(env.DEMO_CONTACT_URL),
});
