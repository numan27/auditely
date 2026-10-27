// app/_shared/components/auditely/settingsView/mailboxForm.tsx

'use client';

import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/app/_shared/components/ui/button/button';
import { Input } from '@/app/_shared/components/ui/input/input';
import { useToast } from '@/app/_shared/components/ui/toast/toast';
import { ConnectedRow } from '@/app/_shared/components/auditely/settingsView/connectedRow';
import { sendSettings } from '@/app/_shared/components/auditely/settingsView/settingsRequest';
import { API_ROUTES } from '@/app/_shared/lib/config/routes';
import { MAILBOX_PRESETS } from '@/app/_shared/lib/email/mailboxPresets';
import type { Connections } from '@/app/_shared/lib/hooks/useConnections';

type PresetId = (typeof MAILBOX_PRESETS)[number]['id'];

const PORTS = [465, 587] as const;

/** A native select, drawn like the kit's Input */
function Select({ label, help, children, ...props }: { label: string; help?: string; children: ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <div className="flex w-full flex-col gap-[var(--spacing-xs)]">
      <label htmlFor={id} className="text-sm font-medium text-[var(--color-text-primary)]">
        {label}
      </label>
      <select
        id={id}
        aria-describedby={help ? `${id}-help` : undefined}
        className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-[var(--spacing-md)] py-[var(--spacing-sm)] text-base leading-normal text-[var(--color-text-primary)] focus:border-[var(--color-primary-500)] focus:outline-none"
        {...props}
      >
        {children}
      </select>
      {help && (
        <span id={`${id}-help`} className="text-xs text-[var(--color-text-secondary)]">
          {help}
        </span>
      )}
    </div>
  );
}

/** The account's own mailbox: what it sends from, or the form to connect one */
export function MailboxForm({ mailbox }: { mailbox: Connections['mailbox'] }) {
  const router = useRouter();
  const { addToast } = useToast();
  const [presetId, setPresetId] = useState<PresetId>(MAILBOX_PRESETS[0].id);
  const [host, setHost] = useState(MAILBOX_PRESETS[0].host);
  const [port, setPort] = useState<465 | 587>(MAILBOX_PRESETS[0].port);
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (mailbox?.source === 'saved') {
    return <ConnectedRow text={`Sending from ${mailbox.address}`} url={API_ROUTES.SETTINGS_MAILBOX} disconnected="Mailbox disconnected" />;
  }

  const preset = MAILBOX_PRESETS.find((p) => p.id === presetId) ?? MAILBOX_PRESETS[0];

  const choosePreset = (id: PresetId) => {
    const next = MAILBOX_PRESETS.find((p) => p.id === id) ?? MAILBOX_PRESETS[0];
    setPresetId(next.id);
    setHost(next.host);
    setPort(next.port);
  };

  const connect = async (e: FormEvent) => {
    e.preventDefault();
    setChecking(true);
    setError(null);
    const answer = await sendSettings(API_ROUTES.SETTINGS_MAILBOX, 'PUT', { host, port, user, pass, fromEmail });
    setChecking(false);
    if (!answer.ok) {
      setError(answer.error);
      return;
    }
    setPass('');
    addToast({ title: 'Mailbox connected', variant: 'success' });
    router.refresh();
  };

  return (
    <div className="space-y-5">
      {mailbox?.source === 'env' && (
        <p className="text-sm text-[var(--color-text-secondary)]">
          {`Sending from ${mailbox.address}, set up in Vercel. Connect a mailbox here to use it instead.`}
        </p>
      )}
      <form onSubmit={connect} className="space-y-5" noValidate>
        <Select label="Provider" help={preset.help} value={presetId} onChange={(e) => choosePreset(e.target.value as PresetId)}>
          {MAILBOX_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </Select>
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_8rem]">
          <Input label="SMTP server" autoComplete="off" spellCheck={false} placeholder="smtp.example.com" value={host} onChange={(e) => setHost(e.target.value)} />
          <Select label="Port" value={port} onChange={(e) => setPort(Number(e.target.value) as 465 | 587)}>
            {PORTS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </div>
        <Input label="Email address" type="email" autoComplete="off" value={user} onChange={(e) => setUser(e.target.value)} />
        <Input label="App password" type="password" autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} />
        <Input
          label="Send as"
          type="email"
          autoComplete="off"
          helpText="The From address, if it isn't the email address"
          value={fromEmail}
          onChange={(e) => setFromEmail(e.target.value)}
        />
        {error && (
          <p className="text-sm text-[var(--color-error)]" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" isLoading={checking}>
          {checking ? 'Checking…' : 'Connect mailbox'}
        </Button>
      </form>
    </div>
  );
}
