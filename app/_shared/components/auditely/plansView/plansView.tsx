// app/_shared/components/auditely/plansView/plansView.tsx

import { CheckIcon, XIcon } from '@/app/_shared/components/ui/icons/icons';
import { PLANS, PLAN_ORDER, USAGE_KINDS, type Feature, type Plan, type UsageKind, type UsageSummary } from '@/app/_shared/lib/usage/plans';
import { countOf, formatResetDate } from '@/app/_shared/lib/usage/usageCopy';

const FEATURES: { feature: Feature; label: string }[] = [
  { feature: 'auditAll', label: 'Audit all' },
  { feature: 'export', label: 'CSV and Google Sheets export' },
  { feature: 'branding', label: 'Your name and logo on reports' },
  { feature: 'mailbox', label: 'Send from your mailbox' },
  { feature: 'hubspot', label: 'HubSpot handoff' },
];

const NONE: Record<UsageKind, string> = {
  search: 'No searches',
  audit: 'No audits',
  email_lookup: 'No email lookups',
};

const usd = (n: number) => `$${n.toLocaleString('en-US')}`;

function lead(summary: UsageSummary | null): string {
  if (!summary) return "Couldn't load this month's usage. Refresh the page to try again.";
  if (summary.plan === 'owner') return 'Your account has no limits.';
  return `Your plan: ${PLANS[summary.plan].name}. This month's allowances reset on ${formatResetDate(summary.resetsAt)}.`;
}

function UsageRow({ kind, used, limit }: { kind: UsageKind; used: number; limit: number }) {
  const percent = Math.min(100, Math.round((used / limit) * 100));
  const full = used >= limit;
  return (
    <li className="space-y-2">
      <span className="text-sm text-[var(--color-text-primary)]">
        {used.toLocaleString('en-US')} of {countOf(kind, limit)} used
      </span>
      <div
        role="progressbar"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-label={countOf(kind, limit)}
        className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]"
      >
        <div
          className={`h-full rounded-full ${full ? 'bg-amber-500' : 'bg-[var(--color-primary-600)]'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </li>
  );
}

function PlanColumn({ plan, current }: { plan: Plan; current: boolean }) {
  return (
    <section
      aria-label={plan.name}
      className={`flex flex-col rounded-xl border p-5 ${
        current ? 'border-[var(--color-primary-600)]' : 'border-[var(--color-border)]'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-xl font-semibold text-[var(--color-text-primary)]">{plan.name}</h3>
        {current && <span className="text-xs font-semibold text-[var(--color-primary-600)]">Your plan</span>}
      </div>
      {plan.monthlyPrice ? (
        <p className="mt-2 text-sm text-[var(--color-text-primary)]">
          {usd(plan.monthlyPrice)} a month
          {plan.yearlyPrice ? (
            <span className="block text-[var(--color-text-tertiary)]">or {usd(plan.yearlyPrice)} a year</span>
          ) : null}
        </p>
      ) : (
        <p className="mt-2 text-sm text-[var(--color-text-primary)]">Free</p>
      )}

      <ul className="mt-4 space-y-1.5 text-sm text-[var(--color-text-secondary)]">
        {USAGE_KINDS.map((kind) => {
          const limit = plan.limits[kind];
          return <li key={kind}>{limit === 0 ? NONE[kind] : limit === null ? 'No limit' : `${countOf(kind, limit)} a month`}</li>;
        })}
      </ul>

      <ul className="mt-4 space-y-1.5 text-sm">
        {FEATURES.map(({ feature, label }) => {
          const included = plan.features[feature];
          return (
            <li
              key={feature}
              className={`flex items-center gap-2 ${
                included ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-tertiary)] line-through'
              }`}
            >
              {included ? <CheckIcon size={14} aria-hidden /> : <XIcon size={14} aria-hidden />}
              {label}
              <span className="sr-only">{included ? ', included' : ', not included'}</span>
            </li>
          );
        })}
      </ul>

      {!current && plan.monthlyPrice ? (
        <p className="mt-auto pt-5 text-sm text-[var(--color-text-tertiary)]">Coming soon</p>
      ) : null}
    </section>
  );
}

/** The account's plan and this month's usage, beside what Free, Pro and Agency include */
export function PlansView({ summary }: { summary: UsageSummary | null }) {
  const limited =
    summary && summary.plan !== 'owner'
      ? USAGE_KINDS.flatMap((kind) => {
          const { used, limit } = summary.usage[kind];
          return limit !== null && limit > 0 ? [{ kind, used, limit }] : [];
        })
      : [];

  return (
    <>
      <h1 className="font-display text-4xl font-semibold tracking-tight text-[var(--color-text-primary)]">Plans</h1>
      <p className="mt-3 max-w-xl text-base leading-relaxed text-[var(--color-text-secondary)]">{lead(summary)}</p>

      {limited.length > 0 && (
        <section className="mt-10 max-w-md">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">This month</h2>
          <ul className="mt-4 space-y-4">
            {limited.map((row) => (
              <UsageRow key={row.kind} {...row} />
            ))}
          </ul>
        </section>
      )}

      <section className="mt-12">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Compare plans</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {PLAN_ORDER.map((id) => (
            <PlanColumn key={id} plan={PLANS[id]} current={summary?.plan === id} />
          ))}
        </div>
      </section>
    </>
  );
}
