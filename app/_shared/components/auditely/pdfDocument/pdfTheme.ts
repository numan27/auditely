// app/_shared/components/auditely/pdfDocument/pdfTheme.ts

// What a design changes in the report's styles (pdfStyles.ts): the accent's
// default, the typefaces and the header's three looks.

import type { FontId, HeaderStyle } from '@/app/_shared/lib/brand/brandDesign';

export const DEFAULT_ACCENT = '#6366f1';
export const DEFAULT_TINT = '#eef2ff';
const PAGE_PADDING = 48;

export const FONTS: Record<FontId, { regular: string; bold: string }> = {
  sans: { regular: 'Helvetica', bold: 'Helvetica-Bold' },
  serif: { regular: 'Times-Roman', bold: 'Times-Bold' },
  mono: { regular: 'Courier', bold: 'Courier-Bold' },
};

// A type, not an interface, so react-pdf's Style accepts it
type HeaderBox = {
  marginTop?: number;
  marginHorizontal?: number;
  marginBottom: number;
  paddingHorizontal?: number;
  paddingVertical?: number;
  paddingBottom?: number;
  backgroundColor?: string;
  borderBottomWidth?: number;
  borderBottomColor?: string;
  borderBottomStyle?: 'solid';
};

// The rule under the title (today's), a band of the accent across the top of the page, or neither
export function headerStyle(header: HeaderStyle, accent: string): HeaderBox {
  if (header === 'band') {
    return {
      marginTop: -PAGE_PADDING,
      marginHorizontal: -PAGE_PADDING,
      marginBottom: 28,
      paddingHorizontal: PAGE_PADDING,
      paddingVertical: 26,
      backgroundColor: accent,
    };
  }
  if (header === 'plain') return { marginBottom: 24, paddingBottom: 4 };
  return { marginBottom: 28, paddingBottom: 16, borderBottomWidth: 2, borderBottomColor: accent, borderBottomStyle: 'solid' };
}
