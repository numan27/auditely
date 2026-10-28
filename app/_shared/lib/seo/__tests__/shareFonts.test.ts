import { afterEach, describe, expect, it, vi } from 'vitest';
import { shareFonts } from '@/app/_shared/lib/seo/shareFonts';

// What Google Fonts answers a server: one TrueType file per face
const CSS = `
@font-face {
  font-family: 'Bricolage Grotesque';
  font-style: normal;
  font-weight: 700;
  src: url(https://fonts.gstatic.com/s/bricolage-700.ttf) format('truetype');
}
@font-face {
  font-family: 'Geist';
  font-style: normal;
  font-weight: 400;
  src: url(https://fonts.gstatic.com/s/geist-400.ttf) format('truetype');
}
@font-face {
  font-family: 'Geist';
  font-style: normal;
  font-weight: 600;
  src: url(https://fonts.gstatic.com/s/geist-600.ttf) format('truetype');
}`;

const bytes = (label: string) => new TextEncoder().encode(label).buffer;

function fakeFetch(overrides: Record<string, Response | Error> = {}) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    const override = Object.entries(overrides).find(([part]) => url.includes(part))?.[1];
    if (override instanceof Error) throw override;
    if (override) return override;
    if (url.startsWith('https://fonts.googleapis.com/')) return new Response(CSS);
    return new Response(bytes(url.split('/').at(-1)!));
  }) as unknown as typeof fetch;
}

afterEach(() => vi.restoreAllMocks());

describe('shareFonts', () => {
  it('loads Bricolage Grotesque for the headline and Geist for the rest', async () => {
    const fonts = await shareFonts(fakeFetch());
    expect(fonts.map(({ name, weight, style }) => ({ name, weight, style }))).toEqual([
      { name: 'Bricolage Grotesque', weight: 700, style: 'normal' },
      { name: 'Geist', weight: 400, style: 'normal' },
      { name: 'Geist', weight: 600, style: 'normal' },
    ]);
    expect(new TextDecoder().decode(fonts[2].data)).toBe('geist-600.ttf');
  });

  it("falls back to the image's default face when Google Fonts can't be reached", async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await shareFonts(fakeFetch({ 'fonts.googleapis.com': new TypeError('fetch failed') }))).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('fetch failed'));
  });

  it('falls back when a font file is missing, rather than sending some faces and not others', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await shareFonts(fakeFetch({ 'geist-600': new Response('Not found', { status: 404 }) }))).toEqual([]);
  });

  it('falls back when the answer has no TrueType faces', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await shareFonts(fakeFetch({ 'fonts.googleapis.com': new Response('/* nothing */') }))).toEqual([]);
  });
});
