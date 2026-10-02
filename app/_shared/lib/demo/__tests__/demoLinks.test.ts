import { describe, it, expect } from 'vitest';
import { demoLinks, loomPlayerUrl } from '@/app/_shared/lib/demo/demoLinks';

const NONE = { videoUrl: null, videoPlayerUrl: null, contactUrl: null };

describe('demoLinks', () => {
  it('reads the walkthrough and contact links, trimmed', () => {
    expect(demoLinks({ DEMO_VIDEO_URL: ' https://example.com/walkthrough ', DEMO_CONTACT_URL: 'https://www.upwork.com/freelancers/~01' })).toEqual({
      videoUrl: 'https://example.com/walkthrough',
      videoPlayerUrl: null,
      contactUrl: 'https://www.upwork.com/freelancers/~01',
    });
  });

  it('has no links when nothing is set', () => {
    expect(demoLinks({})).toEqual(NONE);
    expect(demoLinks({ DEMO_VIDEO_URL: '', DEMO_CONTACT_URL: '   ' })).toEqual(NONE);
  });

  it('drops anything that is not a web link', () => {
    for (const value of ['javascript:alert(1)', 'loom.com/share/abc', 'mailto:me@example.com', 'data:text/html,hi', 'not a link']) {
      expect(demoLinks({ DEMO_VIDEO_URL: value, DEMO_CONTACT_URL: value })).toEqual(NONE);
    }
  });

  it('gives a Loom walkthrough a player that can open inside the demo', () => {
    const links = demoLinks({ DEMO_VIDEO_URL: 'https://www.loom.com/share/0a1b2c3d4e5f60718293a4b5c6d7e8f9?sid=xyz' });
    expect(links.videoUrl).toBe('https://www.loom.com/share/0a1b2c3d4e5f60718293a4b5c6d7e8f9?sid=xyz');
    expect(links.videoPlayerUrl).toBe(loomPlayerUrl(links.videoUrl!));
    expect(links.videoPlayerUrl).toMatch(/^https:\/\/www\.loom\.com\/embed\/0a1b2c3d4e5f60718293a4b5c6d7e8f9\?/);
  });
});

describe('loomPlayerUrl', () => {
  const PLAYER = 'https://www.loom.com/embed/0a1b2c3d?autoplay=1&hide_owner=true&hide_share=true&hide_title=true&hideEmbedTopBar=true';

  it('turns a share link into the player that starts by itself', () => {
    expect(loomPlayerUrl('https://www.loom.com/share/0a1b2c3d')).toBe(PLAYER);
  });

  it('accepts the link with or without www, with a tracking suffix, or already as a player link', () => {
    for (const link of [
      'https://loom.com/share/0a1b2c3d',
      'https://www.loom.com/share/0a1b2c3d?sid=1234-abcd',
      'https://www.loom.com/share/0a1b2c3d/',
      'https://www.loom.com/embed/0a1b2c3d',
      'http://www.loom.com/share/0a1b2c3d',
    ]) {
      expect(loomPlayerUrl(link), link).toBe(PLAYER);
    }
  });

  it('has no player for anything that is not a Loom video', () => {
    for (const link of [
      'https://www.youtube.com/watch?v=abc',
      'https://example.com/share/0a1b2c3d',
      'https://loom.com.example.com/share/0a1b2c3d',
      'https://notloom.com/share/0a1b2c3d',
      'https://www.loom.com/',
      'https://www.loom.com/looms/videos',
      'https://www.loom.com/share/',
      'https://www.loom.com/share/a%22%20onload%3Dalert(1)',
      'https://www.loom.com/share/abc/extra',
      'not a link',
    ]) {
      expect(loomPlayerUrl(link), link).toBeNull();
    }
  });
});
