// app/_shared/components/auditely/pdfDocument/pdfDocument.tsx

import { Document, Page, Text, View, Link, Svg, Path } from '@react-pdf/renderer';
import { scoreColor, styles } from '@/app/_shared/components/auditely/pdfDocument/pdfStyles';
import {
  LeadCaptureSection,
  NextStepSection,
  ProblemsSection,
  ScoreLegend,
  SearchReadinessSection,
} from '@/app/_shared/components/auditely/pdfDocument/pdfSections';

// null = not measured → "—"
function ScoreTile({ label, score }: { label: string; score: number | null }) {
  return (
    <View style={styles.scoreBox}>
      <Text style={[styles.scoreValue, scoreColor(score)]}>{score ?? '—'}</Text>
      <Text style={styles.scoreLabel}>{label}</Text>
    </View>
  );
}

// The tick is drawn — built-in Helvetica has no "✓" glyph (it rendered blank)
function SslTile({ valid }: { valid: boolean | null }) {
  const color = valid === null ? styles.scoreNeutral : valid ? styles.scoreGreen : styles.scoreRed;
  return (
    <View style={styles.scoreBox}>
      {valid ? (
        <Svg width={21} height={21} viewBox="0 0 24 24" style={{ marginBottom: 3 }}>
          <Path
            d="M5 12.5l4.5 4.5L19 7.5"
            stroke={styles.scoreGreen.color}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      ) : (
        <Text style={[styles.scoreValue, color]}>{valid === null ? '—' : 'X'}</Text>
      )}
      <Text style={styles.scoreLabel}>SSL</Text>
    </View>
  );
}

export interface PdfFinding {
  status: 'fail' | 'warn';
  label: string;
  detail?: string;
}

/** A problem in owner language (see impact.ts) */
export interface PdfProblem {
  problem: string;
  cost: string;
  evidence?: string;
  /** A statistic with its source in brackets */
  stat?: string;
}

/** Who the prospect contacts — see reportContact() */
export interface PdfContact {
  name: string | null;
  phone: string | null;
  email: string;
  bookingUrl: string | null;
}

export interface PdfDocumentProps {
  businessName: string;
  website: string;
  address: string;
  phone: string | null;
  auditDate: string;
  performanceScore: number | null;
  seoScore: number | null;
  mobileScore: number | null;
  sslValid: boolean | null;
  geoScore: number | null;
  aeoScore: number | null;
  problems: PdfProblem[];
  geoFindings: PdfFinding[];
  aeoFindings: PdfFinding[];
  leadScore: number | null;
  leadFindings: PdfFinding[];
  summary: string;
  improvements: string[];
  contact: PdfContact;
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
  geoScore,
  aeoScore,
  problems,
  geoFindings,
  aeoFindings,
  leadScore,
  leadFindings,
  summary,
  improvements,
  contact,
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
            <ScoreTile label="Performance" score={performanceScore} />
            <ScoreTile label="SEO" score={seoScore} />
            <ScoreTile label="Mobile" score={mobileScore} />
            <SslTile valid={sslValid} />
            <ScoreTile label="GEO" score={geoScore} />
            <ScoreTile label="AEO" score={aeoScore} />
            <ScoreTile label="Leads" score={leadScore} />
          </View>
          <ScoreLegend />
        </View>

        <View style={styles.divider} />

        {/* What it costs them, worst first */}
        {problems.length > 0 && (
          <>
            <ProblemsSection problems={problems} />
            <View style={styles.divider} />
          </>
        )}

        {/* GEO / AEO findings — v1 audits never measured them */}
        {(geoScore !== null || aeoScore !== null) && (
          <>
            <SearchReadinessSection
              geoScore={geoScore}
              aeoScore={aeoScore}
              geoFindings={geoFindings}
              aeoFindings={aeoFindings}
            />
            <View style={styles.divider} />
          </>
        )}

        {/* Lead capture — audits made before it show nothing */}
        {leadScore !== null && (
          <>
            <LeadCaptureSection score={leadScore} findings={leadFindings} />
            <View style={styles.divider} />
          </>
        )}

        {/* Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Summary</Text>
          <Text style={styles.bodyText}>{summary}</Text>
        </View>

        {/* Improvements: the library's fixes for the problems above */}
        {improvements.length > 0 && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionLabel}>How We&apos;d Fix It</Text>
            {improvements.map((item, i) => (
              <View key={i} style={styles.bulletRow}>
                <Text style={styles.bulletNum}>{i + 1}.</Text>
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))}
          </View>
        )}

        <NextStepSection contact={contact} />

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Powered by{' '}
            <Link src="https://devartventures.com" style={styles.link}>devartventures.com</Link>
          </Text>
          <Text style={styles.footerText}>
            <Link src={`mailto:${contact.email}`} style={styles.link}>{contact.email}</Link>
          </Text>
        </View>
      </Page>
    </Document>
  );
}
