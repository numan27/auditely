// app/_shared/lib/hooks/useEmailSend.ts

'use client';

import { useCallback, useEffect, useState } from 'react';
import { API_ROUTES } from '@/app/_shared/lib/config/routes';
import type { OutreachDraft } from '@/app/_shared/lib/email/outreach';
import type { Business, BusinessUpdate } from '@/app/_shared/lib/types/auditely';

/**
 * "Send email" for one lead: when it was last emailed, and the send in
 * progress. Used by the business card (it stays mounted when collapsed); each
 * send also reaches the list via `onUpdate`, so sorting and filtering keep it.
 */
export function useEmailSend(business: Business, onUpdate?: (businessId: string, update: BusinessUpdate) => void) {
  const [sentAt, setSentAt] = useState<string | null>(business.emailed_at ?? null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The email went out but something after it didn't (the date wasn't saved)
  const [warning, setWarning] = useState<string | null>(null);

  // A card that unmounted mid-send gets the result back through the list's prop
  useEffect(() => {
    if (business.emailed_at) setSentAt(business.emailed_at);
  }, [business.emailed_at]);

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
        if (!res.ok) throw new Error(data.error || "Couldn't send the email");
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

  const clearError = useCallback(() => setError(null), []);

  return { sentAt, sending, error, warning, send, clearError };
}
