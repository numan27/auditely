// app/opengraph-image.tsx

// The image a link to Auditely shows where it's shared (app/layout.tsx names it
// a large card). Drawn once, when the site is built, from the demo's sample audit.

import { ImageResponse } from 'next/og';
import { ShareCard } from '@/app/_shared/components/seo/shareCard';
import { AUDITELY_URL } from '@/app/_shared/lib/config/site';
import { demoData } from '@/app/_shared/lib/demo/demoData';
import { landingSample, searchLabel } from '@/app/_shared/lib/demo/landingDemo';
import { SHARE_IMAGE_ALT } from '@/app/_shared/lib/seo/shareCopy';
import { shareFonts } from '@/app/_shared/lib/seo/shareFonts';

export const alt = SHARE_IMAGE_ALT;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function ShareImage() {
  const { scores } = landingSample(demoData);
  const fonts = await shareFonts();
  return new ImageResponse(
    <ShareCard search={searchLabel(demoData.query)} scores={scores} site={new URL(AUDITELY_URL).host} />,
    // An empty list would switch off next/og's own face too: without ours, it draws in that
    { ...size, ...(fonts.length ? { fonts } : {}) }
  );
}
