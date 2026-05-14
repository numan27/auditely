/**
 * Image Assets
 *
 * Usage: import { images } from '@/public/images';
 * Then use in Image component: src={images.heroBanner}
 *
 * Note: For static files, use path strings. Next.js serves files from /public at root.
 */

export const images = {
  // Add image paths here
  // Example: heroBanner: '/images/hero-banner.jpg',
  // Example: userAvatar: '/images/user-avatar.png',
} as const;

export type ImageKey = keyof typeof images;
