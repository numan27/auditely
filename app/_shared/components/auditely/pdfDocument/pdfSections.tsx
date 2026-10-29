// app/_shared/components/auditely/pdfDocument/pdfSections.tsx

// Report sections that explain the scores and give the prospect a next step.
// Each is drawn in the account's design: its styles, and the title and icon
// the Brand studio gave the section.

import { Link, Path, Svg, Text, View } from '@react-pdf/renderer';
import { scoreColor, type PdfStyles } from '@/app/_shared/components/auditely/pdfDocument/pdfStyles';
import type { PdfContact, PdfFinding, PdfProblem } from '@/app/_shared/components/auditely/pdfDocument/pdfDocument';
import { ICONS, type IconId } from '@/app/_shared/lib/brand/brandIcons';
import { AUDITELY_URL } from '@/app/_shared/lib/config/site';

/** A section's title as the design names it, with its icon in the accent */
export interface SectionHead {
  title: string;
  icon: IconId | null;
  accent: string;
}

type TitleStyle = PdfStyles['sectionLabel'] | PdfStyles['ctaTitle'];

/** The section's title, with its icon beside it when the design gave it one */
export function SectionLabel({ s, head, style = s.sectionLabel, size = 11 }: { s: PdfStyles; head: SectionHead; style?: TitleStyle; size?: number }) {
  if (!head.icon) return <Text style={style}>{head.title}</Text>;
  return (
    <View style={[s.sectionHead, { marginBottom: style.marginBottom }]}>
      <Svg viewBox="0 0 24 24" style={{ width: size, height: size }}>
        {ICONS[head.icon].paths.map((d) => (
          <Path key={d} d={d} stroke={head.accent} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        ))}
      </Svg>
      <Text style={[style, { marginBottom: 0 }]}>{head.title}</Text>
    </View>
  );
}

function ReadinessBlock({ s, title, score, findings }: { s: PdfStyles; title: string; score: number | null; findings: PdfFinding[] }) {
  return (
    // wrap={false}: a block (at most 6 findings) never splits across pages
    <View style={s.readinessBlock} wrap={false}>
      <View style={s.readinessHead}>
        <Text style={s.readinessTitle}>{title}</Text>
        <Text style={[s.readinessScore, scoreColor(score)]}>{score === null ? '—' : `${score}/100`}</Text>
      </View>
      {findings.length === 0 ? (
        <Text style={s.noIssues}>No issues found</Text>
      ) : (
        findings.map((finding, i) => (
          <View key={i} style={s.issueRow}>
            <View style={[s.bulletDot, finding.status === 'fail' ? s.dotRed : s.dotAmber]} />
            <View style={s.findingBody}>
              <Text style={s.findingLabel}>{finding.label}</Text>
              {finding.detail ? <Text style={s.findingDetail}>{finding.detail}</Text> : null}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

interface SearchReadinessProps {
  s: PdfStyles;
  head: SectionHead;
  geoScore: number | null;
  aeoScore: number | null;
  geoFindings: PdfFinding[];
  aeoFindings: PdfFinding[];
}

export function SearchReadinessSection({ s, head, geoScore, aeoScore, geoFindings, aeoFindings }: SearchReadinessProps) {
  return (
    <View style={s.section}>
      {/* Heading moves with the GEO block so it's never stranded at a page bottom */}
      <View wrap={false}>
        <SectionLabel s={s} head={head} />
        <ReadinessBlock s={s} title="GEO — AI search visibility" score={geoScore} findings={geoFindings} />
      </View>
      <ReadinessBlock s={s} title="AEO — Answer-engine readiness" score={aeoScore} findings={aeoFindings} />
    </View>
  );
}

export function LeadCaptureSection({ s, head, score, findings }: { s: PdfStyles; head: SectionHead; score: number | null; findings: PdfFinding[] }) {
  return (
    <View style={s.section} wrap={false}>
      <SectionLabel s={s} head={head} />
      <ReadinessBlock s={s} title="Can visitors reach you?" score={score} findings={findings} />
    </View>
  );
}

export function SummarySection({ s, head, summary }: { s: PdfStyles; head: SectionHead; summary: string }) {
  return (
    <View style={s.section}>
      <SectionLabel s={s} head={head} />
      <Text style={s.bodyText}>{summary}</Text>
    </View>
  );
}

/** The library's fixes for the problems above */
export function FixesSection({ s, head, improvements }: { s: PdfStyles; head: SectionHead; improvements: string[] }) {
  return (
    <View style={s.section} wrap={false}>
      <SectionLabel s={s} head={head} />
      {improvements.map((item, i) => (
        <View key={i} style={s.bulletRow}>
          <Text style={s.bulletNum}>{i + 1}.</Text>
          <Text style={s.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

interface NextStepProps {
  s: PdfStyles;
  head: SectionHead;
  contact: PdfContact;
  /** The design's sentence and button, already worded */
  text: string;
  button: string;
}

export function NextStepSection({ s, head, contact, text, button }: NextStepProps) {
  const details = [contact.name, contact.phone, contact.email].filter(Boolean).join('  ·  ');
  return (
    <View style={s.ctaBox} wrap={false}>
      <SectionLabel s={s} head={head} style={s.ctaTitle} size={14} />
      <Text style={s.ctaText}>{text}</Text>
      <Text style={s.ctaContact}>{details}</Text>
      {/* Calendly when set, otherwise email; "Contact us" only alongside Calendly */}
      <View style={s.ctaButtons}>
        <Link src={contact.bookingUrl ?? `mailto:${contact.email}`} style={s.ctaButton}>
          {button}
        </Link>
        {contact.bookingUrl ? (
          <Link src={`mailto:${contact.email}`} style={[s.ctaButton, s.ctaButtonSecondary]}>
            Contact us
          </Link>
        ) : null}
      </View>
    </View>
  );
}

/** A Free account's report, in place of the "next step" box: the reader is invited to try Auditely */
export function InviteSection({ s }: { s: PdfStyles }) {
  return (
    <View style={s.ctaBox} wrap={false}>
      <Text style={s.ctaTitle}>Audited with Auditely</Text>
      <Text style={s.ctaText}>
        Auditely finds local businesses and checks their websites for what&apos;s costing them customers. Try it free.
      </Text>
      <View style={s.ctaButtons}>
        <Link src={AUDITELY_URL} style={s.ctaButton}>
          Try Auditely free
        </Link>
      </View>
    </View>
  );
}

export function ProblemsSection({ s, head, problems }: { s: PdfStyles; head: SectionHead; problems: PdfProblem[] }) {
  return (
    <View style={s.section} wrap={false}>
      <SectionLabel s={s} head={head} />
      {problems.map((p, i) => (
        <View key={i} style={s.issueRow}>
          <View style={[s.bulletDot, s.dotRed]} />
          <View style={s.findingBody}>
            <Text style={s.problemTitle}>{p.problem}</Text>
            {p.cost ? <Text style={s.findingLabel}>{p.cost}</Text> : null}
            {p.stat ? <Text style={s.findingDetail}>{p.stat}</Text> : null}
            {p.evidence ? <Text style={s.findingDetail}>{p.evidence}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}
