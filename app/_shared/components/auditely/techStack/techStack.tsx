// app/_shared/components/auditely/techStack/techStack.tsx

// "Built with" — what the lead's website runs on. Internal sales notes only;
// the PDF and the AI prompt never include it.

import type { TechCategory, TechItem } from '@/app/_shared/lib/audit/types';

const CATEGORY_LABELS: Record<TechCategory, string> = {
  platform: 'Platform',
  pageBuilder: 'Page builder',
  framework: 'Framework',
  hosting: 'Hosting',
  analytics: 'Analytics & ads',
  widgets: 'Booking & chat',
};

export function TechStack({ items }: { items?: TechItem[] }) {
  if (!items || items.length === 0) return null;

  const groups = (Object.keys(CATEGORY_LABELS) as TechCategory[])
    .map((category) => ({ category, items: items.filter((item) => item.category === category) }))
    .filter((group) => group.items.length > 0);

  return (
    <div>
      <h4 className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
        Built with
        <span className="rounded bg-[var(--color-bg-secondary)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--color-text-tertiary)]">
          Only you see this
        </span>
      </h4>
      <dl className="grid gap-1.5 sm:grid-cols-[auto_1fr] sm:gap-x-4">
        {groups.map((group) => (
          <div key={group.category} className="contents">
            <dt className="text-xs text-[var(--color-text-tertiary)] sm:pt-0.5">{CATEGORY_LABELS[group.category]}</dt>
            <dd className="flex flex-wrap gap-1.5">
              {group.items.map((item) => (
                <span
                  key={item.name}
                  className="rounded-md border border-[var(--color-border)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]"
                >
                  {item.name}
                  {item.version ? ` ${item.version}` : ''}
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
