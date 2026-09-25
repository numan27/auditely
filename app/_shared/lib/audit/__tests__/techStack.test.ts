import { describe, it, expect } from 'vitest';
import { detectTechStack } from '@/app/_shared/lib/audit/analyzers/techStack';

const names = (html: string | null, headers: Record<string, string> = {}) =>
  detectTechStack(html, headers).map((item) => item.name);

describe('detectTechStack', () => {
  it('detects WordPress with its version and page builder', () => {
    const html = `
      <meta name="generator" content="WordPress 6.2.1">
      <link rel="stylesheet" href="/wp-content/plugins/elementor/assets/css/frontend.min.css">
      <div class="elementor-section"></div>`;
    expect(detectTechStack(html, {})).toEqual([
      { name: 'WordPress', category: 'platform', version: '6.2.1' },
      { name: 'Elementor', category: 'pageBuilder' },
    ]);
  });

  it('detects hosted site builders', () => {
    expect(names('<img src="https://static.wixstatic.com/media/x.jpg">')).toEqual(['Wix']);
    expect(names('<script src="https://static1.squarespace.com/static/x.js"></script>')).toEqual(['Squarespace']);
    expect(names('<html data-wf-site="123"></html>')).toEqual(['Webflow']);
    expect(names('<meta name="generator" content="Starfield Technologies; Go Daddy Website Builder 8.0.0000">')).toEqual([
      'GoDaddy Website Builder',
    ]);
    expect(names('<script src="//cdn.shopify.com/s/files/x.js"></script>')).toEqual(['Shopify']);
  });

  it('detects frameworks, hosting and server software from headers', () => {
    const html = '<script id="__NEXT_DATA__" type="application/json">{}</script>';
    expect(names(html, { 'x-vercel-id': 'iad1::abc', 'x-powered-by': 'Next.js' })).toEqual(['Next.js', 'Vercel']);
    expect(detectTechStack(null, { server: 'cloudflare', 'x-powered-by': 'PHP/7.4.33' })).toEqual([
      { name: 'PHP', category: 'framework', version: '7.4.33' },
      { name: 'Cloudflare', category: 'hosting' },
    ]);
  });

  it('reads GoDaddy assets as GoDaddy hosting, not its site builder', () => {
    // GoDaddy injects this script into every site it hosts, WordPress included
    const html = `<link href="/wp-content/themes/x/style.css">
      <script src='https://img1.wsimg.com/traffic-assets/js/tccl.min.js'></script>`;
    expect(names(html)).toEqual(['WordPress', 'GoDaddy']);
  });

  it('identifies SiteGround hosting even when the page itself was blocked', () => {
    expect(names(null, { 'sg-captcha': 'challenge', server: 'nginx' })).toEqual(['SiteGround']);
  });

  it('detects analytics, ads and booking/chat widgets', () => {
    const html = `
      <script async src="https://www.googletagmanager.com/gtag/js?id=G-ABC123"></script>
      <script>fbq('init', '123');</script>
      <script src="https://cdn.callrail.com/companies/1/swap.js"></script>
      <a href="https://www.zocdoc.com/practice/smile-dental-1">Book online</a>
      <script src="https://embed.tawk.to/abc/default"></script>`;
    expect(detectTechStack(html, {})).toEqual([
      { name: 'Google Analytics', category: 'analytics' },
      { name: 'Meta Pixel', category: 'analytics' },
      { name: 'CallRail', category: 'analytics' },
      { name: 'Zocdoc', category: 'widgets' },
      { name: 'Tawk.to', category: 'widgets' },
    ]);
  });

  it('reports nothing it cannot see', () => {
    expect(detectTechStack('<html><body><p>Hello</p></body></html>', { server: 'nginx' })).toEqual([]);
    expect(detectTechStack(null, {})).toEqual([]);
  });
});
