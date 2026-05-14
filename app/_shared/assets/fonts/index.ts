/**
 * Font Assets
 *
 * Usage: import { fonts } from '@/public/fonts';
 *
 * Note: Fonts are typically referenced in CSS or layout.tsx via next/font.
 * This file provides centralized font path constants if needed for custom loading.
 */

export const fonts = {
  // Add font paths here
  // Example: customFont: '/fonts/CustomFont.woff2',
} as const;

export type FontKey = keyof typeof fonts;
