// app/_shared/components/auditely/settingsView/hubspotForm.tsx

'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/app/_shared/components/ui/button/button';
import { Input } from '@/app/_shared/components/ui/input/input';
import { useToast } from '@/app/_shared/components/ui/toast/toast';
import { ConnectedRow } from '@/app/_shared/components/auditely/settingsView/connectedRow';
import { sendSettings } from '@/app/_shared/components/auditely/settingsView/settingsRequest';
import { API_ROUTES } from '@/app/_shared/lib/config/routes';
import type { Connections } from '@/app/_shared/lib/hooks/useConnections';

/** The account's own HubSpot: connected, or the form to paste a private app's token */
export function HubSpotForm({ hubspot }: { hubspot: Connections['hubspot'] }) {
  const router = useRouter();
  const { addToast } = useToast();
  const [token, setToken] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (hubspot?.source === 'saved') {
    return <ConnectedRow text="Connected" url={API_ROUTES.SETTINGS_HUBSPOT} disconnected="HubSpot disconnected" />;
  }

  const connect = async (e: FormEvent) => {
    e.preventDefault();
    setChecking(true);
    setError(null);
    const answer = await sendSettings(API_ROUTES.SETTINGS_HUBSPOT, 'PUT', { token });
    setChecking(false);
    if (!answer.ok) {
      setError(answer.error);
      return;
    }
    setToken('');
    addToast({ title: 'HubSpot connected', variant: 'success' });
    router.refresh();
  };

  return (
    <div className="space-y-5">
      {hubspot?.source === 'env' && (
        <p className="text-sm text-[var(--color-text-secondary)]">Connected through HUBSPOT_TOKEN in Vercel.</p>
      )}
      <form onSubmit={connect} className="space-y-5" noValidate>
        <Input
          label="Private app access token"
          type="password"
          autoComplete="off"
          spellCheck={false}
          helpText="In HubSpot, create a private app (Settings › Integrations › Private apps) with read and write access to companies and contacts."
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        {error && (
          <p className="text-sm text-[var(--color-error)]" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" isLoading={checking}>
          {checking ? 'Checking…' : 'Connect HubSpot'}
        </Button>
      </form>
    </div>
  );
}
