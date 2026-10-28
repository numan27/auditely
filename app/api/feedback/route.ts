// app/api/feedback/route.ts

// A signed-in tester's feedback, emailed to OWNER_EMAIL from the app's own
// sending address with the tester as the reply-to, so the owner answers from
// their inbox. Nothing is stored. Ten an hour per account.

import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/app/_shared/lib/email/mailer';
import { FEEDBACK_FAILED, feedbackEmail, feedbackPage, feedbackProblem } from '@/app/_shared/lib/feedback/feedback';
import { getSession, unauthorized } from '@/app/_shared/lib/supabase/server';
import { planFor } from '@/app/_shared/lib/usage/plans';
import { FEEDBACK_PER_HOUR, feedbackAllowed } from '@/app/_shared/lib/usage/rateLimit';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { account } = session;

  const body: unknown = await request.json().catch(() => null);
  const { message, page } = (body ?? {}) as { message?: unknown; page?: unknown };
  if (typeof message !== 'string') return NextResponse.json({ error: 'Write a message first.' }, { status: 400 });
  const problem = feedbackProblem(message);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const owner = process.env.OWNER_EMAIL?.trim();
  if (!owner) return NextResponse.json({ error: "Feedback isn't set up yet. Try again later." }, { status: 503 });
  if (!feedbackAllowed(account.id)) {
    return NextResponse.json({ error: `You've sent ${FEEDBACK_PER_HOUR} messages this hour. Try again later.` }, { status: 429 });
  }

  const email = feedbackEmail({
    to: owner,
    message,
    from: account.email,
    plan: planFor(account).name,
    page: feedbackPage(page),
    sentAt: new Date(),
  });
  const sent = await sendEmail(email);
  if (!sent.ok) {
    console.error('[feedback] Not sent:', sent.error);
    return NextResponse.json({ error: FEEDBACK_FAILED }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
