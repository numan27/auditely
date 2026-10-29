// app/_shared/components/auditely/pdfDocument/pdfStyles.ts

// The report's styles, drawn in the account's design (brandDesign.ts): its
// accent, button colour, typeface and header. The default design is today's
// indigo report in Helvetica. The PDF's built-in fonts need no files.

import { Font, StyleSheet } from '@react-pdf/renderer';
import { DEFAULT_ACCENT, DEFAULT_TINT, FONTS, headerStyle } from '@/app/_shared/components/auditely/pdfDocument/pdfTheme';
import { DEFAULT_DESIGN, textOn, tint, type BrandDesign } from '@/app/_shared/lib/brand/brandDesign';

// No automatic hyphenation — it splits short labels ("list-ing") in narrow rows
Font.registerHyphenationCallback((word) => [word]);

export function pdfStyles(design: BrandDesign) {
  const accent = design.accent ?? DEFAULT_ACCENT;
  const button = design.button ?? accent;
  const { regular, bold } = FONTS[design.font];
  const band = design.header === 'band';
  const onBand = textOn(accent);
  return StyleSheet.create({
    page: {
      padding: 48,
      // Clears the fixed footer when the report runs onto a second page
      paddingBottom: 72,
      fontFamily: regular,
      backgroundColor: '#ffffff',
      fontSize: 11,
      color: '#374151',
    },
    header: headerStyle(design.header, accent),
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerLogo: {
      height: 32,
      maxWidth: 120,
      objectFit: 'contain',
      marginRight: 14,
    },
    headerTitle: {
      fontSize: 22,
      fontFamily: bold,
      color: band ? onBand : '#111827',
      marginBottom: 4,
    },
    headerSubtitle: {
      fontSize: 10,
      color: band ? onBand : '#9ca3af',
      opacity: band ? 0.85 : 1,
    },
    // The brand's name in the subtitle: the accent, or the band's text colour on the band
    headerLink: {
      color: band ? onBand : accent,
      textDecoration: 'none',
    },
    section: {
      marginBottom: 22,
    },
    sectionLabel: {
      fontSize: 9,
      fontFamily: bold,
      color: accent,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 8,
    },
    businessName: {
      fontSize: 16,
      fontFamily: bold,
      color: '#111827',
      marginBottom: 3,
    },
    businessMeta: {
      fontSize: 10,
      color: '#6b7280',
      marginBottom: 2,
    },
    scoresRow: {
      flexDirection: 'row',
      gap: 8,
    },
    scoreBox: {
      flex: 1,
      backgroundColor: '#f9fafb',
      borderRadius: 6,
      paddingVertical: 10,
      paddingHorizontal: 4,
      alignItems: 'center',
    },
    scoreValue: {
      fontSize: 20,
      fontFamily: bold,
      color: '#111827',
      marginBottom: 3,
    },
    scoreLabel: {
      fontSize: 8,
      color: '#9ca3af',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    scoreGreen: { color: '#16a34a' },
    scoreAmber: { color: '#d97706' },
    scoreRed: { color: '#dc2626' },
    scoreNeutral: { color: '#9ca3af' },
    bodyText: {
      fontSize: 11,
      color: '#374151',
      lineHeight: 1.6,
    },
    bulletRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 5,
      gap: 8,
    },
    bulletNum: {
      fontSize: 10,
      fontFamily: bold,
      color: accent,
      width: 16,
      marginTop: 1,
    },
    bulletText: {
      flex: 1,
      fontSize: 11,
      color: '#374151',
      lineHeight: 1.5,
    },
    issueRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 5,
      gap: 8,
    },
    // Drawn circle — built-in Helvetica has no "●" glyph (it rendered as "ï")
    bulletDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginTop: 5,
      marginRight: 6,
    },
    dotGreen: { backgroundColor: '#16a34a' },
    dotAmber: { backgroundColor: '#d97706' },
    dotRed: { backgroundColor: '#dc2626' },
    issueText: {
      flex: 1,
      fontSize: 10,
      color: '#374151',
      lineHeight: 1.5,
    },
    issueValue: {
      fontSize: 9,
      color: '#6b7280',
    },
    link: {
      color: accent,
      textDecoration: 'none',
    },
    divider: {
      borderBottomWidth: 1,
      borderBottomColor: '#e5e7eb',
      borderBottomStyle: 'solid',
      marginBottom: 22,
    },
    footer: {
      position: 'absolute',
      bottom: 32,
      left: 48,
      right: 48,
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderTopWidth: 1,
      borderTopColor: '#e5e7eb',
      borderTopStyle: 'solid',
      paddingTop: 10,
    },
    footerText: {
      fontSize: 9,
      color: '#9ca3af',
    },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 10,
      gap: 12,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    legendDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    legendText: {
      fontSize: 8.5,
      color: '#6b7280',
    },
    definitions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 8,
    },
    definition: {
      width: '50%',
      fontSize: 8.5,
      color: '#6b7280',
      marginBottom: 3,
      paddingRight: 8,
    },
    definitionTerm: {
      fontFamily: bold,
      color: '#374151',
    },
    readinessBlock: {
      marginBottom: 12,
    },
    readinessHead: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 6,
    },
    readinessTitle: {
      fontSize: 9,
      fontFamily: bold,
      color: '#111827',
    },
    readinessScore: {
      fontSize: 9,
      fontFamily: bold,
    },
    findingBody: {
      flex: 1,
    },
    // Not issueText: its flex: 1 collapses the height inside a column and lines overlap
    findingLabel: {
      fontSize: 10,
      color: '#374151',
      lineHeight: 1.5,
    },
    findingDetail: {
      fontSize: 8.5,
      color: '#6b7280',
      marginTop: 1,
    },
    problemTitle: {
      fontSize: 10,
      fontFamily: bold,
      color: '#111827',
      marginBottom: 1,
    },
    noIssues: {
      fontSize: 10,
      color: '#16a34a',
    },
    ctaBox: {
      backgroundColor: design.accent ? tint(design.accent, 0.9) : DEFAULT_TINT,
      borderRadius: 8,
      padding: 16,
      marginBottom: 22,
    },
    ctaTitle: {
      fontSize: 13,
      fontFamily: bold,
      color: '#111827',
      marginBottom: 4,
    },
    ctaText: {
      fontSize: 10.5,
      color: '#374151',
      lineHeight: 1.5,
    },
    ctaContact: {
      fontSize: 10,
      color: '#374151',
      marginTop: 8,
    },
    ctaButtons: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 10,
    },
    ctaButton: {
      backgroundColor: button,
      color: textOn(button),
      fontSize: 10,
      fontFamily: bold,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: button,
      textDecoration: 'none',
    },
    ctaButtonSecondary: {
      backgroundColor: '#ffffff',
      color: button,
    },
    // A section title with its icon
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginBottom: 8,
    },
  });
}

export type PdfStyles = ReturnType<typeof pdfStyles>;

/** The default design's: the score colours, which no design changes */
export const styles = pdfStyles(DEFAULT_DESIGN);

export function scoreColor(score: number | null) {
  if (score === null) return styles.scoreNeutral;
  if (score >= 80) return styles.scoreGreen;
  if (score >= 50) return styles.scoreAmber;
  return styles.scoreRed;
}
