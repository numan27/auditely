// app/_shared/components/auditely/pdfDocument/pdfDocument.tsx

import { Document, Image, Page, Text, View, Link, Svg, Path } from '@react-pdf/renderer';
import { scoreColor, styles } from '@/app/_shared/components/auditely/pdfDocument/pdfStyles';
import { shortUrl } from '@/app/_shared/lib/utils/shortUrl';
import {
  InviteSection,
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

/** Whose report it is: the account's brand (reportData.ts pdfBrand) */
export interface PdfBrand {
  name: string;
  website: string | null;
  /** A PNG or JPEG data URL, shown beside the title */
  logo: string | null;
  /** Auditely's own brand (Free accounts): the report invites the reader to try Auditely instead of offering a call */
  invite: boolean;
  /** The call the "next step" box offers, as in "on a free call" */
  call: string;
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
  brand: PdfBrand;
  /** null leaves out the "next step" box and the footer's contact */
  contact: PdfContact | null;
  /** false leaves nothing to click: the brand is named, not linked (the Upwork version) */
  links?: boolean;
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
  brand,
  contact,
  links = true,
}: PdfDocumentProps) {
  const brandUrl = links ? brand.website : null;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={[styles.header, styles.headerRow]}>
          {/* A logo is an image, not a link: it stays in the Upwork version */}
          {/* eslint-disable-next-line jsx-a11y/alt-text -- a PDF image has no alt text */}
          {brand.logo ? <Image src={brand.logo} style={styles.headerLogo} /> : null}
          <View>
            <Text style={styles.headerTitle}>Website Audit Report</Text>
            <Text style={styles.headerSubtitle}>
              {brand.invite ? (
                `Prepared with ${brand.name} · ${auditDate}`
              ) : (
                <>
                  Prepared by {brandUrl ? <Link src={brandUrl} style={styles.link}>{brand.name}</Link> : brand.name} · {auditDate}
                </>
              )}
            </Text>
          </View>
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

        {contact && !brand.invite && <NextStepSection contact={contact} call={brand.call} />}
        {brand.invite && links && <InviteSection />}

        {/* Footer */}
        <View style={styles.footer} fixed>
          {/* Without the link it is the name: a PDF reader makes a bare domain clickable */}
          <Text style={styles.footerText}>
            Powered by{' '}
            {brandUrl ? <Link src={brandUrl} style={styles.link}>{shortUrl(brandUrl)}</Link> : brand.name}
          </Text>
          {contact && (
            <Text style={styles.footerText}>
              <Link src={`mailto:${contact.email}`} style={styles.link}>{contact.email}</Link>
            </Text>
          )}
        </View>
      </Page>
    </Document>
  );
}
