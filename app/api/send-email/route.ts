// app/api/send-email/route.ts

// "Send email": one lead's outreach email, as edited in the dialog, in the
// account's brand (email/outreachEmail.ts) with the PDF report attached. Pro
// and Agency accounts send from the mailbox they connected in Settings; the
// owner without one sends from FROM_EMAIL (the Vercel mailbox, or Resend — see
// email/mailer.ts). The send date is saved so the lead isn't emailed twice by accident.
// An address Verifalia calls undeliverable is refused (email/leadEmailCheck.ts).
// With `preview: true` nothing is sent: the answer is the email's HTML.

import { NextRequest, NextResponse } from 'next/server';
import { getSession, unauthorized } from '@/app/_shared/lib/supabase/server';
import { renderAuditPdf } from '@/app/_shared/lib/audit/auditPdf';
import { BRAND_UNAVAILABLE, BrandUnavailable, brandFor, emailLogo } from '@/app/_shared/lib/brand/brand';
import type { Brand } from '@/app/_shared/lib/brand/brandRules';
import { blocksSending, checkReason } from '@/app/_shared/lib/email/emailCheck';
import { checkLeadEmail } from '@/app/_shared/lib/email/leadEmailCheck';
import { emailSetupProblem, sendEmail } from '@/app/_shared/lib/email/mailer';
import { outreachHtml, outreachText } from '@/app/_shared/lib/email/outreachEmail';
import { outreachProblem } from '@/app/_shared/lib/email/outreach';
import { mailboxFor } from '@/app/_shared/lib/email/senders';
import { planFor, planHas } from '@/app/_shared/lib/usage/plans';
import { sendAllowed } from '@/app/_shared/lib/usage/rateLimit';
import { featureMessage } from '@/app/_shared/lib/usage/usageCopy';
import { BUSINESS_WITH_AUDIT, withAuditData, type BusinessRow } from '@/app/_shared/lib/utils/businessRows';

// A function stopped mid-send would leave an email that went out unrecorded
export const maxDuration = 60;

const MIGRATION = 'docs/migrations/2026-10-02-emailed-at.sql';
// The header logo's content id in the sent email
const LOGO_CID = 'brand-logo';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { db, account } = session;
  if (!planHas(planFor(account).id, 'mailbox')) return NextResponse.json({ error: featureMessage('mailbox') }, { status: 403 });

  // Anything that isn't a JSON object (a bare null, a string) is treated as empty
  const parsed: unknown = await request.json().catch(() => null);
  const input = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
  const businessId: string = typeof input.business_id === 'string' ? input.business_id : '';
  const subject: string = typeof input.subject === 'string' ? input.subject : '';
  const text: string = typeof input.body === 'string' ? input.body : '';
  if (!businessId) return NextResponse.json({ error: 'business_id is required' }, { status: 400 });

  const problem = outreachProblem({ subject, body: text });
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const preview = input.preview === true;

  // The recipient always comes from the stored business, never from the request
  const { data } = await db.from('businesses').select(BUSINESS_WITH_AUDIT).eq('id', businessId).single();
  if (!data) return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  const business = withAuditData(data as BusinessRow);
  if (!business.email) return NextResponse.json({ error: 'This business has no email address.' }, { status: 400 });
  if (!business.audit || !business.ai_report) {
    return NextResponse.json({ error: 'Run the audit and AI summary first.' }, { status: 400 });
  }

  // Never sent under the wrong name: a profile that can't be read stops here
  let brand: Brand;
  try {
    brand = await brandFor(account.id);
  } catch (err) {
    if (!(err instanceof BrandUnavailable)) throw err;
    console.error('[send-email]', err.message);
    return NextResponse.json({ error: BRAND_UNAVAILABLE }, { status: 503 });
  }
  // Auditely's own brand has no contact: a paid account that left its name and company blank
  const { contact } = brand;
  if (!contact) {
    return NextResponse.json({ error: "Add your name or company in Settings, so the email says who it's from." }, { status: 400 });
  }

  const logo = await emailLogo(brand);
  // A request from devartventures.com asked for this email: no opt-out line
  const email = { body: text, business, audit: business.audit, brand: { ...brand, contact }, requested: Boolean(business.request) };
  if (preview) {
    // A browser can't load the email's attached logo, so the preview carries the image itself
    const logoSrc = logo && `data:${logo.contentType};base64,${logo.content.toString('base64')}`;
    return NextResponse.json({ html: outreachHtml({ ...email, logoSrc }) });
  }

  // The owner's own mail has no cap; everyone else's mailbox sends at a person's pace
  if (!account.isOwner && !sendAllowed(account.id)) {
    return NextResponse.json({ error: "You've sent 50 emails this hour. Try again later." }, { status: 429 });
  }
  const sender = await mailboxFor(account);
  if (!sender.ok) return NextResponse.json({ error: sender.error }, { status: sender.status });
  const { mailbox } = sender;
  // Only the Vercel mailbox depends on the Vercel settings
  const setupProblem = mailbox === 'env' ? emailSetupProblem() : null;
  if (setupProblem) return NextResponse.json({ error: setupProblem }, { status: 503 });

  // The dialog checked the address when it opened, so this normally reads the saved result
  const checked = await checkLeadEmail(db, { id: business.id, email: business.email, email_check: business.email_check });
  if (checked.state === 'checked' && blocksSending(checked.check)) {
    return NextResponse.json({ error: `Not sent: ${checkReason(checked.check)}`, email_check: checked.check }, { status: 400 });
  }

  const report = await renderAuditPdf(db, business.audit.id);
  if (!report.ok) return NextResponse.json({ error: report.error }, { status: report.status });

  const sent = await sendEmail(
    {
      to: business.email,
      subject: subject.trim(),
      text: outreachText({ ...email, logoSrc: null }),
      html: outreachHtml({ ...email, logoSrc: logo && `cid:${LOGO_CID}` }),
      attachments: [
        { filename: report.filename, content: report.pdf },
        ...(logo ? [{ filename: logo.filename, content: logo.content, cid: LOGO_CID }] : []),
      ],
    },
    mailbox === 'env' ? undefined : { settings: mailbox, fromName: contact.name ?? brand.name }
  );
  if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: sent.status });

  // The email has gone: a failed save must not read as a failed send, or it would be sent again
  const emailedAt = new Date().toISOString();
  const { error: saveError } = await db.from('businesses').update({ emailed_at: emailedAt }).eq('id', businessId);
  if (saveError) {
    console.error('[send-email] could not record the send:', saveError.message);
    // Only a missing column is fixed by the migration
    const warning = /emailed_at/.test(saveError.message)
      ? `Sent, but Auditely couldn't record it — run ${MIGRATION} in Supabase.`
      : "Sent, but the send date couldn't be saved: after a reload this lead won't show as emailed.";
    return NextResponse.json({ emailed_at: emailedAt, warning });
  }
  return NextResponse.json({ emailed_at: emailedAt });
}
