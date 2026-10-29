// app/_shared/components/auditely/brandStudio/studioWordingPanel.tsx

// Wording: the report's title and the next step a prospect is offered, its
// title, sentence and button, on the report and in the email. A blank field
// keeps the wording shown in it.

'use client';

import type { ChangeEvent } from 'react';
import { Input } from '@/app/_shared/components/ui/input/input';
import { TextArea } from '@/app/_shared/components/ui/textArea/textArea';
import { PanelIntro } from '@/app/_shared/components/auditely/brandStudio/studioPanel';
import { updateSection } from '@/app/_shared/components/auditely/brandStudio/studioState';
import {
  CTA_BUTTON_MAX,
  CTA_TEXT_MAX,
  DEFAULT_CTA_BUTTON,
  DEFAULT_TITLE,
  SECTIONS,
  TITLE_MAX,
  sectionShown,
  type BrandDesign,
} from '@/app/_shared/lib/brand/brandDesign';

interface WordingPanelProps {
  design: BrandDesign;
  /** Today's sentence for this account, the placeholder when it has none of its own */
  defaultCtaText: string;
  onChange: (next: BrandDesign) => void;
  errorFor: (field: string) => string | undefined;
}

// Blank is the default, not an empty title
const typed = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => (e.target.value === '' ? null : e.target.value);

export function StudioWordingPanel({ design, defaultCtaText, onChange, errorFor }: WordingPanelProps) {
  const nextStep = design.sections.find((s) => s.id === 'nextStep');
  return (
    <div className="space-y-8">
      <PanelIntro title="Wording">Leave a field blank to keep the wording shown in it. Emoji don&apos;t print in the PDF.</PanelIntro>

      <Input
        label="Report title"
        placeholder={DEFAULT_TITLE}
        maxLength={TITLE_MAX}
        value={design.title ?? ''}
        error={errorFor('title')}
        onChange={(e) => onChange({ ...design, title: typed(e) })}
      />

      <div role="group" aria-labelledby="studio-next-step" className="space-y-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4 sm:p-5">
        <p id="studio-next-step" className="text-sm font-semibold text-[var(--color-text-primary)]">
          The next step
        </p>
        {!sectionShown(design, 'nextStep') && (
          <p className="text-xs text-[var(--color-text-secondary)]">Left out under Sections, so reports and emails don&apos;t show it.</p>
        )}
        <Input
          label="Title"
          placeholder={SECTIONS.nextStep.title}
          maxLength={TITLE_MAX}
          value={nextStep?.title ?? ''}
          error={errorFor('section.nextStep')}
          onChange={(e) => onChange(updateSection(design, 'nextStep', { title: typed(e) }))}
        />
        <TextArea
          label="Sentence"
          rows={3}
          placeholder={defaultCtaText}
          maxLength={CTA_TEXT_MAX}
          showCount
          value={design.ctaText ?? ''}
          error={errorFor('ctaText')}
          onChange={(e) => onChange({ ...design, ctaText: typed(e) })}
        />
        <Input
          label="Button"
          placeholder={DEFAULT_CTA_BUTTON}
          maxLength={CTA_BUTTON_MAX}
          value={design.ctaButton ?? ''}
          error={errorFor('ctaButton')}
          helpText="Opens your booking link, or your email without one."
          onChange={(e) => onChange({ ...design, ctaButton: typed(e) })}
        />
      </div>
    </div>
  );
}
