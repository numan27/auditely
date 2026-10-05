// app/api/verify-email/route.ts

// The check the "Send email" dialog asks for when it opens: can mail to this
// lead's address be delivered? Answers from the result saved on the lead while
// it is fresh, otherwise asks Verifalia (email/leadEmailCheck.ts).

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/_shared/lib/supabase/client';
import { checkLeadEmail } from '@/app/_shared/lib/email/leadEmailCheck';

// Verifalia gets 20 seconds (email/verifalia.ts); the rest is the database
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  // Anything that isn't a JSON object (a bare null, a string) is treated as empty
  const parsed: unknown = await request.json().catch(() => null);
  const input = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
  const businessId: string = typeof input.business_id === 'string' ? input.business_id : '';
  if (!businessId) return NextResponse.json({ error: 'business_id is required' }, { status: 400 });

  // The address always comes from the stored business, never from the request.
  // `*` rather than the column's name: it must also work before the migration is run.
  const { data } = await supabase.from('businesses').select('*').eq('id', businessId).single();
  if (!data) return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  if (!data.email) return NextResponse.json({ error: 'This business has no email address.' }, { status: 400 });

  return NextResponse.json(await checkLeadEmail({ id: data.id, email: data.email, email_check: data.email_check }));
}
