// app/_shared/components/auditely/brandStudio/useStudioPreview.ts

// The live preview of the draft: the sample report as a PDF, or the sample
// email as HTML, fetched half a second after the last change. A newer change
// cancels the request before it; the last preview stays up while the next is
// drawn, and each PDF's object URL is let go once it's replaced.

'use client';

import { useEffect, useRef, useState } from 'react';
import { API_ROUTES } from '@/app/_shared/lib/config/routes';

export type PreviewFormat = 'report' | 'email';

const DEBOUNCE_MS = 500;
const FAILED = "Couldn't update the preview. Your changes are still here. Check your connection and make another change to retry.";

interface Drawn<T> {
  /** The request it answers */
  key: string;
  value: T;
}

export interface StudioPreview {
  /** The last report drawn, as an object URL */
  pdfUrl: string | null;
  /** The last email drawn, or why there's none (no name to send it from) */
  email: { html: string | null; hint: string | null } | null;
  updating: boolean;
  error: string | null;
}

export function useStudioPreview(payload: object, format: PreviewFormat): StudioPreview {
  const body = JSON.stringify({ ...payload, format });
  const [report, setReport] = useState<Drawn<string> | null>(null);
  const [email, setEmail] = useState<Drawn<{ html: string | null; hint: string | null }> | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  // The first preview is drawn straight away; later ones wait for the typing to stop
  const drawnOnce = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(
      async () => {
        drawnOnce.current = true;
        try {
          const res = await fetch(API_ROUTES.STUDIO_PREVIEW, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            signal: controller.signal,
          });
          if (!res.ok) throw new Error(`Preview answered ${res.status}`);
          if (format === 'email') {
            const answer = (await res.json()) as { html?: unknown; error?: unknown };
            setEmail({
              key: body,
              value: { html: typeof answer.html === 'string' ? answer.html : null, hint: typeof answer.error === 'string' ? answer.error : null },
            });
          } else {
            const url = URL.createObjectURL(await res.blob());
            if (controller.signal.aborted) return URL.revokeObjectURL(url);
            setReport({ key: body, value: url });
          }
          setFailed(null);
        } catch {
          if (!controller.signal.aborted) setFailed(body);
        }
      },
      drawnOnce.current ? DEBOUNCE_MS : 0
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [body, format]);

  // A replaced report's URL is let go once the new one is showing, and the last one on leaving
  useEffect(() => {
    const url = report?.value;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [report]);

  const drawn = format === 'email' ? email : report;
  return {
    pdfUrl: report?.value ?? null,
    email: email?.value ?? null,
    updating: drawn?.key !== body && failed !== body,
    error: failed === body ? FAILED : null,
  };
}
