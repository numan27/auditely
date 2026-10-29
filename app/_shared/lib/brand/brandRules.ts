// app/_shared/lib/brand/brandRules.ts

// Whose name is on an account's reports and emails. The owner's account keeps
// today's DevArtVentures details wherever its profile is blank; a paid account
// (or a tester given a paid plan) with a name or company gets its own, beta or
// not; everyone else, Free included, gets Auditely's neutral brand,
// which invites the reader to try Auditely. The AI writes as the brand's writer.
// The owner and branded accounts also get the look they saved in the Brand
// studio (brandDesign.ts); the Auditely brand keeps its own. No I/O: brand.ts
// reads the profile.

import type { PdfContact } from '@/app/_shared/components/auditely/pdfDocument/pdfDocument';
import { DEFAULT_DESIGN, readDesign, type BrandDesign } from '@/app/_shared/lib/brand/brandDesign';
import { reportContact } from '@/app/_shared/lib/config/reportContact';
import { AUDITELY_NAME, AUDITELY_URL } from '@/app/_shared/lib/config/site';
import { planHas, type PlanId } from '@/app/_shared/lib/usage/plans';

export type BrandKind = 'owner' | 'account' | 'auditely';

export interface BrandLogo {
  contentType: 'image/png' | 'image/jpeg';
  dataUrl: string;
}

/** Who the AI writes for, and how it signs the email */
export interface ReportWriter {
  about: string;
  signOff: string;
}

/** An account's row in `profiles`; every field but the email may be blank */
export interface Profile {
  email: string;
  display_name: string | null;
  company: string | null;
  website: string | null;
  logo_data_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  booking_url: string | null;
  /** The Brand studio's design, as saved; absent before the brand studio migration */
  brand_design?: unknown;
}

export interface Brand {
  kind: BrandKind;
  name: string;
  website: string | null;
  tagline: string | null;
  /** The colours across the top of the email; null leaves the stripe out */
  stripe: readonly string[] | null;
  logo: BrandLogo | null;
  /** Who the prospect contacts; null for the Auditely brand, which invites them to try Auditely instead */
  contact: PdfContact | null;
  /** The call the "next step" box offers, as in "on a free call" */
  call: string;
  writer: ReportWriter;
  /** Colours, type, sections and wording from the Brand studio */
  design: BrandDesign;
}

/** The owner's account as it was before profiles: devartventures.com's details */
export const OWNER_BRAND = {
  name: 'DevArtVentures',
  website: 'https://devartventures.com',
  tagline: 'Web engineering for growing businesses',
  // The logo's four shapes
  stripe: ['#2fbf7d', '#3e9feb', '#ec6a45', '#f9cf6e'],
  about: 'DevArtVentures, a web agency',
} as const;

const OWNER_CALL = 'a free 30-minute call';
const CALL = 'a free call';

/** Auditely's own neutral voice: accounts without a brand of their own, and free audits */
export const AUDITELY_WRITER: ReportWriter = { about: 'a web consultant', signOff: '[Your name]' };

const AUDITELY_BRAND: Brand = {
  kind: 'auditely',
  name: AUDITELY_NAME,
  website: AUDITELY_URL,
  tagline: null,
  stripe: null,
  logo: null,
  contact: null,
  call: CALL,
  writer: AUDITELY_WRITER,
  design: DEFAULT_DESIGN,
};

const BLANK: Omit<Profile, 'email'> = {
  display_name: null,
  company: null,
  website: null,
  logo_data_url: null,
  contact_email: null,
  contact_phone: null,
  booking_url: null,
};

const LOGO = /^data:(image\/(?:png|jpeg));base64,/;

/** A stored logo (profileInput.ts checked it on the way in) with its type; null without one */
export function logoFromDataUrl(dataUrl: string | null): BrandLogo | null {
  const type = dataUrl?.match(LOGO)?.[1];
  return dataUrl && type ? { contentType: type as BrandLogo['contentType'], dataUrl } : null;
}

export function resolveBrand(
  input: { profile: Profile | null; isOwner: boolean; plan: PlanId },
  ownerContact: PdfContact = reportContact()
): Brand {
  const { isOwner, plan } = input;
  const profile = { ...BLANK, ...input.profile };
  const logo = logoFromDataUrl(profile.logo_data_url);

  if (isOwner) {
    const name = profile.company ?? OWNER_BRAND.name;
    const contact: PdfContact = {
      name: profile.display_name ?? ownerContact.name,
      phone: profile.contact_phone ?? ownerContact.phone,
      email: profile.contact_email ?? ownerContact.email,
      bookingUrl: profile.booking_url ?? ownerContact.bookingUrl,
    };
    // DevArtVentures' tagline and colours only while the brand is still DevArtVentures
    const devArt = !profile.company;
    return {
      kind: 'owner',
      name,
      website: profile.website ?? OWNER_BRAND.website,
      tagline: devArt ? OWNER_BRAND.tagline : null,
      stripe: devArt ? OWNER_BRAND.stripe : null,
      logo,
      contact,
      call: OWNER_CALL,
      writer: {
        about: profile.company ?? OWNER_BRAND.about,
        signOff: contact.name ? `${contact.name}, ${name}` : `The ${name} team`,
      },
      design: readDesign(profile.brand_design),
    };
  }

  const { display_name: person, company } = profile;
  if (!planHas(plan, 'branding') || !input.profile || !(company || person)) return AUDITELY_BRAND;

  return {
    kind: 'account',
    name: (company ?? person)!,
    website: profile.website,
    tagline: null,
    stripe: null,
    logo,
    contact: {
      name: person,
      phone: profile.contact_phone,
      email: profile.contact_email ?? input.profile.email,
      bookingUrl: profile.booking_url,
    },
    call: CALL,
    writer: {
      about: company ?? `${person}, a web consultant`,
      signOff: person && company ? `${person}, ${company}` : company ? `The ${company} team` : person!,
    },
    design: readDesign(profile.brand_design),
  };
}
