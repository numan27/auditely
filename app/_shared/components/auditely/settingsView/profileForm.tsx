// app/_shared/components/auditely/settingsView/profileForm.tsx

'use client';

import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/app/_shared/components/ui/button/button';
import { Input } from '@/app/_shared/components/ui/input/input';
import { useToast } from '@/app/_shared/components/ui/toast/toast';
import { sendSettings } from '@/app/_shared/components/auditely/settingsView/settingsRequest';
import { LOGO_MAX_BYTES, LOGO_REFUSED, logoProblem, type ProfileFields } from '@/app/_shared/lib/brand/profileInput';
import { API_ROUTES } from '@/app/_shared/lib/config/routes';

type TextField = Exclude<keyof ProfileFields, 'logo_data_url'>;

const LOGO_TYPES = ['image/png', 'image/jpeg'];

const asText = (profile: ProfileFields): Record<TextField, string> => ({
  display_name: profile.display_name ?? '',
  company: profile.company ?? '',
  website: profile.website ?? '',
  contact_email: profile.contact_email ?? '',
  contact_phone: profile.contact_phone ?? '',
  booking_url: profile.booking_url ?? '',
});

/** The name, company, logo and contact details the account's reports and emails are signed with */
export function ProfileForm({ profile, email }: { profile: ProfileFields; email: string }) {
  const router = useRouter();
  const { addToast } = useToast();
  const [fields, setFields] = useState(() => asText(profile));
  const [logo, setLogo] = useState(profile.logo_data_url);
  const [fieldError, setFieldError] = useState<{ field: string; error: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const errorFor = (field: keyof ProfileFields) => (fieldError?.field === field ? fieldError.error : undefined);
  const text = (field: TextField) => ({
    value: fields[field],
    error: errorFor(field),
    onChange: (e: ChangeEvent<HTMLInputElement>) => setFields((current) => ({ ...current, [field]: e.target.value })),
  });

  const chooseLogo = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // The same file can be chosen again after it was refused
    e.target.value = '';
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type) || file.size > LOGO_MAX_BYTES) {
      setFieldError({ field: 'logo_data_url', error: LOGO_REFUSED });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const problem = logoProblem(dataUrl);
      if (problem) {
        setFieldError({ field: 'logo_data_url', error: problem });
        return;
      }
      setFieldError(null);
      setLogo(dataUrl);
    };
    reader.onerror = () => setFieldError({ field: 'logo_data_url', error: "Couldn't read that file. Choose it again." });
    reader.readAsDataURL(file);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setFieldError(null);
    const answer = await sendSettings(API_ROUTES.SETTINGS_PROFILE, 'PUT', { ...fields, logo_data_url: logo });
    setSaving(false);
    if (!answer.ok) {
      if (answer.field) setFieldError({ field: answer.field, error: answer.error });
      else setError(answer.error);
      return;
    }
    addToast({ title: 'Profile saved', variant: 'success' });
    // The layout's brand, which the drafts sign with, comes from the profile
    router.refresh();
  };

  const logoError = errorFor('logo_data_url');

  return (
    <form onSubmit={save} className="space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Input label="Your name" autoComplete="name" {...text('display_name')} />
        <Input label="Company" autoComplete="organization" {...text('company')} />
      </div>
      <Input label="Website" inputMode="url" autoComplete="url" placeholder="https://" {...text('website')} />

      <div className="space-y-2">
        <span className="block text-sm font-medium text-[var(--color-text-primary)]">Logo</span>
        <div className="flex flex-wrap items-center gap-3">
          {logo && (
            // A data URL: next/image has nothing to optimise
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt="Your logo"
              className="h-10 max-w-[10rem] rounded border border-[var(--color-border)] bg-white object-contain p-1"
            />
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
            {logo ? 'Change logo' : 'Upload logo'}
          </Button>
          {logo && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setLogo(null)}>
              Remove logo
            </Button>
          )}
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
        {logoError ? (
          <p className="text-xs text-[var(--color-error)]" role="alert">
            {logoError}
          </p>
        ) : (
          <p className="text-xs text-[var(--color-text-secondary)]">PNG or JPEG, under 256 KB</p>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          label="Contact email"
          type="email"
          autoComplete="email"
          helpText={`Shown on reports. Leave blank to use ${email}.`}
          {...text('contact_email')}
        />
        <Input label="Phone" type="tel" autoComplete="tel" {...text('contact_phone')} />
      </div>
      <Input
        label="Booking link"
        inputMode="url"
        placeholder="https://"
        helpText="Your Calendly or other booking page, for “Book your free call”."
        {...text('booking_url')}
      />

      {error && (
        <p className="text-sm text-[var(--color-error)]" role="alert">
          {error}
        </p>
      )}
      <div className="space-y-2">
        <Button type="submit" isLoading={saving}>
          Save profile
        </Button>
        <p className="text-sm text-[var(--color-text-tertiary)]">
          Summaries written from now on use these details. &ldquo;Write again&rdquo; on a summary redoes an older one.
        </p>
      </div>
    </form>
  );
}
