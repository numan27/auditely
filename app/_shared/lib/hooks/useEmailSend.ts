// app/_shared/lib/hooks/useEmailSend.ts

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { API_ROUTES } from '@/app/_shared/lib/config/routes';
import { asEmailCheck, checkFor, freshCheck, type EmailCheck, type EmailCheckResult } from '@/app/_shared/lib/email/emailCheck';
import type { OutreachDraft } from '@/app/_shared/lib/email/outreach';
import type { Business, BusinessUpdate } from '@/app/_shared/lib/types/auditely';

const CHECK_NOT_RUN: EmailCheckResult = { state: 'unchecked', reason: "Not checked: the check couldn't be run." };

/**
 * Asks the server whether the lead's address is deliverable. Whatever goes
 * wrong reads as "not checked", never as a block, and it always answers.
 */
export async function requestEmailCheck(businessId: string): Promise<EmailCheckResult> {
  try {
    const res = await fetch(API_ROUTES.VERIFY_EMAIL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_id: businessId }),
      // The route gives up after 30 seconds; the dialog doesn't wait much longer
      signal: AbortSignal.timeout(35_000),
    });
    const data: unknown = await res.json();
    if (!res.ok || !data || typeof data !== 'object') return CHECK_NOT_RUN;
    const { state, check, warning, reason } = data as Record<string, unknown>;
    if (state === 'off') return { state: 'off' };
    if (state === 'unchecked' && typeof reason === 'string') return { state: 'unchecked', reason };
    const valid = state === 'checked' ? asEmailCheck(check) : null;
    if (!valid) return CHECK_NOT_RUN;
    return { state: 'checked', check: valid, ...(typeof warning === 'string' ? { warning } : {}) };
  } catch {
    return CHECK_NOT_RUN;
  }
}

/**
 * "Send email" for one lead: when it was last emailed, the send in progress,
 * and what Verifalia said about its address. Used by the business card (it
 * stays mounted when collapsed); each send and check also reaches the list via
 * `onUpdate`, so sorting and filtering keep it.
 */
export function useEmailSend(business: Business, onUpdate?: (businessId: string, update: BusinessUpdate) => void) {
  const [sentAt, setSentAt] = useState<string | null>(business.emailed_at ?? null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The email went out but something after it didn't (the date wasn't saved)
  const [warning, setWarning] = useState<string | null>(null);
  // The address check: this card's own, else the one saved on the lead (of any age)
  const [checked, setChecked] = useState<EmailCheck | null>(null);
  const check = checked ?? checkFor(business.email_check, business.email);
  const [checking, setChecking] = useState(false);
  // Why the address wasn't checked, or that the result couldn't be saved
  const [checkNote, setCheckNote] = useState<string | null>(null);
  // A second click while a check runs must not spend a second credit
  const checkRunning = useRef(false);

  // A card that unmounted mid-send gets the result back through the list's prop
  useEffect(() => {
    if (business.emailed_at) setSentAt(business.emailed_at);
  }, [business.emailed_at]);

  /** Checks the address when the dialog opens; a fresh result is reused as it is */
  const verify = useCallback(async () => {
    if (checkRunning.current || freshCheck(check, business.email)) return;
    checkRunning.current = true;
    setChecking(true);
    setCheckNote(null);
    const result = await requestEmailCheck(business.id);
    if (result.state === 'checked') {
      setChecked(result.check);
      setCheckNote(result.warning ?? null);
      onUpdate?.(business.id, { email_check: result.check });
    } else if (result.state === 'unchecked') {
      setCheckNote(result.reason);
    }
    checkRunning.current = false;
    setChecking(false);
  }, [business.id, business.email, check, onUpdate]);

  /** Sends the email as edited; true once it has gone */
  const send = useCallback(
    async (draft: OutreachDraft): Promise<boolean> => {
      setSending(true);
      setError(null);
      setWarning(null);
      try {
        const res = await fetch(API_ROUTES.SEND_EMAIL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ business_id: business.id, subject: draft.subject, body: draft.body }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          // The server checked the address again and it is undeliverable after all
          const refused = asEmailCheck(data.email_check);
          if (refused) {
            setChecked(refused);
            onUpdate?.(business.id, { email_check: refused });
          }
          throw new Error(data.error || "Couldn't send the email");
        }
        setSentAt(data.emailed_at);
        setWarning(data.warning ?? null);
        onUpdate?.(business.id, { emailed_at: data.emailed_at });
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't send the email");
        return false;
      } finally {
        setSending(false);
      }
    },
    [business.id, onUpdate]
  );

  /** The email as the lead will see it (HTML); nothing is sent */
  const preview = useCallback(
    async (draft: OutreachDraft): Promise<string> => {
      const res = await fetch(API_ROUTES.SEND_EMAIL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: business.id, subject: draft.subject, body: draft.body, preview: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.html !== 'string') throw new Error(data.error || "Couldn't build the preview");
      return data.html;
    },
    [business.id]
  );

  const clearError = useCallback(() => setError(null), []);

  return { sentAt, sending, error, warning, send, preview, clearError, check, checking, checkNote, verify };
}
