import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { PUT } from '@/app/api/studio/route';
import { POST } from '@/app/api/studio/preview/route';
import { renderPdf } from '@/app/_shared/lib/audit/pdfRender';
import { DEFAULT_DESIGN } from '@/app/_shared/lib/brand/brandDesign';
import type { Brand } from '@/app/_shared/lib/brand/brandRules';
import { featureMessage } from '@/app/_shared/lib/usage/usageCopy';

// Fake Supabase: every profile update, and what it answers
const db = vi.hoisted(() => {
  const state = { updates: [] as Record<string, unknown>[], error: null as { code: string; message: string } | null, rows: [{ id: 'user-2' }] };
  const from = () => ({
    update: (value: Record<string, unknown>) => {
      state.updates.push(value);
      return { eq: () => ({ select: async () => ({ data: state.error ? null : state.rows, error: state.error }) }) };
    },
  });
  return { state, from };
});
const session = vi.hoisted(() => ({ current: null as unknown }));
// The routes run as the signed-in user: the service client must stay unused
vi.mock('@/app/_shared/lib/supabase/client', () => ({ serviceDb: {} }));
vi.mock('@/app/_shared/lib/supabase/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/supabase/server')>()),
  getSession: async () => session.current,
}));
// Drawing the PDF has its own tests
vi.mock('@/app/_shared/lib/audit/pdfRender', () => ({ renderPdf: vi.fn(async () => Buffer.from('%PDF-1.7')) }));

const signIn = (plan: 'free' | 'pro' | null, isOwner = false) => {
  session.current = {
    db: { from: db.from },
    account: { id: 'user-2', email: 'sam@acme.studio', isOwner, subscription: plan && plan !== 'free' ? { plan, status: 'active' } : null },
  };
};
const profile = { display_name: 'Sam Lee', company: 'Acme Studio', website: 'acme.studio', contact_email: '', contact_phone: '', booking_url: '', logo_data_url: null };
const design = { ...DEFAULT_DESIGN, accent: '#0E7490', title: 'Website health check' };
const request = (method: string, body: unknown) =>
  new NextRequest(`http://localhost/api/studio${method === 'POST' ? '/preview' : ''}`, { method, body: JSON.stringify(body) });

beforeEach(() => {
  db.state.updates = [];
  db.state.error = null;
  vi.mocked(renderPdf).mockClear();
});

describe('PUT /api/studio', () => {
  it('saves the profile and the design together, as the user', async () => {
    signIn('pro');
    const res = await PUT(request('PUT', { profile, design }));
    expect(res.status).toBe(200);
    expect(db.state.updates).toHaveLength(1);
    expect(db.state.updates[0]).toMatchObject({
      display_name: 'Sam Lee',
      company: 'Acme Studio',
      website: 'https://acme.studio/',
      contact_email: null,
      brand_design: { ...DEFAULT_DESIGN, accent: '#0e7490', title: 'Website health check' },
    });
    expect(await res.json()).toMatchObject({ design: { accent: '#0e7490' } });
  });

  it('lets the owner save', async () => {
    signIn(null, true);
    expect((await PUT(request('PUT', { profile, design }))).status).toBe(200);
  });

  it('refuses a Free account, saying which plans have it, and saves nothing', async () => {
    signIn('free');
    const res = await PUT(request('PUT', { profile, design }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: featureMessage('branding') });
    expect(db.state.updates).toEqual([]);
  });

  it('names the field that is wrong, in the profile or the design', async () => {
    signIn('pro');
    const badEmail = await PUT(request('PUT', { profile: { ...profile, contact_email: 'sam@' }, design }));
    expect(badEmail.status).toBe(400);
    expect(await badEmail.json()).toMatchObject({ field: 'contact_email' });
    const badColour = await PUT(request('PUT', { profile, design: { ...design, button: 'teal' } }));
    expect(badColour.status).toBe(400);
    expect(await badColour.json()).toMatchObject({ field: 'button', error: 'Pick a colour, or type one like #1f6feb.' });
    expect(db.state.updates).toEqual([]);
  });

  it('refuses a body without a profile rather than blanking it', async () => {
    signIn('pro');
    const res = await PUT(request('PUT', { design }));
    expect(res.status).toBe(400);
    expect(db.state.updates).toEqual([]);
  });

  it('tells the owner which migration to run when the column isn’t there yet', async () => {
    signIn(null, true);
    db.state.error = { code: 'PGRST204', message: "Could not find the 'brand_design' column" };
    const res = await PUT(request('PUT', { profile, design }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toContain('docs/migrations/2026-11-02-brand-studio.sql');
    signIn('pro');
    const member = await PUT(request('PUT', { profile, design }));
    expect((await member.json()).error).toBe("Your brand can't be saved right now. Try again later.");
  });
});

describe('POST /api/studio/preview', () => {
  const brandDrawn = () => vi.mocked(renderPdf).mock.calls[0][3] as Brand;

  it('draws the sample report in the draft brand and design, without saving anything', async () => {
    signIn('pro');
    const res = await POST(request('POST', { profile, design }));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(brandDrawn()).toMatchObject({ kind: 'account', name: 'Acme Studio', design: { accent: '#0e7490', title: 'Website health check' } });
    expect(vi.mocked(renderPdf).mock.calls[0][1].name).toBeTruthy();
    expect(db.state.updates).toEqual([]);
  });

  // The preview is the sample business only: a Free account sees what the studio would do for it
  it('shows a Free account the branded preview too', async () => {
    signIn('free');
    expect((await POST(request('POST', { profile, design }))).status).toBe(200);
    expect(brandDrawn()).toMatchObject({ kind: 'account', name: 'Acme Studio' });
  });

  it('leaves out a half-typed field instead of refusing the preview', async () => {
    signIn('pro');
    const res = await POST(request('POST', { profile: { ...profile, contact_email: 'sam@', booking_url: 'not a url' }, design }));
    expect(res.status).toBe(200);
    expect(brandDrawn().contact).toMatchObject({ email: 'sam@acme.studio', bookingUrl: null });
  });
});

describe('POST /api/studio/preview for the email', () => {
  it('answers the sample outreach email in the draft brand and design', async () => {
    signIn('pro');
    const res = await POST(request('POST', { profile, design: { ...design, ctaButton: 'Pick a time' }, format: 'email' }));
    expect(res.status).toBe(200);
    const { html } = await res.json();
    expect(html).toContain('Acme Studio');
    expect(html).toContain('>Pick a time</a>');
    expect(html).toContain('color:#0e7490');
    expect(html).toContain('Sam Lee, Acme Studio');
    expect(renderPdf).not.toHaveBeenCalled();
  });

  it('says what to add when the draft has no name or company to send from', async () => {
    signIn('pro');
    const res = await POST(request('POST', { profile: { ...profile, display_name: '', company: '' }, design, format: 'email' }));
    expect(await res.json()).toEqual({ html: null, error: "Add your name or company under Brand, so the email says who it's from." });
  });
});
