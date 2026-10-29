// app/_shared/components/auditely/pdfDocument/pdfDocument.tsx

// The PDF report: the header and the business, then the sections in the order
// the account's design (brandDesign.ts) gives them, each with its title and
// icon, and the footer. The default design draws today's report.

import { Fragment, type ReactNode } from 'react';
import { Document, Image, Page, Text, View, Link } from '@react-pdf/renderer';
import { pdfStyles } from '@/app/_shared/components/auditely/pdfDocument/pdfStyles';
import { DEFAULT_ACCENT } from '@/app/_shared/components/auditely/pdfDocument/pdfTheme';
import { ScoresSection } from '@/app/_shared/components/auditely/pdfDocument/pdfScores';
import { shortUrl } from '@/app/_shared/lib/utils/shortUrl';
import {
  DEFAULT_CTA_BUTTON,
  DEFAULT_TITLE,
  sectionIcon,
  sectionTitle,
  visibleSections,
  type BrandDesign,
  type SectionId,
} from '@/app/_shared/lib/brand/brandDesign';
import {
  FixesSection,
  InviteSection,
  LeadCaptureSection,
  NextStepSection,
  ProblemsSection,
  SearchReadinessSection,
  SummarySection,
  type SectionHead,
} from '@/app/_shared/components/auditely/pdfDocument/pdfSections';

// A rule follows these when another section comes after them, as in today's report
const RULED = new Set<SectionId>(['scores', 'problems', 'aiSearch', 'leads']);

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
  /** The Brand studio's design, its wording made safe for the PDF's fonts */
  design: BrandDesign;
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
  const { design } = brand;
  const s = pdfStyles(design);
  const brandUrl = links ? brand.website : null;
  const head = (id: SectionId): SectionHead => ({ title: sectionTitle(design, id), icon: sectionIcon(design, id), accent: design.accent ?? DEFAULT_ACCENT });
  const ctaText = design.ctaText ?? `We can walk you through every issue in this report on ${brand.call}, with no obligation.`;

  // null: nothing to show for this audit (an older audit never measured it, or there's no contact)
  const sections: Record<SectionId, ReactNode> = {
    scores: (
      <ScoresSection
        s={s}
        head={head('scores')}
        scores={{ performance: performanceScore, seo: seoScore, mobile: mobileScore, ssl: sslValid, geo: geoScore, aeo: aeoScore, leads: leadScore }}
      />
    ),
    // What it costs them, worst first
    problems: problems.length > 0 ? <ProblemsSection s={s} head={head('problems')} problems={problems} /> : null,
    // GEO / AEO findings — v1 audits never measured them
    aiSearch:
      geoScore !== null || aeoScore !== null ? (
        <SearchReadinessSection s={s} head={head('aiSearch')} geoScore={geoScore} aeoScore={aeoScore} geoFindings={geoFindings} aeoFindings={aeoFindings} />
      ) : null,
    // Lead capture — audits made before it show nothing
    leads: leadScore !== null ? <LeadCaptureSection s={s} head={head('leads')} score={leadScore} findings={leadFindings} /> : null,
    summary: <SummarySection s={s} head={head('summary')} summary={summary} />,
    fixes: improvements.length > 0 ? <FixesSection s={s} head={head('fixes')} improvements={improvements} /> : null,
    nextStep: brand.invite ? (
      links ? <InviteSection s={s} /> : null
    ) : contact ? (
      <NextStepSection s={s} head={head('nextStep')} contact={contact} text={ctaText} button={design.ctaButton ?? DEFAULT_CTA_BUTTON} />
    ) : null,
  };
  const shown = visibleSections(design).filter((id) => sections[id]);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={[s.header, s.headerRow]}>
          {/* A logo is an image, not a link: it stays in the Upwork version */}
          {/* eslint-disable-next-line jsx-a11y/alt-text -- a PDF image has no alt text */}
          {brand.logo ? <Image src={brand.logo} style={s.headerLogo} /> : null}
          <View>
            <Text style={s.headerTitle}>{design.title ?? DEFAULT_TITLE}</Text>
            <Text style={s.headerSubtitle}>
              {brand.invite ? (
                `Prepared with ${brand.name} · ${auditDate}`
              ) : (
                <>
                  Prepared by {brandUrl ? <Link src={brandUrl} style={s.headerLink}>{brand.name}</Link> : brand.name} · {auditDate}
                </>
              )}
            </Text>
          </View>
        </View>

        {/* Business Info */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Business</Text>
          <Text style={s.businessName}>{businessName}</Text>
          <Text style={s.businessMeta}>{website}</Text>
          <Text style={s.businessMeta}>{address}</Text>
          {phone ? <Text style={s.businessMeta}>{phone}</Text> : null}
        </View>

        <View style={s.divider} />

        {shown.map((id, i) => (
          <Fragment key={id}>
            {sections[id]}
            {RULED.has(id) && i < shown.length - 1 && <View style={s.divider} />}
          </Fragment>
        ))}

        {/* Footer */}
        <View style={s.footer} fixed>
          {/* Without the link it is the name: a PDF reader makes a bare domain clickable */}
          <Text style={s.footerText}>
            Powered by{' '}
            {brandUrl ? <Link src={brandUrl} style={s.link}>{shortUrl(brandUrl)}</Link> : brand.name}
          </Text>
          {contact && (
            <Text style={s.footerText}>
              <Link src={`mailto:${contact.email}`} style={s.link}>{contact.email}</Link>
            </Text>
          )}
        </View>
      </Page>
    </Document>
  );
}
