'use client';

// app/_shared/components/landing/pricingTable.tsx

// The landing page's prices, from the same plans and feature names as /plans.
// Every button starts at sign-up; a paid plan carries on to /plans to buy it.
// During the beta (checkout closed) the paid plans show their prices and say
// they open when it ends.

import { useState } from 'react';
import Link from 'next/link';
import { CheckIcon } from '@/app/_shared/components/ui/icons/icons';
import buttonStyles from '@/app/_shared/components/ui/button/button.module.scss';
import { cardClasses } from '@/app/_shared/components/landing/landingStyles';
import { periodOptionClasses, periodTrackClasses } from '@/app/_shared/components/auditely/billing/billingPeriodStyles';
import type { BillingInterval } from '@/app/_shared/lib/billing/billingRules';
import { ROUTES, plansPath } from '@/app/_shared/lib/config/routes';
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

/** Where a plan's button goes: sign-up, then a paid plan's prices on /plans, monthly or yearly as chosen here */
export function planHref(plan: Plan, interval: BillingInterval): string {
  return plan.monthlyPrice ? `${ROUTES.SIGNUP}?callbackUrl=${encodeURIComponent(plansPath(interval))}` : ROUTES.SIGNUP;
}

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

/** Where a paid plan's button would be while checkout is closed */
const waiting =
  'my-6 flex min-h-12 items-center justify-center rounded-xl border border-dashed border-[var(--color-border-hover)] px-4 text-[15px] font-semibold text-[var(--color-text-secondary)]';

function PlanCard({ plan, interval, open }: { plan: Plan; interval: BillingInterval; open: boolean }) {
  const { amount, per } = planPrice(plan, interval);
  const pick = plan.id === PICK;
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
      {plan.monthlyPrice && !open ? (
        <p className={waiting}>Opens after the beta</p>
      ) : (
        <Link href={planHref(plan, interval)} className={`${button(!pick)} my-6`}>
          {plan.monthlyPrice ? `Choose ${plan.name}` : 'Start free'}
        </Link>
      )}
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

/** @param checkoutOpen false during the beta: paid plans can't be bought yet */
export function PricingTable({ checkoutOpen }: { checkoutOpen: boolean }) {
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
          <PlanCard key={id} plan={PLANS[id]} interval={interval} open={checkoutOpen} />
        ))}
      </div>
      <p className="mt-6 text-sm text-[var(--color-text-tertiary)]">
        {checkoutOpen
          ? `Prices are in US dollars, before sales tax. Yearly: ${yearlyNote()}. Cancel any time from Settings.`
          : `Auditely is in beta, so Pro and Agency open when it ends. Prices are in US dollars, before sales tax. Yearly: ${yearlyNote()}.`}
      </p>
    </div>
  );
}
