// app/_shared/lib/hooks/useCrmSend.ts

'use client';

import { useCallback, useEffect, useState } from 'react';
import { API_ROUTES } from '@/app/_shared/lib/config/routes';
import type { Business, BusinessUpdate } from '@/app/_shared/lib/types/auditely';

/**
 * "Send to HubSpot" for one lead: when it was last sent, and the send in
 * progress. Used by the business card (it stays mounted when collapsed); each
 * send also reaches the list via `onUpdate`, so sorting and filtering keep it.
 */
export function useCrmSend(business: Business, onUpdate?: (businessId: string, update: BusinessUpdate) => void) {
  const [sentAt, setSentAt] = useState<string | null>(business.crm_sent_at ?? null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A card that unmounted mid-send gets the result back through the list's prop
  useEffect(() => {
    if (business.crm_sent_at) setSentAt(business.crm_sent_at);
  }, [business.crm_sent_at]);

  const send = useCallback(async () => {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(API_ROUTES.CRM, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: business.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't send to HubSpot");
      setSentAt(data.crm_sent_at);
      onUpdate?.(business.id, { crm_sent_at: data.crm_sent_at });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send to HubSpot");
    } finally {
      setSending(false);
    }
  }, [business.id, onUpdate]);

  return { sentAt, sending, error, send };
}
