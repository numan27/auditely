// app/_shared/components/auditely/brandStudio/studioBrandPanel.tsx

// Brand: who the reports and emails come from. The name and company sign the
// AI's emails; the logo, contact details and booking link go on every report.

'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { Button } from '@/app/_shared/components/ui/button/button';
import { Input } from '@/app/_shared/components/ui/input/input';
import { readLogoFile } from '@/app/_shared/components/auditely/brandStudio/logoFile';
import { PanelIntro } from '@/app/_shared/components/auditely/brandStudio/studioPanel';
import type { StudioDraft, TextField } from '@/app/_shared/components/auditely/brandStudio/studioState';

interface BrandPanelProps {
  draft: StudioDraft;
  /** The sign-in email, used on reports when the contact email is blank */
  email: string;
  onField: (field: TextField, value: string) => void;
  onLogo: (logo: string | null) => void;
  errorFor: (field: string) => string | undefined;
}

export function StudioBrandPanel({ draft, email, onField, onLogo, errorFor }: BrandPanelProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const text = (field: TextField) => ({
    value: draft.fields[field],
    error: errorFor(field),
    onChange: (e: ChangeEvent<HTMLInputElement>) => onField(field, e.target.value),
  });

  const chooseLogo = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // The same file can be chosen again after it was refused
    e.target.value = '';
    if (!file) return;
    const read = await readLogoFile(file);
    setLogoError(read.ok ? null : read.error);
    if (read.ok) onLogo(read.dataUrl);
  };
  const shownLogoError = logoError ?? errorFor('logo_data_url');

  return (
    <div className="space-y-7">
      <PanelIntro title="Brand">Your name and company sign the emails. Your logo and contact details go on every report.</PanelIntro>

      <div className="flex items-center gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--color-border)] bg-white">
          {draft.logo ? (
            // A data URL: next/image has nothing to optimise
            // eslint-disable-next-line @next/next/no-img-element
            <img src={draft.logo} alt="Your logo" className="h-full w-full object-contain p-1.5" />
          ) : (
            <span className="text-xs text-[var(--color-gray-400)]">Logo</span>
          )}
        </div>
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
              {draft.logo ? 'Change logo' : 'Upload logo'}
            </Button>
            {draft.logo && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onLogo(null)}>
                Remove
              </Button>
            )}
          </div>
          <p className={`text-xs ${shownLogoError ? 'text-[var(--color-error)]' : 'text-[var(--color-text-secondary)]'}`} role={shownLogoError ? 'alert' : undefined}>
            {shownLogoError ?? 'PNG or JPEG, under 256 KB. A square logo fits best.'}
          </p>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg"
          className="sr-only"
          tabIndex={-1}
          aria-label="Logo file"
          onChange={chooseLogo}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Input label="Your name" autoComplete="name" {...text('display_name')} />
        <Input label="Company" autoComplete="organization" {...text('company')} />
      </div>
      <Input label="Website" inputMode="url" autoComplete="url" placeholder="https://" {...text('website')} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          label="Contact email"
          type="email"
          autoComplete="email"
          helpText={`Leave blank to use ${email}.`}
          {...text('contact_email')}
        />
        <Input label="Phone" type="tel" autoComplete="tel" {...text('contact_phone')} />
      </div>
      <Input
        label="Booking link"
        inputMode="url"
        placeholder="https://"
        helpText="Your Calendly or other booking page. The report's button opens it."
        {...text('booking_url')}
      />
    </div>
  );
}
