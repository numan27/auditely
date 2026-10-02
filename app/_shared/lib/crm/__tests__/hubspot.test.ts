import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { describeHubSpotError, HubSpotError, sendLead } from '@/app/_shared/lib/crm/hubspot';
import type { LeadPayload } from '@/app/_shared/lib/crm/leadPayload';

type Call = { method: string; path: string; body: Record<string, unknown> | null };
type Answer = { status: number; body?: unknown };

// A fake HubSpot: `answer` decides each response; every call is recorded
const calls: Call[] = [];
let answer: (call: Call) => Answer;
const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
  const call: Call = { method: init.method ?? 'GET', path: new URL(url).pathname, body: init.body ? JSON.parse(String(init.body)) : null };
  calls.push(call);
  const { status, body } = answer(call);
  return new Response(body === undefined ? null : JSON.stringify(body), { status });
});

const V = '/crm/objects/2026-09';
const lead = (over: Partial<LeadPayload> = {}): LeadPayload => ({
  domain: 'smiledental.com',
  company: { name: 'Smile Dental', domain: 'smiledental.com', industry: 'MEDICAL_PRACTICE' },
  contact: { email: 'office@smiledental.com', properties: { email: 'office@smiledental.com', company: 'Smile Dental' } },
  onCreate: { company: { lifecyclestage: 'lead' }, contact: { lifecyclestage: 'lead', hs_lead_status: 'NEW' } },
  noteHtml: '<p>Audit</p>',
  ...over,
});
// Nothing exists yet: searches find nothing, creates return new ids
const emptyHubSpot = (call: Call): Answer => {
  if (call.path.endsWith('/search')) return { status: 200, body: { total: 0, results: [] } };
  if (call.method === 'POST' && call.path === `${V}/companies`) return { status: 201, body: { id: 'c-new' } };
  if (call.method === 'POST' && call.path === `${V}/contacts`) return { status: 201, body: { id: 'p-new' } };
  if (call.method === 'POST' && call.path === `${V}/notes`) return { status: 201, body: { id: 'n1' } };
  if (call.method === 'PUT') return { status: 200, body: {} };
  return { status: 404, body: { message: 'Not found' } };
};
// Refuses a write that carries any of these properties, wording it as HubSpot does
const rejecting = (call: Call, errors: Record<string, string>): Answer => {
  const sent = Object.keys((call.body as { properties?: Record<string, string> } | null)?.properties ?? {});
  const refused = Object.entries(errors).filter(([name]) => sent.includes(name));
  if (!refused.length) return emptyHubSpot(call);
  const details = refused.map(([name, error]) => ({ isValid: false, message: `${name} was refused`, error, name }));
  return { status: 400, body: { message: `Property values were not valid: ${JSON.stringify(details)}` } };
};
const send = (l: LeadPayload = lead(), savedCompanyId: string | null = null) => {
  const onCompanySaved = vi.fn(async () => {});
  return { result: sendLead('token-1', l, { savedCompanyId, onCompanySaved }), onCompanySaved };
};
const only = (method: string, path: string) => calls.filter((c) => c.method === method && c.path === path);

beforeEach(() => {
  calls.length = 0;
  answer = emptyHubSpot;
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('sendLead', () => {
  it('creates the company and contact as leads, links them, and adds the note to both', async () => {
    const { result, onCompanySaved } = send();
    expect(await result).toEqual({ companyId: 'c-new', contactId: 'p-new' });
    expect(onCompanySaved).toHaveBeenCalledWith('c-new');
    expect(only('POST', `${V}/companies`)[0].body).toEqual({
      properties: { name: 'Smile Dental', domain: 'smiledental.com', industry: 'MEDICAL_PRACTICE', lifecyclestage: 'lead' },
    });
    expect(only('POST', `${V}/contacts`)[0].body).toEqual({
      properties: { email: 'office@smiledental.com', company: 'Smile Dental', lifecyclestage: 'lead', hs_lead_status: 'NEW' },
    });
    expect(only('PUT', `${V}/contact/p-new/associations/default/company/c-new`)).toHaveLength(1);
    const note = only('POST', `${V}/notes`)[0].body as { properties: Record<string, string>; associations: unknown[] };
    expect(note.properties.hs_note_body).toBe('<p>Audit</p>');
    expect(note.associations).toEqual([
      { to: { id: 'c-new' }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 190 }] },
      { to: { id: 'p-new' }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }] },
    ]);
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({ Authorization: 'Bearer token-1' });
  });

  it('updates the saved company and an existing contact without touching their stage', async () => {
    answer = (call) => {
      if (call.method === 'PATCH') return { status: 200, body: { id: call.path.split('/').pop() } };
      if (call.path === `${V}/contacts/search`) return { status: 200, body: { results: [{ id: 'p-old' }] } };
      return emptyHubSpot(call);
    };
    const { result } = send(lead(), 'c-old');
    expect(await result).toEqual({ companyId: 'c-old', contactId: 'p-old' });
    expect(only('PATCH', `${V}/companies/c-old`)[0].body).toEqual({
      properties: { name: 'Smile Dental', domain: 'smiledental.com', industry: 'MEDICAL_PRACTICE' },
    });
    expect(only('PATCH', `${V}/contacts/p-old`)[0].body).toEqual({ properties: { email: 'office@smiledental.com', company: 'Smile Dental' } });
    expect(only('POST', `${V}/companies`)).toHaveLength(0);
  });

  it('finds the company by its domain when the saved one was deleted in HubSpot', async () => {
    answer = (call) => {
      if (call.method === 'PATCH' && call.path === `${V}/companies/c-gone`) return { status: 404, body: { message: 'Not found' } };
      if (call.method === 'PATCH') return { status: 200, body: { id: call.path.split('/').pop() } };
      if (call.path === `${V}/companies/search`) return { status: 200, body: { results: [{ id: 'c-domain' }] } };
      return emptyHubSpot(call);
    };
    const { result, onCompanySaved } = send(lead(), 'c-gone');
    expect((await result).companyId).toBe('c-domain');
    expect(onCompanySaved).toHaveBeenCalledWith('c-domain');
    expect(only('POST', `${V}/companies/search`)[0].body).toMatchObject({
      filterGroups: [{ filters: [{ propertyName: 'domain', operator: 'EQ', value: 'smiledental.com' }] }],
    });
  });

  it('saves the company without the industry when HubSpot rejects it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    answer = (call) => (call.path === `${V}/companies` ? rejecting(call, { industry: 'INVALID_OPTION' }) : emptyHubSpot(call));
    expect((await send().result).companyId).toBe('c-new');
    expect(only('POST', `${V}/companies`)[1].body).toEqual({ properties: { name: 'Smile Dental', domain: 'smiledental.com', lifecyclestage: 'lead' } });
    expect(warn).toHaveBeenCalled();
  });

  it("saves the company without its email when the HubSpot account has no company email property", async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    answer = (call) => (call.path === `${V}/companies` ? rejecting(call, { email: 'PROPERTY_DOESNT_EXIST' }) : emptyHubSpot(call));
    const company = { name: 'Smile Dental', domain: 'smiledental.com', email: 'office@smiledental.com', industry: 'MEDICAL_PRACTICE' };
    expect((await send(lead({ company })).result).companyId).toBe('c-new');
    // Only the email goes: the industry HubSpot accepted is kept
    expect(only('POST', `${V}/companies`)[1].body).toEqual({
      properties: { name: 'Smile Dental', domain: 'smiledental.com', industry: 'MEDICAL_PRACTICE', lifecyclestage: 'lead' },
    });
  });

  it("doesn't retry when HubSpot rejects something the company can't go without", async () => {
    answer = (call) => (call.path === `${V}/companies` ? rejecting(call, { name: 'INVALID_LONG' }) : emptyHubSpot(call));
    await expect(send().result).rejects.toMatchObject({ status: 400 });
    expect(only('POST', `${V}/companies`)).toHaveLength(1);
  });

  it('updates the existing contact when HubSpot says it already exists', async () => {
    // Search lags behind new records and misses merged emails; HubSpot names the contact
    answer = (call) => {
      if (call.method === 'POST' && call.path === `${V}/contacts`) return { status: 409, body: { message: 'Contact already exists. Existing ID: 551' } };
      if (call.method === 'PATCH') return { status: 200, body: { id: call.path.split('/').pop() } };
      return emptyHubSpot(call);
    };
    expect((await send().result).contactId).toBe('551');
    expect(only('PATCH', `${V}/contacts/551`)[0].body).toEqual({ properties: { email: 'office@smiledental.com', company: 'Smile Dental' } });
  });

  it('never looks a company up by domain when the lead has none', async () => {
    await send(lead({ domain: null })).result;
    expect(only('POST', `${V}/companies/search`)).toHaveLength(0);
  });

  it('sends no contact when the business has no email', async () => {
    const { result } = send(lead({ contact: null }));
    expect(await result).toEqual({ companyId: 'c-new', contactId: null });
    expect(calls.some((c) => c.path.includes('/contact'))).toBe(false);
    const note = only('POST', `${V}/notes`)[0].body as { associations: unknown[] };
    expect(note.associations).toHaveLength(1);
  });

  it('has already handed over the company id when a later step fails', async () => {
    answer = (call) => (call.path === `${V}/notes` ? { status: 500, body: { message: 'Internal error' } } : emptyHubSpot(call));
    const { result, onCompanySaved } = send();
    await expect(result).rejects.toBeInstanceOf(HubSpotError);
    expect(onCompanySaved).toHaveBeenCalledWith('c-new');
  });
});

describe('describeHubSpotError', () => {
  it.each([
    [new HubSpotError('bad token', 401, 'auth'), 502, 'HubSpot refused the token — check it has companies and contacts read and write.'],
    [new HubSpotError('missing scopes', 403, 'auth'), 502, 'HubSpot refused the token — check it has companies and contacts read and write.'],
    [new HubSpotError('slow down', 429, 'rateLimit'), 503, 'HubSpot is busy — try again in a minute.'],
    [new HubSpotError('Property values were not valid', 400, 'other'), 502, "HubSpot couldn't save the lead: Property values were not valid"],
    [new TypeError('fetch failed'), 502, "HubSpot couldn't be reached — try again."],
  ])('explains %s', (err, status, error) => {
    expect(describeHubSpotError(err)).toEqual({ status, error });
  });

  it('classifies HubSpot answers by status', async () => {
    answer = () => ({ status: 401, body: { message: 'Authentication credentials not found' } });
    await expect(send().result).rejects.toMatchObject({ kind: 'auth', status: 401 });
    answer = () => ({ status: 429, body: { message: 'You have reached your secondly limit.' } });
    await expect(send().result).rejects.toMatchObject({ kind: 'rateLimit' });
  });
});
