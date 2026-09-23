import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { analyzeSeoBasics, robotsTxtStatus } from '@/app/_shared/lib/audit/analyzers/seoBasics';

const ROBOTS_OK = { status: 200, body: 'User-agent: *\nDisallow:' };

const FULL_HEAD = `<head>
  <title>Smile Dental | Springfield Family Dentist</title>
  <meta name="description" content="Gentle family dentistry in Springfield, IL — cleanings, crowns and whitening.">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="canonical" href="https://smiledental.com/">
</head>`;

describe('analyzeSeoBasics', () => {
  it('passes a well-formed page', () => {
    const seo = analyzeSeoBasics(cheerio.load(FULL_HEAD), {}, ROBOTS_OK);
    expect(seo).toMatchObject({
      title: 'Smile Dental | Springfield Family Dentist',
      canonical: 'https://smiledental.com/',
      viewport: true,
      noindex: false,
      robotsTxt: 'ok',
    });
    expect(seo.findings.every((f) => f.status === 'pass')).toBe(true);
  });

  it('flags a missing title and a short description', () => {
    const seo = analyzeSeoBasics(cheerio.load('<head><meta name="description" content="Dentist"></head>'), {}, ROBOTS_OK);
    expect(seo.findings.find((f) => f.id === 'seo.title')).toMatchObject({ status: 'fail', label: 'Page title missing' });
    expect(seo.findings.find((f) => f.id === 'seo.metaDescription')).toMatchObject({
      status: 'warn',
      label: 'Meta description is 7 characters (aim for 50–160)',
    });
    expect(seo.findings.find((f) => f.id === 'seo.viewport')?.status).toBe('fail');
  });

  it('reads meta names case-insensitively', () => {
    const $ = cheerio.load(`<head>
      <meta name="Description" content="Gentle family dentistry in Springfield, IL: cleanings, crowns and whitening.">
      <meta name="Viewport" content="width=device-width">
      <meta name="ROBOTS" content="noindex">
    </head>`);
    const seo = analyzeSeoBasics($, {}, ROBOTS_OK);
    expect(seo.metaDescription).toBe('Gentle family dentistry in Springfield, IL: cleanings, crowns and whitening.');
    expect(seo).toMatchObject({ viewport: true, noindex: true });
  });

  it('uses the head title, not an inline SVG title', () => {
    const $ = cheerio.load(
      '<html><head><title>Smile Dental | Springfield</title></head><body><svg><title>Icon</title></svg></body></html>'
    );
    expect(analyzeSeoBasics($, {}, ROBOTS_OK).title).toBe('Smile Dental | Springfield');
    const noHeadTitle = cheerio.load('<html><head></head><body><svg><title>Icon</title></svg></body></html>');
    expect(analyzeSeoBasics(noHeadTitle, {}, ROBOTS_OK).title).toBe('Icon');
  });

  it('detects noindex from the X-Robots-Tag header', () => {
    const seo = analyzeSeoBasics(cheerio.load(FULL_HEAD), { 'x-robots-tag': 'noindex, nofollow' }, ROBOTS_OK);
    expect(seo.noindex).toBe(true);
    expect(seo.findings.find((f) => f.id === 'seo.noindex')?.status).toBe('fail');
  });
});

describe('robotsTxtStatus', () => {
  it('detects a robots.txt that blocks everyone', () => {
    expect(robotsTxtStatus({ status: 200, body: 'User-agent: Googlebot\nUser-agent: *\nDisallow: /' })).toBe('blocks-all');
  });

  it('allows partial disallows and non-* groups', () => {
    expect(robotsTxtStatus({ status: 200, body: 'User-agent: *\nDisallow: /private' })).toBe('ok');
    expect(robotsTxtStatus({ status: 200, body: 'User-agent: BadBot\nDisallow: /\n\nUser-agent: *\nDisallow:' })).toBe('ok');
  });

  it('reports missing and unknown robots.txt', () => {
    expect(robotsTxtStatus({ status: 404, body: null })).toBe('missing');
    expect(robotsTxtStatus({ status: null, body: null })).toBe('unknown');
    expect(robotsTxtStatus({ status: 500, body: null })).toBe('unknown');
  });
});
