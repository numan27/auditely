// app/api/contact/route.ts

// The public contact form's message, emailed to OWNER_EMAIL from the app's own
// sending address with the sender as the reply-to, so the team answers from their
// inbox. Nothing is stored. Open to everyone, so BotID checks the browser, a
// hidden field catches the scripts that fill every box, and one network may send
// five an hour.

import { NextRequest, NextResponse } from 'next/server';
import { checkBotId } from 'botid/server';
import { CONTACT_FAILED, contactEmail, contactFieldsFrom, contactProblems } from '@/app/_shared/lib/contact/contact';
import { sendEmail } from '@/app/_shared/lib/email/mailer';
import { visitorIp } from '@/app/_shared/lib/freeAudit/freeAuditRules';
import { CONTACT_PER_HOUR, contactAllowed } from '@/app/_shared/lib/usage/rateLimit';

const refuse = (status: number, error: string) => NextResponse.json({ error }, { status });

export async function POST(request: NextRequest) {
  if ((await checkBotId()).isBot) {
    return refuse(403, "Couldn't send your message from this browser. Try another browser, or try again later.");
  }

  const body: unknown = await request.json().catch(() => null);
  // Only a script fills the hidden field: it's told the message went, so it doesn't try again
  const trap = (body as { website?: unknown } | null)?.website;
  if (typeof trap === 'string' && trap.trim()) return NextResponse.json({ ok: true });

  const fields = contactFieldsFrom(body);
  const problems = contactProblems(fields);
  const first = Object.values(problems)[0];
  if (first) return NextResponse.json({ error: first, problems }, { status: 400 });

  const owner = process.env.OWNER_EMAIL?.trim();
  if (!owner) return refuse(503, "Messages can't be sent yet. Try again later.");
  if (!contactAllowed(visitorIp(request.headers))) {
    return refuse(429, `You've sent ${CONTACT_PER_HOUR} messages this hour. Try again later.`);
  }

  const sent = await sendEmail(contactEmail({ to: owner, fields, sentAt: new Date() }));
  if (!sent.ok) {
    console.error('[contact] Not sent:', sent.error);
    return refuse(502, CONTACT_FAILED);
  }
  return NextResponse.json({ ok: true });
}
