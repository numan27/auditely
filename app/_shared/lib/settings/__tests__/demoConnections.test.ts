// The public demo reads as anyone's account: its drafts never sign as the owner
import { describe, it, expect } from 'vitest';
import { DEMO_CONNECTIONS } from '@/app/_shared/lib/settings/demoConnections';
import { DEMO_SIGN_OFF } from '@/app/_shared/lib/demo/unbrand';

describe('DEMO_CONNECTIONS', () => {
  it('signs the drafts with placeholders, not DevArtVentures', () => {
    expect(DEMO_CONNECTIONS.sender).toEqual({ name: '[Your agency]', signOff: DEMO_SIGN_OFF });
    expect(JSON.stringify(DEMO_CONNECTIONS)).not.toMatch(/dev\s*art\s*ventures|numan/i);
  });
});
