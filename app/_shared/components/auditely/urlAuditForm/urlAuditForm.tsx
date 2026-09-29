// app/_shared/components/auditely/urlAuditForm/urlAuditForm.tsx

'use client';

import { useState } from 'react';
import { Button } from '@/app/_shared/components/ui/button/button';
import { CommandField } from '@/app/_shared/components/ui/commandField/commandField';
import { GlobeIcon } from '@/app/_shared/components/ui/icons/icons';

interface UrlAuditFormProps {
  /** Resolves true when the site was added, which clears the field */
  onSubmit: (url: string) => Promise<boolean>;
  isLoading: boolean;
}

export function UrlAuditForm({ onSubmit, isLoading }: UrlAuditFormProps) {
  const [url, setUrl] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = url.trim();
    if (!value || isLoading) return;
    if (await onSubmit(value)) setUrl('');
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
      <Button
        type="submit"
        variant="primary"
        size="md"
        isLoading={isLoading}
        disabled={isLoading || !url.trim()}
        className="h-12"
      >
        {isLoading ? 'Adding…' : 'Run audit'}
      </Button>
    </form>
  );
}
