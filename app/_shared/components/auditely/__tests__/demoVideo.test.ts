import { describe, it, expect } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DemoBanner } from '@/app/_shared/components/auditely/demoBanner/demoBanner';
import { DemoNoticeModal } from '@/app/_shared/components/auditely/demoNoticeModal/demoNoticeModal';
import { DemoVideoModal } from '@/app/_shared/components/auditely/demoVideoModal/demoVideoModal';
import { DemoVideoThumb } from '@/app/_shared/components/auditely/demoVideoThumb/demoVideoThumb';
import { demoLinks, type DemoLinks } from '@/app/_shared/lib/demo/demoLinks';
import type { DemoData } from '@/app/_shared/lib/demo/demoSamples';
import { DemoContext, type Demo } from '@/app/_shared/lib/hooks/useDemo';

const LOOM = demoLinks({ DEMO_VIDEO_URL: 'https://www.loom.com/share/0a1b2c3d' });
const ELSEWHERE = demoLinks({ DEMO_VIDEO_URL: 'https://youtu.be/abc' });
const NO_VIDEO = demoLinks({});

// The page as the demo draws it, before anything is pressed
function inDemo(links: DemoLinks, element: ReactElement): string {
  const demo: Demo = {
    data: {} as DemoData,
    links,
    replay: (async () => {
      throw new Error('not used');
    }) as Demo['replay'],
    restrict: () => {},
    playVideo: () => {},
  };
  return renderToStaticMarkup(createElement(DemoContext.Provider, { value: demo }, element));
}

describe('DemoVideoThumb', () => {
  it('is a button that plays a Loom walkthrough, without loading the player yet', () => {
    const html = inDemo(LOOM, createElement(DemoVideoThumb));
    expect(html).toMatch(/^<button type="button"/);
    expect(html).toContain('Watch a live search and audit');
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('loom.com');
  });

  it('is a link to a new tab when the walkthrough is hosted elsewhere', () => {
    const html = inDemo(ELSEWHERE, createElement(DemoVideoThumb));
    expect(html).toMatch(/^<a href="https:\/\/youtu\.be\/abc" target="_blank" rel="noopener noreferrer"/);
    expect(html).not.toContain('<button');
  });

  it('is absent without a walkthrough', () => {
    expect(inDemo(NO_VIDEO, createElement(DemoVideoThumb))).toBe('');
  });

  it('is absent in the real app', () => {
    expect(renderToStaticMarkup(createElement(DemoVideoThumb))).toBe('');
  });
});

describe('DemoVideoModal', () => {
  it('shows the player, allowed to start by itself and to go full screen', () => {
    const html = renderToStaticMarkup(createElement(DemoVideoModal, { playerUrl: LOOM.videoPlayerUrl!, onClose: () => {} }));
    const iframe = /<iframe[^>]*>/.exec(html)?.[0] ?? '';
    expect(iframe).toContain(`src="${LOOM.videoPlayerUrl!.replaceAll('&', '&amp;')}"`);
    expect(iframe).toMatch(/allow="[^"]*autoplay[^"]*fullscreen/);
    expect(iframe).toContain('title="');
  });
});

describe('DemoNoticeModal', () => {
  const notice = (links: DemoLinks) => inDemo(links, createElement(DemoNoticeModal, { action: 'search', links, onClose: () => {} }));

  it('plays a Loom walkthrough in the demo instead of leaving for a new tab', () => {
    const html = notice(LOOM);
    expect(html).toMatch(/<button type="button"[^>]*>Watch the 45-second walkthrough<\/button>/);
    expect(html).not.toContain('loom.com');
  });

  it('links to a walkthrough hosted elsewhere', () => {
    expect(notice(ELSEWHERE)).toMatch(/<a href="https:\/\/youtu\.be\/abc" target="_blank"[^>]*>Watch the 45-second walkthrough<\/a>/);
  });

  it('mentions no walkthrough when there is none', () => {
    expect(notice(NO_VIDEO)).not.toContain('walkthrough');
  });
});

describe('DemoBanner', () => {
  it('leaves the walkthrough to the thumbnail beside the heading', () => {
    const html = inDemo(LOOM, createElement(DemoBanner));
    expect(html).toContain('Demo:');
    expect(html).not.toContain('walkthrough');
    expect(html).not.toContain('<a ');
  });
});
