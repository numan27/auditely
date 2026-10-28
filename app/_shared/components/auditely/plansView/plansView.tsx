// app/_shared/components/auditely/plansView/plansView.tsx

import Link from 'next/link';
import { BillingButton } from '@/app/_shared/components/auditely/billing/billingButton';
import { periodOptionClasses, periodTrackClasses } from '@/app/_shared/components/auditely/billing/billingPeriodStyles';
import { CheckIcon, XIcon } from '@/app/_shared/components/ui/icons/icons';
import type { BillingInterval, Subscription } from '@/app/_shared/lib/billing/billingRules';
import { API_ROUTES, ROUTES } from '@/app/_shared/lib/config/routes';
import { PLANS, PLAN_ORDER, USAGE_KINDS, type Plan, type UsageKind, type UsageSummary } from '@/app/_shared/lib/usage/plans';
import { PLAN_FEATURES, countOf, formatResetDate } from '@/app/_shared/lib/usage/usageCopy';

export interface PlansBilling {
  /** STRIPE_SECRET_KEY is set; without it the paid plans say "Coming soon", as today */
  ready: boolean;
  /** The owner never buys */
  canBuy: boolean;
  subscription: Subscription | null;
  /** The interval Checkout buys: /plans?billing=yearly picks yearly */
  interval: BillingInterval;
  /** Back from Checkout (/plans?subscribed=1) */
  justSubscribed: boolean;
}

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

/** The price: one interval's while buying, else both */
function Price({ plan, interval }: { plan: Plan; interval: BillingInterval | null }) {
  const className = 'mt-2 text-sm text-[var(--color-text-primary)]';
  if (!plan.monthlyPrice) return <p className={className}>Free</p>;
  if (interval === 'month') return <p className={className}>{usd(plan.monthlyPrice)} a month</p>;
  if (interval === 'year' && plan.yearlyPrice) {
    return (
      <p className={className}>
        {usd(plan.yearlyPrice)} a year
        <span className="block text-[var(--color-text-tertiary)]">Two months free</span>
      </p>
    );
  }
  return (
    <p className={className}>
      {usd(plan.monthlyPrice)} a month
      {plan.yearlyPrice ? <span className="block text-[var(--color-text-tertiary)]">or {usd(plan.yearlyPrice)} a year</span> : null}
    </p>
  );
}

/** Checkout is open: Stripe is set up, the account can buy, has no plan, and isn't waiting on a payment */
const isBuying = (billing: PlansBilling) =>
  billing.ready && billing.canBuy && !billing.subscription && !billing.justSubscribed;

/** Buy it, manage it, or "Coming soon" until Stripe is set up; nothing for Free, the plan held, or the owner */
function PlanAction({ plan, current, billing }: { plan: Plan; current: boolean; billing: PlansBilling }) {
  if (!plan.monthlyPrice || !billing.canBuy) return null;
  if (!billing.ready) {
    return current ? null : <p className="mt-auto pt-5 text-sm text-[var(--color-text-tertiary)]">Coming soon</p>;
  }
  const { subscription } = billing;
  // Back from a payment Stripe hasn't confirmed yet: a second Checkout would buy a second plan
  if (!subscription && billing.justSubscribed) return null;
  // Switching and cancelling happen in Stripe's portal, so a second Checkout can't start a second subscription
  const button = subscription ? (
    <BillingButton
      label={subscription.plan === plan.id ? 'Manage billing' : 'Change plan'}
      url={API_ROUTES.BILLING_PORTAL}
      body={{ returnTo: 'plans' }}
      variant="outline"
      fullWidth
    />
  ) : current ? null : (
    <BillingButton
      label={`Choose ${plan.name}`}
      url={API_ROUTES.BILLING_CHECKOUT}
      body={{ plan: plan.id, interval: billing.interval }}
      fullWidth
    />
  );
  return button && <div className="mt-auto pt-5">{button}</div>;
}

const INTERVAL_LINKS: { interval: BillingInterval; label: string; href: string }[] = [
  { interval: 'month', label: 'Monthly', href: ROUTES.PLANS },
  { interval: 'year', label: 'Yearly', href: `${ROUTES.PLANS}?billing=yearly` },
];

/** Monthly or yearly, as links: the page reads the choice from its address */
function IntervalSwitch({ interval }: { interval: BillingInterval }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
      <div role="group" aria-label="Billing period" className={periodTrackClasses}>
        {INTERVAL_LINKS.map((option) => {
          const selected = option.interval === interval;
          return (
            <Link
              key={option.interval}
              href={option.href}
              scroll={false}
              aria-current={selected ? 'true' : undefined}
              className={periodOptionClasses(selected)}
            >
              {option.label}
            </Link>
          );
        })}
      </div>
      <p className="text-sm text-[var(--color-text-tertiary)]">Two months free with yearly billing.</p>
    </div>
  );
}

/** Back from Checkout: the new plan, or that Stripe hasn't confirmed it yet */
function Welcome({ subscription }: { subscription: Subscription | null }) {
  return (
    <p
      role="status"
      className="mt-6 max-w-xl rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3 text-sm text-[var(--color-text-primary)]"
    >
      {subscription
        ? `You're on the ${PLANS[subscription.plan].name} plan. Your new allowances start today.`
        : 'Payment received. Your plan shows here once Stripe confirms it. Refresh the page in a minute.'}
    </p>
  );
}

function PlanColumn({ plan, current, billing }: { plan: Plan; current: boolean; billing: PlansBilling }) {
  const buying = isBuying(billing);
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
      <Price plan={plan} interval={buying ? billing.interval : null} />

      <ul className="mt-4 space-y-1.5 text-sm text-[var(--color-text-secondary)]">
        {USAGE_KINDS.map((kind) => {
          const limit = plan.limits[kind];
          return <li key={kind}>{limit === 0 ? NONE[kind] : limit === null ? 'No limit' : `${countOf(kind, limit)} a month`}</li>;
        })}
      </ul>

      <ul className="mt-4 space-y-1.5 text-sm">
        {PLAN_FEATURES.map(({ feature, label }) => {
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

      <PlanAction plan={plan} current={current} billing={billing} />
    </section>
  );
}

/** The account's plan and this month's usage, beside what Free, Pro and Agency include and the way to buy them */
export function PlansView({ summary, billing }: { summary: UsageSummary | null; billing: PlansBilling }) {
  const buying = isBuying(billing);
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
      {billing.justSubscribed && <Welcome subscription={billing.subscription} />}

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
        {buying && <IntervalSwitch interval={billing.interval} />}
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {PLAN_ORDER.map((id) => (
            <PlanColumn key={id} plan={PLANS[id]} current={summary?.plan === id} billing={billing} />
          ))}
        </div>
      </section>
    </>
  );
}
