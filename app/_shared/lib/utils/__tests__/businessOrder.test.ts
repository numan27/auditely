import { describe, it, expect } from 'vitest';
import { websiteFirst } from '@/app/_shared/lib/utils/businessOrder';

describe('websiteFirst', () => {
  it('moves businesses without a website to the end, keeping the order within each group', () => {
    const list = [
      { name: 'a', website: null },
      { name: 'b', website: 'https://b.com' },
      { name: 'c', website: null },
      { name: 'd', website: 'https://d.com' },
    ];
    expect(websiteFirst(list).map((b) => b.name)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('does not mutate the input', () => {
    const list = [{ website: null }, { website: 'https://x.com' }];
    websiteFirst(list);
    expect(list[0].website).toBeNull();
  });
});
