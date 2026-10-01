// app/_shared/components/auditely/pdfDocument/pdfSections.tsx

// Report sections that explain the scores and give the prospect a next step.

import { Link, Text, View } from '@react-pdf/renderer';
import { scoreColor, styles } from '@/app/_shared/components/auditely/pdfDocument/pdfStyles';
import type { PdfContact, PdfFinding, PdfProblem } from '@/app/_shared/components/auditely/pdfDocument/pdfDocument';

const SCORE_DEFINITIONS: [string, string][] = [
  ['Performance', 'page speed on desktop'],
  ['Mobile', 'page speed on phones'],
  ['SEO', 'how well Google can read and index the site'],
  ['SSL', 'secure (https) connection'],
  ['GEO', 'how clearly AI search tools like ChatGPT can identify the business'],
  ['AEO', 'how ready the content is to be quoted as a direct answer'],
  ['Leads', 'how easily visitors can call, message or book'],
];

function LegendItem({ dot, text }: { dot: typeof styles.dotGreen; text: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, dot]} />
      <Text style={styles.legendText}>{text}</Text>
    </View>
  );
}

export function ScoreLegend() {
  return (
    <View>
      <View style={styles.legendRow}>
        <Text style={styles.legendText}>Scores are out of 100:</Text>
        <LegendItem dot={styles.dotGreen} text="80–100 good" />
        <LegendItem dot={styles.dotAmber} text="50–79 needs work" />
        <LegendItem dot={styles.dotRed} text="0–49 poor" />
      </View>
      <View style={styles.definitions}>
        {SCORE_DEFINITIONS.map(([term, meaning]) => (
          <Text key={term} style={styles.definition}>
            <Text style={styles.definitionTerm}>{term}</Text> — {meaning}
          </Text>
        ))}
      </View>
    </View>
  );
}

function ReadinessBlock({ title, score, findings }: { title: string; score: number | null; findings: PdfFinding[] }) {
  return (
    // wrap={false}: a block (at most 6 findings) never splits across pages
    <View style={styles.readinessBlock} wrap={false}>
      <View style={styles.readinessHead}>
        <Text style={styles.readinessTitle}>{title}</Text>
        <Text style={[styles.readinessScore, scoreColor(score)]}>{score === null ? '—' : `${score}/100`}</Text>
      </View>
      {findings.length === 0 ? (
        <Text style={styles.noIssues}>No issues found</Text>
      ) : (
        findings.map((finding, i) => (
          <View key={i} style={styles.issueRow}>
            <View style={[styles.bulletDot, finding.status === 'fail' ? styles.dotRed : styles.dotAmber]} />
            <View style={styles.findingBody}>
              <Text style={styles.findingLabel}>{finding.label}</Text>
              {finding.detail ? <Text style={styles.findingDetail}>{finding.detail}</Text> : null}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

interface SearchReadinessProps {
  geoScore: number | null;
  aeoScore: number | null;
  geoFindings: PdfFinding[];
  aeoFindings: PdfFinding[];
}

export function SearchReadinessSection({ geoScore, aeoScore, geoFindings, aeoFindings }: SearchReadinessProps) {
  return (
    <View style={styles.section}>
      {/* Heading moves with the GEO block so it's never stranded at a page bottom */}
      <View wrap={false}>
        <Text style={styles.sectionLabel}>AI Search Readiness</Text>
        <ReadinessBlock title="GEO — AI search visibility" score={geoScore} findings={geoFindings} />
      </View>
      <ReadinessBlock title="AEO — Answer-engine readiness" score={aeoScore} findings={aeoFindings} />
    </View>
  );
}

export function LeadCaptureSection({ score, findings }: { score: number | null; findings: PdfFinding[] }) {
  return (
    <View style={styles.section} wrap={false}>
      <Text style={styles.sectionLabel}>Lead Capture</Text>
      <ReadinessBlock title="Can visitors reach you?" score={score} findings={findings} />
    </View>
  );
}

export function NextStepSection({ contact }: { contact: PdfContact }) {
  const details = [contact.name, contact.phone, contact.email].filter(Boolean).join('  ·  ');
  return (
    <View style={styles.ctaBox} wrap={false}>
      <Text style={styles.ctaTitle}>Want help fixing these?</Text>
      <Text style={styles.ctaText}>
        We can walk you through every issue in this report on a free 15-minute call, with no obligation.
      </Text>
      <Text style={styles.ctaContact}>{details}</Text>
      {/* Calendly when set, otherwise email; "Contact us" only alongside Calendly */}
      <View style={styles.ctaButtons}>
        <Link src={contact.bookingUrl ?? `mailto:${contact.email}`} style={styles.ctaButton}>
          Book your free call
        </Link>
        {contact.bookingUrl ? (
          <Link src={`mailto:${contact.email}`} style={[styles.ctaButton, styles.ctaButtonSecondary]}>
            Contact us
          </Link>
        ) : null}
      </View>
    </View>
  );
}

export function ProblemsSection({ problems }: { problems: PdfProblem[] }) {
  return (
    <View style={styles.section} wrap={false}>
      <Text style={styles.sectionLabel}>What&apos;s Costing You Customers</Text>
      {problems.map((p, i) => (
        <View key={i} style={styles.issueRow}>
          <View style={[styles.bulletDot, styles.dotRed]} />
          <View style={styles.findingBody}>
            <Text style={styles.problemTitle}>{p.problem}</Text>
            {p.cost ? <Text style={styles.findingLabel}>{p.cost}</Text> : null}
            {p.stat ? <Text style={styles.findingDetail}>{p.stat}</Text> : null}
            {p.evidence ? <Text style={styles.findingDetail}>{p.evidence}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}
