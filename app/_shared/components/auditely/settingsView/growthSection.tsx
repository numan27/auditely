// app/_shared/components/auditely/settingsView/growthSection.tsx

// The owner's weekly numbers (lib/growth/funnel.ts): free audits run and kept,
// then the accounts made in the last 7 and 30 days and how far they got, each
// step as a share of those accounts. Visitors are in Vercel Web Analytics.

import { Section } from '@/app/_shared/components/auditely/settingsView/settingsSection';
import type { GrowthCounts } from '@/app/_shared/lib/growth/funnel';

type Step = keyof Omit<GrowthCounts, 'days'>;

const ROWS: { key: Step; label: string; ofAccounts?: true }[] = [
  { key: 'freeAudits', label: 'Free audits run' },
  { key: 'kept', label: 'Kept by signing up' },
  { key: 'accounts', label: 'New accounts' },
  { key: 'searched', label: 'Ran a search', ofAccounts: true },
  { key: 'audited', label: 'Audited a website', ofAccounts: true },
  { key: 'paying', label: 'Pay for Pro or Agency', ofAccounts: true },
  { key: 'emailed', label: 'Emailed a lead from Auditely', ofAccounts: true },
];

function cell(counts: GrowthCounts, key: Step, ofAccounts: boolean): string {
  const count = counts[key].toLocaleString('en-US');
  if (!ofAccounts || !counts.accounts) return count;
  return `${count} (${Math.round((counts[key] / counts.accounts) * 100)}%)`;
}

export function GrowthSection({ counts }: { counts: GrowthCounts[] | null }) {
  return (
    <Section
      id="growth"
      title="Growth"
      lead={
        <>
          <p>
            Free audits, and the accounts made in the last 7 and 30 days with how far each got. Your own account isn&apos;t
            counted.
          </p>
          <p>
            Visitors, and the sites they came from, are in Vercel Web Analytics: open the project in Vercel, then
            Analytics.
          </p>
        </>
      }
    >
      {counts ? (
        <div className="space-y-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--color-text-tertiary)]">
                <th className="py-2 font-medium" scope="col">
                  <span className="sr-only">Step</span>
                </th>
                {counts.map((c) => (
                  <th key={c.days} className="py-2 text-right font-medium" scope="col">
                    Last {c.days} days
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
              {ROWS.map(({ key, label, ofAccounts }) => (
                <tr key={key}>
                  <th scope="row" className={`py-2.5 text-left font-normal text-[var(--color-text-primary)] ${ofAccounts ? 'pl-4' : ''}`}>
                    {label}
                  </th>
                  {counts.map((c) => (
                    <td key={c.days} className="py-2.5 text-right tabular-nums text-[var(--color-text-primary)]">
                      {cell(c, key, !!ofAccounts)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            Free accounts copy their emails to send them, so only emails sent from Auditely are counted.
          </p>
        </div>
      ) : (
        <p className="text-sm text-[var(--color-error)]" role="alert">
          Couldn&apos;t load the numbers. Refresh to try again.
        </p>
      )}
    </Section>
  );
}
