// app/api/studio/preview/route.ts

// The Brand studio's live preview: the demo's sample audit drawn as a PDF in
// the brand and design the user is editing, before anything is saved. With
// `format: 'email'` the answer is the sample's outreach email as HTML instead.
// It is always the sample business, so a Free account sees what the studio
// would do for it. Nothing is read from or written to the database.

import { NextRequest, NextResponse } from 'next/server';
import { renderPdf } from '@/app/_shared/lib/audit/pdfRender';
import { emailLogo } from '@/app/_shared/lib/brand/brand';
import { resolveBrand, type Brand } from '@/app/_shared/lib/brand/brandRules';
import { previewInput } from '@/app/_shared/lib/brand/studioInput';
import { demoData, SAMPLE_ID } from '@/app/_shared/lib/demo/demoData';
import { DEMO_SIGN_OFF, unbrandSignOff } from '@/app/_shared/lib/demo/unbrand';
import { outreachDraft } from '@/app/_shared/lib/email/outreach';
import { outreachHtml } from '@/app/_shared/lib/email/outreachEmail';
import { getSession, unauthorized } from '@/app/_shared/lib/supabase/server';

const sample = demoData.leads.find((b) => b.id === SAMPLE_ID);
const NO_SENDER = "Add your name or company under Brand, so the email says who it's from.";
const NO_STORE = { 'Cache-Control': 'no-store' };

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { account } = session;
  if (!sample?.audit || !sample.ai_report) return NextResponse.json({ error: 'The sample report is missing.' }, { status: 500 });

  const body: unknown = await request.json().catch(() => null);
  const { profile, design } = previewInput(body);
  // Drawn as a paid account would see it; the owner keeps their DevArtVentures defaults
  const brand = resolveBrand({
    profile: { email: account.email, ...profile, brand_design: design },
    isOwner: account.isOwner,
    plan: account.isOwner ? 'owner' : 'pro',
  });

  if (body && typeof body === 'object' && (body as Record<string, unknown>).format === 'email') {
    return NextResponse.json(await emailPreview(brand, sample, sample.audit, sample.ai_report.cold_email ?? ''), { headers: NO_STORE });
  }
  const pdf = await renderPdf(sample.audit, sample, sample.ai_report, brand);
  return new Response(new Uint8Array(pdf), { headers: { 'Content-Type': 'application/pdf', ...NO_STORE } });
}

type Sample = NonNullable<typeof sample>;

/** The sample's email, signed by the draft brand; a hint instead when there's no one to send it from */
async function emailPreview(brand: Brand, business: Sample, audit: NonNullable<Sample['audit']>, coldEmail: string) {
  const { contact } = brand;
  if (!contact) return { html: null, error: NO_SENDER };
  const draft = outreachDraft(unbrandSignOff(coldEmail), business.name);
  const text = draft.body.replace(DEMO_SIGN_OFF, brand.writer.signOff);
  // A browser can't load an attached logo, so the preview carries the image itself
  const logo = await emailLogo(brand);
  const logoSrc = logo && `data:${logo.contentType};base64,${logo.content.toString('base64')}`;
  return { html: outreachHtml({ body: text, business, audit, brand: { ...brand, contact }, logoSrc }) };
}
