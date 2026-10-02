import { describe, it, expect } from 'vitest';
import { demoLinks } from '@/app/_shared/lib/demo/demoLinks';

describe('demoLinks', () => {
  it('reads the walkthrough and contact links, trimmed', () => {
    expect(demoLinks({ DEMO_VIDEO_URL: ' https://www.loom.com/share/abc ', DEMO_CONTACT_URL: 'https://www.upwork.com/freelancers/~01' })).toEqual({
      videoUrl: 'https://www.loom.com/share/abc',
      contactUrl: 'https://www.upwork.com/freelancers/~01',
    });
  });

  it('has no links when nothing is set', () => {
    expect(demoLinks({})).toEqual({ videoUrl: null, contactUrl: null });
    expect(demoLinks({ DEMO_VIDEO_URL: '', DEMO_CONTACT_URL: '   ' })).toEqual({ videoUrl: null, contactUrl: null });
  });

  it('drops anything that is not a web link', () => {
    for (const value of ['javascript:alert(1)', 'loom.com/share/abc', 'mailto:me@example.com', 'data:text/html,hi', 'not a link']) {
      expect(demoLinks({ DEMO_VIDEO_URL: value, DEMO_CONTACT_URL: value })).toEqual({ videoUrl: null, contactUrl: null });
    }
  });
});
