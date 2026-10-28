// A link to the home page shows the landing page's title and the share image.
// The page gives its own openGraph, which replaces the layout's, image included,
// so it names the image itself.

import { describe, expect, it, vi } from 'vitest';

vi.mock('@/app/_shared/lib/supabase/server', () => ({ getSession: async () => null }));
vi.mock('@/app/_shared/components/auditely/workspace/workspace', () => ({ Workspace: () => null }));

const { metadata } = await import('@/app/(app)/page');
const { SEO_FILES } = await import('@/app/_shared/lib/config/routes');
const { SHARE_IMAGE_ALT, SHARE_TITLE } = await import('@/app/_shared/lib/seo/shareCopy');

describe('the home page when shared', () => {
  it('shows the share image under the landing page’s title', () => {
    expect(metadata.openGraph).toMatchObject({
      title: SHARE_TITLE,
      images: [{ url: SEO_FILES.SHARE_IMAGE, width: 1200, height: 630, alt: SHARE_IMAGE_ALT }],
    });
  });
});
