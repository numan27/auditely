'use client';

// app/_shared/components/landing/pricingTable.tsx

// The landing page's prices, from the same plans and feature names as /plans.
// Every button starts at sign-up; a paid plan carries on to /plans to buy it.

import { useState } from 'react';
import Link from 'next/link';
import { CheckIcon } from '@/app/_shared/components/ui/icons/icons';
import buttonStyles from '@/app/_shared/components/ui/button/button.module.scss';
import { cardClasses } from '@/app/_shared/components/landing/landingStyles';
import { periodOptionClasses, periodTrackClasses } from '@/app/_shared/components/auditely/billing/billingPeriodStyles';
import type { BillingInterval } from '@/app/_shared/lib/billing/billingRules';
import { ROUTES } from '@/app/_shared/lib/config/routes';
import { PLANS, PLAN_ORDER, USAGE_KINDS, type Plan, type PlanId } from '@/app/_shared/lib/usage/plans';
import { PLAN_FEATURES, countOf } from '@/app/_shared/lib/usage/usageCopy';

const usd = (n: number) => `$${n.toLocaleString('en-US')}`;

/** "$24" and "a month", "$240" and "a year"; Free is "$0" either way */
export function planPrice(plan: Plan, interval: BillingInterval): { amount: string; per: string | null } {
  const price = (interval === 'year' ? plan.yearlyPrice : plan.monthlyPrice) ?? 0;
  if (!price) return { amount: '$0', per: null };
  return { amount: usd(price), per: interval === 'year' ? 'a year' : 'a month' };
}

const WHO: Partial<Record<PlanId, string>> = {
  free: 'For trying it out',
  pro: 'For freelancers',
  agency: 'For agencies',
};

/** The one the cards point to */
const PICK: PlanId = 'pro';

const button = (quiet: boolean) =>
  [buttonStyles.button, buttonStyles[quiet ? 'button--outline' : 'button--primary'], buttonStyles['button--lg'], buttonStyles['button--full-width']].join(' ');

/** What the plan gives beyond the one before: Free's extras, every paid feature on Pro, "Everything in Pro" on Agency */
function extras(plan: Plan): string[] {
  if (!plan.monthlyPrice) return ['Plain-English summaries and PDF reports'];
  const at = PLAN_ORDER.indexOf(plan.id);
  const before = at > 0 ? PLANS[PLAN_ORDER[at - 1]] : null;
  if (before?.monthlyPrice) return [`Everything in ${before.name}`];
  return PLAN_FEATURES.filter(({ feature }) => plan.features[feature]).map(({ label }) => label);
}

function PlanCard({ plan, interval }: { plan: Plan; interval: BillingInterval }) {
  const { amount, per } = planPrice(plan, interval);
  const pick = plan.id === PICK;
  const href = plan.monthlyPrice ? `${ROUTES.SIGNUP}?callbackUrl=${encodeURIComponent(ROUTES.PLANS)}` : ROUTES.SIGNUP;
  const lines = [
    ...USAGE_KINDS.flatMap((kind) => {
      const limit = plan.limits[kind];
      return limit ? [`${countOf(kind, limit)} a month`] : [];
    }),
    ...extras(plan),
  ];
  return (
    <section
      aria-label={plan.name}
      className={`${cardClasses} flex flex-col p-7 ${pick ? 'border-[1.5px] border-[var(--color-primary-600)]' : ''}`}
    >
      <h3 className="text-xl font-semibold text-[var(--color-text-primary)]">{plan.name}</h3>
      <p className="mb-5 mt-1.5 text-[15px] text-[var(--color-text-secondary)]">{WHO[plan.id]}</p>
      <p className="font-display text-5xl font-bold leading-none tracking-tight text-[var(--color-text-primary)]">
        {amount}
        {per && <small className="ml-1.5 font-sans text-[15px] font-medium tracking-normal text-[var(--color-text-secondary)]">{per}</small>}
      </p>
      <Link href={href} className={`${button(!pick)} my-6`}>
        {plan.monthlyPrice ? `Choose ${plan.name}` : 'Start free'}
      </Link>
      <ul className="flex flex-col gap-[11px]">
        {lines.map((line) => (
          <li key={line} className="grid grid-cols-[18px_1fr] gap-2.5 text-[15px] leading-snug text-[var(--color-text-primary)]">
            <CheckIcon size={16} className="mt-0.5 text-[var(--color-primary-600)]" aria-hidden />
            {line}
          </li>
        ))}
      </ul>
    </section>
  );
}

const yearlyNote = () => {
  const paid = PLAN_ORDER.map((id) => PLANS[id]).filter((plan) => plan.yearlyPrice);
  return paid.map((plan) => `${plan.name} is ${usd(plan.yearlyPrice ?? 0)}`).join(' and ');
};

export function PricingTable() {
  const [interval, setBilling] = useState<BillingInterval>('month');
  const toggle = (value: BillingInterval, label: string, extra?: string) => (
    <button
      type="button"
      aria-pressed={interval === value}
      onClick={() => setBilling(value)}
      className={periodOptionClasses(interval === value)}
    >
      {label}
      {extra && <em className="ml-1.5 not-italic font-semibold text-emerald-600 dark:text-emerald-400">{extra}</em>}
    </button>
  );
  return (
    <div>
      <div role="group" aria-label="Billing period" className={`mt-7 ${periodTrackClasses}`}>
        {toggle('month', 'Monthly')}
        {toggle('year', 'Yearly', 'two months free')}
      </div>
      <div className="mt-8 grid gap-5 min-[961px]:grid-cols-3">
        {PLAN_ORDER.map((id) => (
          <PlanCard key={id} plan={PLANS[id]} interval={interval} />
        ))}
      </div>
      <p className="mt-6 text-sm text-[var(--color-text-tertiary)]">
        Prices are in US dollars, before sales tax. Yearly: {yearlyNote()}. Cancel any time from Settings.
      </p>
    </div>
  );
}
