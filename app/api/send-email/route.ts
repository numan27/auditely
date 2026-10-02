// app/api/send-email/route.ts

// "Send email": one lead's outreach email, as edited in the dialog, sent from
// FROM_EMAIL with the PDF report attached. The send date is saved so the lead
// isn't emailed twice by accident.

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabase } from '@/app/_shared/lib/supabase/client';
import { renderAuditPdf } from '@/app/_shared/lib/audit/auditPdf';
import { outreachProblem } from '@/app/_shared/lib/email/outreach';
import { BUSINESS_WITH_AUDIT, withAuditData, type BusinessRow } from '@/app/_shared/lib/utils/businessRows';

const MIGRATION = 'docs/migrations/2026-10-02-emailed-at.sql';

export async function POST(request: NextRequest) {
  // Anything that isn't a JSON object (a bare null, a string) is treated as empty
  const parsed: unknown = await request.json().catch(() => null);
  const input = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
  const businessId: string = typeof input.business_id === 'string' ? input.business_id : '';
  const subject: string = typeof input.subject === 'string' ? input.subject : '';
  const text: string = typeof input.body === 'string' ? input.body : '';
  if (!businessId) return NextResponse.json({ error: 'business_id is required' }, { status: 400 });

  const problem = outreachProblem({ subject, body: text });
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.FROM_EMAIL;
  if (!apiKey || !from) {
    return NextResponse.json({ error: "Email sending isn't set up — add RESEND_API_KEY and FROM_EMAIL in Vercel." }, { status: 503 });
  }

  // The recipient always comes from the stored business, never from the request
  const { data } = await supabase.from('businesses').select(BUSINESS_WITH_AUDIT).eq('id', businessId).single();
  if (!data) return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  const business = withAuditData(data as BusinessRow);
  if (!business.email) return NextResponse.json({ error: 'This business has no email address.' }, { status: 400 });
  if (!business.audit || !business.ai_report) {
    return NextResponse.json({ error: 'Run the audit and AI summary first.' }, { status: 400 });
  }

  const report = await renderAuditPdf(business.audit.id);
  if (!report.ok) return NextResponse.json({ error: report.error }, { status: report.status });

  const replyTo = process.env.EMAIL_REPLY_TO;
  const bcc = process.env.EMAIL_BCC;
  try {
    // Resend reports a refusal (unverified domain, bad address) in `error` instead of throwing
    const { error } = await new Resend(apiKey).emails.send({
      from,
      to: business.email,
      subject: subject.trim(),
      text,
      ...(replyTo && { replyTo }),
      ...(bcc && { bcc }),
      attachments: [{ filename: report.filename, content: report.pdf }],
    });
    if (error) {
      console.error('[send-email] refused:', error.message);
      return NextResponse.json({ error: `The email wasn't sent: ${error.message}` }, { status: 502 });
    }
  } catch (err) {
    console.error('[send-email] failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "The email service couldn't be reached — try again." }, { status: 502 });
  }

  // The email has gone: a failed save must not read as a failed send, or it would be sent again
  const emailedAt = new Date().toISOString();
  const { error: saveError } = await supabase.from('businesses').update({ emailed_at: emailedAt }).eq('id', businessId);
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
