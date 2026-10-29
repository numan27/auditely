// app/_shared/components/auditely/brandStudio/brandStudio.tsx

// The Brand studio: everything a prospect sees of the account, edited in one
// place with the sample report or email redrawn beside it. Changes are a
// draft until Save; Discard goes back to what's saved. A plan without
// branding sees the studio in a sample look with every field disabled.

'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/app/_shared/components/ui/button/button';
import { ToastProvider, useToast } from '@/app/_shared/components/ui/toast/toast';
import { StudioBrandPanel } from '@/app/_shared/components/auditely/brandStudio/studioBrandPanel';
import { StudioColoursPanel } from '@/app/_shared/components/auditely/brandStudio/studioColoursPanel';
import { StudioLocked } from '@/app/_shared/components/auditely/brandStudio/studioLocked';
import { StudioPreview } from '@/app/_shared/components/auditely/brandStudio/studioPreview';
import { saveStudio } from '@/app/_shared/components/auditely/brandStudio/studioRequest';
import { StudioSectionsPanel } from '@/app/_shared/components/auditely/brandStudio/studioSectionsPanel';
import {
  draftFrom,
  sameDraft,
  showcaseDraft,
  studioPayload,
  tabFor,
  type StudioDraft,
  type StudioTab,
} from '@/app/_shared/components/auditely/brandStudio/studioState';
import { StudioStylePanel } from '@/app/_shared/components/auditely/brandStudio/studioStylePanel';
import { StudioTabs, panelId, tabId } from '@/app/_shared/components/auditely/brandStudio/studioTabs';
import { StudioWordingPanel } from '@/app/_shared/components/auditely/brandStudio/studioWordingPanel';
import type { BrandDesign } from '@/app/_shared/lib/brand/brandDesign';
import type { ProfileFields } from '@/app/_shared/lib/brand/profileInput';

export interface BrandStudioProps {
  profile: ProfileFields;
  design: BrandDesign;
  /** The sign-in email, which reports use when the contact email is blank */
  email: string;
  /** The plan has no branding: a sample look, nothing to save */
  locked: boolean;
  /** Paid plans can be bought (not in the beta) */
  checkoutOpen: boolean;
  /** Why saving can't work yet (the migration hasn't run); null when it can */
  notice: string | null;
  /** The next step's sentence when the design has none, for this account */
  defaultCtaText: string;
}

function Studio({ profile, design, email, locked, checkoutOpen, notice, defaultCtaText }: BrandStudioProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [saved, setSaved] = useState(() => draftFrom(profile, design));
  const [draft, setDraft] = useState(() => (locked ? showcaseDraft(saved) : saved));
  const [tab, setTab] = useState<StudioTab>('brand');
  const [fieldError, setFieldError] = useState<{ field: string; error: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dirty = !locked && !sameDraft(draft, saved);

  // Leaving with unsaved changes asks first
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const edit = (next: StudioDraft) => {
    setDraft(next);
    setFieldError(null);
  };
  const editDesign = (next: BrandDesign) => edit({ ...draft, design: next });
  const errorFor = (field: string) => (fieldError?.field === field ? fieldError.error : undefined);

  const save = async () => {
    if (!dirty || saving || notice) return;
    setSaving(true);
    setError(null);
    setFieldError(null);
    const answer = await saveStudio(draft);
    setSaving(false);
    if (!answer.ok) {
      const holder = answer.field ? tabFor(answer.field) : null;
      if (answer.field && holder) {
        setFieldError({ field: answer.field, error: answer.error });
        setTab(holder);
      } else setError(answer.error);
      return;
    }
    setSaved(answer.draft);
    setDraft(answer.draft);
    addToast({ title: 'Brand saved', description: 'New reports and emails use it.', variant: 'success' });
    // The header's profile menu shows the saved logo and name
    router.refresh();
  };

  // ⌘S or Ctrl+S saves, as in any editor
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== 's' || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      void save();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  const discard = () => {
    setDraft(saved);
    setFieldError(null);
    setError(null);
  };

  const panels: Record<StudioTab, ReactNode> = {
    brand: (
      <StudioBrandPanel
        draft={draft}
        email={email}
        onField={(field, value) => edit({ ...draft, fields: { ...draft.fields, [field]: value } })}
        onLogo={(logo) => edit({ ...draft, logo })}
        errorFor={errorFor}
      />
    ),
    colours: <StudioColoursPanel design={draft.design} onChange={(patch) => editDesign({ ...draft.design, ...patch })} errorFor={errorFor} />,
    style: <StudioStylePanel design={draft.design} onChange={editDesign} />,
    sections: <StudioSectionsPanel design={draft.design} onChange={editDesign} errorFor={errorFor} onWording={() => setTab('wording')} />,
    wording: <StudioWordingPanel design={draft.design} defaultCtaText={defaultCtaText} onChange={editDesign} errorFor={errorFor} />,
  };

  return (
    <>
      <div className="mb-8 max-w-2xl">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-[var(--color-text-primary)]">Brand studio</h1>
        <p className="mt-3 text-base leading-relaxed text-[var(--color-text-secondary)]">
          How your reports and emails look to the businesses you contact. The preview redraws a sample audit as you go.
        </p>
      </div>

      {(locked || notice) && (
        <div className="mb-6 space-y-3">
          {locked && <StudioLocked checkoutOpen={checkoutOpen} />}
          {notice && (
            <p role="alert" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-text-secondary)]">
              {notice}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,27rem)_minmax(0,1fr)] lg:gap-8">
        <div className="flex min-w-0 flex-col">
          <StudioTabs active={tab} onChange={setTab} flagged={fieldError ? tabFor(fieldError.field) : null} />
          <div role="tabpanel" id={panelId(tab)} aria-labelledby={tabId(tab)} className="mt-6 flex-1">
            <fieldset disabled={locked} className="min-w-0">
              {panels[tab]}
            </fieldset>
          </div>

          {!locked && (
            <div className="sticky bottom-0 z-20 -mx-4 mt-8 border-t border-[var(--color-border)] bg-[var(--color-bg-primary)]/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-t-xl sm:border-x sm:px-4">
              {error && (
                <p className="mb-2 text-sm text-[var(--color-error)]" role="alert">
                  {error}
                </p>
              )}
              <div className="flex items-center gap-2">
                <p className="mr-auto text-sm text-[var(--color-text-secondary)]" aria-live="polite">
                  {dirty ? 'Unsaved changes' : 'All changes saved'}
                </p>
                {dirty && (
                  <Button type="button" variant="ghost" size="sm" onClick={discard} disabled={saving}>
                    Discard
                  </Button>
                )}
                <Button type="button" size="sm" onClick={save} isLoading={saving} disabled={!dirty || Boolean(notice)}>
                  Save changes
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="h-[80vh] min-h-[32rem] lg:sticky lg:top-[4.5rem] lg:h-[calc(100vh-5.5rem)]">
          <StudioPreview payload={studioPayload(draft)} />
        </div>
      </div>
    </>
  );
}

export function BrandStudio(props: BrandStudioProps) {
  return (
    <ToastProvider position="bottom-right">
      <Studio {...props} />
    </ToastProvider>
  );
}
