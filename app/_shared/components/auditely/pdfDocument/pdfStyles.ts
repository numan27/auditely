// app/_shared/components/auditely/pdfDocument/pdfStyles.ts

import { Font, StyleSheet } from '@react-pdf/renderer';

// No automatic hyphenation — it splits short labels ("list-ing") in narrow rows
Font.registerHyphenationCallback((word) => [word]);

export const styles = StyleSheet.create({
  page: {
    padding: 48,
    // Clears the fixed footer when the report runs onto a second page
    paddingBottom: 72,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
    fontSize: 11,
    color: '#374151',
  },
  header: {
    marginBottom: 28,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#6366f1',
    borderBottomStyle: 'solid',
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 10,
    color: '#9ca3af',
  },
  section: {
    marginBottom: 22,
  },
  sectionLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#6366f1',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  businessName: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
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
    fontFamily: 'Helvetica-Bold',
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
    fontFamily: 'Helvetica-Bold',
    color: '#6366f1',
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
    color: '#6366f1',
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
    fontFamily: 'Helvetica-Bold',
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
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
  },
  readinessScore: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
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
  noIssues: {
    fontSize: 10,
    color: '#16a34a',
  },
  ctaBox: {
    backgroundColor: '#eef2ff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 22,
  },
  ctaTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
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
    backgroundColor: '#6366f1',
    color: '#ffffff',
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#6366f1',
    textDecoration: 'none',
  },
  ctaButtonSecondary: {
    backgroundColor: '#ffffff',
    color: '#6366f1',
  },
});

export function scoreColor(score: number | null) {
  if (score === null) return styles.scoreNeutral;
  if (score >= 80) return styles.scoreGreen;
  if (score >= 50) return styles.scoreAmber;
  return styles.scoreRed;
}
