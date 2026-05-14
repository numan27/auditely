/**
 * Icon Assets
 *
 * Usage: import { icons } from '@/public/icons';
 * Then use in Image component: src={icons.logo}
 *
 * Note: For static files, use path strings. Next.js serves files from /public at root.
 */

export const icons = {
  // Add icon paths here
  // Example: logo: '/icons/logo.svg',
  // Example: arrowRight: '/icons/arrow-right.svg',
} as const;

export type IconKey = keyof typeof icons;
