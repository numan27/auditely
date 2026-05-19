// app/_shared/components/auditely/pdfDocument/pdfDocument.tsx

import { Document, Page, Text, View, StyleSheet, Link } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 48,
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
    gap: 10,
  },
  scoreBox: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    padding: 10,
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
  issueDot: {
    fontSize: 9,
    color: '#dc2626',
    width: 12,
    marginTop: 1,
  },
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
});

function scoreColor(score: number) {
  if (score >= 80) return styles.scoreGreen;
  if (score >= 50) return styles.scoreAmber;
  return styles.scoreRed;
}

export interface PdfDocumentProps {
  businessName: string;
  website: string;
  address: string;
  phone: string | null;
  auditDate: string;
  performanceScore: number;
  seoScore: number;
  mobileScore: number;
  sslValid: boolean;
  topIssues?: { title: string; displayValue?: string }[];
  summary: string;
  improvements: string[];
}

export function PdfDocument({
  businessName,
  website,
  address,
  phone,
  auditDate,
  performanceScore,
  seoScore,
  mobileScore,
  sslValid,
  topIssues,
  summary,
  improvements,
}: PdfDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Website Audit Report</Text>
          <Text style={styles.headerSubtitle}>
            Prepared by <Link src="https://devartventures.com" style={styles.link}>DevArtVentures</Link> · {auditDate}
          </Text>
        </View>

        {/* Business Info */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Business</Text>
          <Text style={styles.businessName}>{businessName}</Text>
          <Text style={styles.businessMeta}>{website}</Text>
          <Text style={styles.businessMeta}>{address}</Text>
          {phone ? <Text style={styles.businessMeta}>{phone}</Text> : null}
        </View>

        <View style={styles.divider} />

        {/* Scores */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Audit Scores</Text>
          <View style={styles.scoresRow}>
            <View style={styles.scoreBox}>
              <Text style={[styles.scoreValue, scoreColor(performanceScore)]}>
                {performanceScore}
              </Text>
              <Text style={styles.scoreLabel}>Performance</Text>
            </View>
            <View style={styles.scoreBox}>
              <Text style={[styles.scoreValue, scoreColor(seoScore)]}>
                {seoScore}
              </Text>
              <Text style={styles.scoreLabel}>SEO</Text>
            </View>
            <View style={styles.scoreBox}>
              <Text style={[styles.scoreValue, scoreColor(mobileScore)]}>
                {mobileScore}
              </Text>
              <Text style={styles.scoreLabel}>Mobile</Text>
            </View>
            <View style={styles.scoreBox}>
              <Text
                style={[
                  styles.scoreValue,
                  sslValid ? styles.scoreGreen : styles.scoreRed,
                ]}
              >
                {sslValid ? '✓' : 'X'}
              </Text>
              <Text style={styles.scoreLabel}>SSL</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Top Issues */}
        {topIssues && topIssues.length > 0 && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Top Issues Found</Text>
              {topIssues.map((issue, i) => (
                <View key={i} style={styles.issueRow}>
                  <Text style={styles.issueDot}>●</Text>
                  <Text style={styles.issueText}>
                    {issue.title}
                    {issue.displayValue ? (
                      <Text style={styles.issueValue}> ({issue.displayValue})</Text>
                    ) : null}
                  </Text>
                </View>
              ))}
            </View>
            <View style={styles.divider} />
          </>
        )}

        {/* AI Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>AI Summary</Text>
          <Text style={styles.bodyText}>{summary}</Text>
        </View>

        {/* Improvements */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Recommended Improvements</Text>
          {improvements.map((item, i) => (
            <View key={i} style={styles.bulletRow}>
              <Text style={styles.bulletNum}>{i + 1}.</Text>
              <Text style={styles.bulletText}>{item}</Text>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Powered by{' '}
            <Link src="https://devartventures.com" style={styles.link}>devartventures.com</Link>
          </Text>
          <Text style={styles.footerText}>
            <Link src="mailto:contact@devartventures.com" style={styles.link}>contact@devartventures.com</Link>
          </Text>
        </View>
      </Page>
    </Document>
  );
}
