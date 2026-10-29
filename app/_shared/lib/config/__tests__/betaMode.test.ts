import { describe, it, expect } from 'vitest';
import { betaMode } from '@/app/_shared/lib/config/betaMode';
import { checkoutOpen } from '@/app/_shared/lib/billing/billingRules';

describe('betaMode', () => {
  it('is on unless NEXT_PUBLIC_BETA_MODE says false', () => {
    expect([betaMode(undefined), betaMode(''), betaMode('true'), betaMode('yes'), betaMode('flase')]).toEqual([true, true, true, true, true]);
    expect([betaMode('false'), betaMode('False'), betaMode(' false ')]).toEqual([false, false, false]);
  });

  it('keeps Pro and Agency from being bought while it is on', () => {
    expect([checkoutOpen(undefined), checkoutOpen('true')]).toEqual([false, false]);
    expect(checkoutOpen('false')).toBe(true);
  });
});
