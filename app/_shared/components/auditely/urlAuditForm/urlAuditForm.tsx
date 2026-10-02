// app/_shared/components/auditely/urlAuditForm/urlAuditForm.tsx

'use client';

import { useState } from 'react';
import { Button } from '@/app/_shared/components/ui/button/button';
import { CommandField } from '@/app/_shared/components/ui/commandField/commandField';
import { GlobeIcon, MailIcon } from '@/app/_shared/components/ui/icons/icons';
import { useDemo } from '@/app/_shared/lib/hooks/useDemo';
import type { UrlAuditBusy } from '@/app/_shared/lib/hooks/useUrlAudits';

interface UrlAuditFormProps {
  /** "Run audit" — resolves true when the site was added, which clears the field */
  onSubmit: (url: string) => Promise<boolean>;
  /** "Find email" — email search without the full audit; same resolve contract */
  onFindEmail: (url: string) => Promise<boolean>;
  busy: UrlAuditBusy;
}

export function UrlAuditForm({ onSubmit, onFindEmail, busy }: UrlAuditFormProps) {
  const demo = useDemo();
  const [url, setUrl] = useState('');
  const isLoading = busy !== null;

  const run = async (action: (url: string) => Promise<boolean>) => {
    const value = url.trim();
    // In the demo both buttons always answer (with the notice), even with an empty field
    if (isLoading || (!value && !demo)) return;
    if (await action(value)) setUrl('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void run(onSubmit);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-1 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-md sm:flex-row sm:items-center"
    >
      <CommandField
        label="Website"
        icon={<GlobeIcon size={18} />}
        placeholder="example.com"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        disabled={isLoading}
        inputMode="url"
        autoComplete="url"
        autoCapitalize="none"
        spellCheck={false}
      />
      <div className="flex gap-1">
        <Button
          type="button"
          variant="outline"
          size="md"
          isLoading={busy === 'email'}
          disabled={isLoading || (!demo && !url.trim())}
          onClick={() => void run(onFindEmail)}
          className="h-12 flex-1 whitespace-nowrap sm:flex-none"
        >
          {busy === 'email' ? (
            'Finding email…'
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <MailIcon size={16} />
              Find email
            </span>
          )}
        </Button>
        <Button
          type="submit"
          variant="primary"
          size="md"
          isLoading={busy === 'audit'}
          disabled={isLoading || (!demo && !url.trim())}
          className="h-12 flex-1 whitespace-nowrap sm:flex-none"
        >
          {busy === 'audit' ? 'Adding…' : 'Run audit'}
        </Button>
      </div>
    </form>
  );
}
