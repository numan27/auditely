// app/_shared/components/auditely/settingsView/connectedRow.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/app/_shared/components/ui/button/button';
import { useToast } from '@/app/_shared/components/ui/toast/toast';
import { sendSettings } from '@/app/_shared/components/auditely/settingsView/settingsRequest';

/** What is connected, with a Disconnect button that forgets it */
export function ConnectedRow({ text, url, disconnected }: { text: string; url: string; disconnected: string }) {
  const router = useRouter();
  const { addToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disconnect = async () => {
    setBusy(true);
    setError(null);
    const answer = await sendSettings(url, 'DELETE');
    setBusy(false);
    if (!answer.ok) {
      setError(answer.error);
      return;
    }
    addToast({ title: disconnected, variant: 'success' });
    router.refresh();
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]">
          <span aria-hidden className="h-2 w-2 rounded-full bg-[var(--color-primary-600)]" />
          {text}
        </span>
        <Button type="button" variant="outline" size="sm" isLoading={busy} onClick={disconnect}>
          Disconnect
        </Button>
      </div>
      {error && (
        <p className="text-sm text-[var(--color-error)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
