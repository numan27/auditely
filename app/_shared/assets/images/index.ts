/**
 * Image Assets
 *
 * Usage: import { images } from '@/app/_shared/assets/images';
 *
 * Paths are from the project root: these files are read on the server (the
 * outreach email attaches the logo). next.config.ts lists them so they are
 * deployed with the routes that read them.
 */

import resultsLight from './landing/resultsLight.png';
import resultsDark from './landing/resultsDark.png';

export const images = {
  devartventuresLogo: 'app/_shared/assets/images/devartventuresLogo.png',
} as const;

export type ImageKey = keyof typeof images;

/**
 * The landing page's pictures, imported so next/image knows their size. The
 * demo's results list, light and dark: scripts/captureLanding.mjs takes them.
 */
export const landingImages = { resultsLight, resultsDark } as const;
