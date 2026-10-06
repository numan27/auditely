import { describe, it, expect } from 'vitest';
import { sentOn } from '@/app/_shared/lib/utils/sentOn';

describe('sentOn', () => {
  it("gives the day on the viewer's own calendar, right up to both ends of it", () => {
    expect(sentOn(new Date(2026, 9, 3, 0, 30).toISOString())).toBe('Oct 3');
    expect(sentOn(new Date(2026, 9, 3, 23, 30).toISOString())).toBe('Oct 3');
  });
});
