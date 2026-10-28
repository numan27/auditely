import { describe, it, expect } from 'vitest';
import { DEMO_SIGN_OFF, unbrandSignOff } from '@/app/_shared/lib/demo/unbrand';

describe('unbrandSignOff', () => {
  it("swaps the owner's sign-off for a placeholder, on its own line or the same one", () => {
    expect(unbrandSignOff('Subject: Hi\nYour site is slow.\n\nThe DevArtVentures team')).toBe(
      `Subject: Hi\nYour site is slow.\n\n${DEMO_SIGN_OFF}`
    );
    expect(unbrandSignOff('Your site is slow.\nThe DevArtVentures team\n')).toBe(`Your site is slow.\n${DEMO_SIGN_OFF}`);
    expect(unbrandSignOff('Your site is slow. The DevArtVentures team')).toBe(`Your site is slow. ${DEMO_SIGN_OFF}`);
    expect(unbrandSignOff('Your site is slow.\n\nNuman, DevArtVentures')).toBe(`Your site is slow.\n\n${DEMO_SIGN_OFF}`);
  });

  it('leaves an email signed by anyone else alone', () => {
    for (const email of ['Your site is slow.\n\n[Your name]', 'Your site is slow.\n\nSam, Bright Web']) {
      expect(unbrandSignOff(email)).toBe(email);
    }
  });

  it('signs as the Auditely brand does', () => {
    expect(DEMO_SIGN_OFF).toBe('[Your name]');
  });
});
