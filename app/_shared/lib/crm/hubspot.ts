// app/_shared/lib/crm/hubspot.ts

// Sends a lead to HubSpot: the company (saved id, else found by website domain,
// else new), the contact (by email), their link, and a note on both. Also checks
// a token an account pastes into Settings before it's saved.
// Server-only: the token never reaches the browser.

import type { LeadPayload } from '@/app/_shared/lib/crm/leadPayload';

const API = 'https://api.hubapi.com';
// HubSpot's dated API version; one place to move it forward
const OBJECTS = '/crm/objects/2026-09';
const NOTE_TO_COMPANY = 190;
const NOTE_TO_CONTACT = 202;
const TIMEOUT_MS = 15_000;

export class HubSpotError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly kind: 'auth' | 'rateLimit' | 'other'
  ) {
    super(message);
  }
}

export interface SentLead {
  companyId: string;
  contactId: string | null;
}

type Call = <T>(method: string, path: string, body?: unknown) => Promise<T>;

function caller(token: string): Call {
  return async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body !== undefined && { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) return data as T;
    const message = (data as { message?: string } | null)?.message ?? `HTTP ${res.status}`;
    const kind = res.status === 401 || res.status === 403 ? 'auth' : res.status === 429 ? 'rateLimit' : 'other';
    throw new HubSpotError(message, res.status, kind);
  };
}

async function findId(call: Call, object: 'companies' | 'contacts', property: string, value: string): Promise<string | null> {
  const found = await call<{ results?: { id: string }[] }>('POST', `${OBJECTS}/${object}/search`, {
    filterGroups: [{ filters: [{ propertyName: property, operator: 'EQ', value }] }],
    properties: [property],
    limit: 1,
  });
  return found?.results?.[0]?.id ?? null;
}

// What a company can go without: an industry code HubSpot doesn't know, and the
// email, which only accounts with a custom company "email" property can hold
const OPTIONAL = ['industry', 'email'];

// Updates (id) or creates the company. An optional property HubSpot rejects is
// dropped so the lead still goes through.
async function saveCompany(call: Call, id: string | null, lead: LeadPayload): Promise<string> {
  const write = (properties: Record<string, string>) =>
    id
      ? call<{ id: string }>('PATCH', `${OBJECTS}/companies/${id}`, { properties })
      : call<{ id: string }>('POST', `${OBJECTS}/companies`, { properties: { ...properties, ...lead.onCreate.company } });
  try {
    return (await write(lead.company)).id;
  } catch (err) {
    if (!(err instanceof HubSpotError) || err.status !== 400) throw err;
    // HubSpot names each property it rejected: "name":"industry"
    const rejected = OPTIONAL.filter((key) => key in lead.company && err.message.includes(`"name":"${key}"`));
    if (!rejected.length) throw err;
    console.warn('[hubspot] company saved without what HubSpot rejected:', rejected.join(', '));
    return (await write(Object.fromEntries(Object.entries(lead.company).filter(([key]) => !rejected.includes(key))))).id;
  }
}

async function upsertCompany(call: Call, lead: LeadPayload, savedId: string | null): Promise<string> {
  if (savedId) {
    try {
      return await saveCompany(call, savedId, lead);
    } catch (err) {
      // Deleted in HubSpot since the last send: find it by domain or create it
      if (!(err instanceof HubSpotError) || err.status !== 404) throw err;
    }
  }
  const found = lead.domain ? await findId(call, 'companies', 'domain', lead.domain) : null;
  return saveCompany(call, found, lead);
}

async function upsertContact(call: Call, contact: NonNullable<LeadPayload['contact']>, onCreate: Record<string, string>): Promise<string> {
  const update = async (id: string) =>
    (await call<{ id: string }>('PATCH', `${OBJECTS}/contacts/${id}`, { properties: contact.properties })).id;
  const id = await findId(call, 'contacts', 'email', contact.email);
  if (id) return update(id);
  try {
    return (await call<{ id: string }>('POST', `${OBJECTS}/contacts`, { properties: { ...contact.properties, ...onCreate } })).id;
  } catch (err) {
    // Search lags behind new records and misses merged emails: HubSpot names the existing contact
    const existing = err instanceof HubSpotError && err.status === 409 ? err.message.match(/Existing ID: (\d+)/)?.[1] : undefined;
    if (!existing) throw err;
    return update(existing);
  }
}

const noteLink = (id: string, associationTypeId: number) => ({
  to: { id },
  types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId }],
});

/**
 * Sends the lead. `onCompanySaved` runs as soon as the company exists, so a
 * failure in a later step can't cause a duplicate company on the next send.
 */
export async function sendLead(
  token: string,
  lead: LeadPayload,
  options: { savedCompanyId: string | null; onCompanySaved: (id: string) => Promise<void> }
): Promise<SentLead> {
  const call = caller(token);
  const companyId = await upsertCompany(call, lead, options.savedCompanyId);
  await options.onCompanySaved(companyId);

  const contactId = lead.contact ? await upsertContact(call, lead.contact, lead.onCreate.contact) : null;
  if (contactId) await call('PUT', `${OBJECTS}/contact/${contactId}/associations/default/company/${companyId}`);

  await call('POST', `${OBJECTS}/notes`, {
    properties: { hs_timestamp: new Date().toISOString(), hs_note_body: lead.noteHtml },
    associations: [noteLink(companyId, NOTE_TO_COMPANY), ...(contactId ? [noteLink(contactId, NOTE_TO_CONTACT)] : [])],
  });
  return { companyId, contactId };
}

/** Asks HubSpot for one company: proof the token works and can read companies */
export async function checkHubSpotToken(token: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await caller(token)('GET', `${OBJECTS}/companies?limit=1`);
    return { ok: true };
  } catch (err) {
    if (err instanceof HubSpotError && err.kind === 'auth') {
      return { ok: false, error: 'HubSpot refused the token. Check it has read and write access to companies and contacts.' };
    }
    return { ok: false, error: describeHubSpotError(err).error };
  }
}

/** The status and message for the "Send to HubSpot" button */
export function describeHubSpotError(err: unknown): { status: number; error: string } {
  if (!(err instanceof HubSpotError)) return { status: 502, error: "HubSpot couldn't be reached — try again." };
  if (err.kind === 'auth') return { status: 502, error: 'HubSpot refused the token — check it has companies and contacts read and write.' };
  if (err.kind === 'rateLimit') return { status: 503, error: 'HubSpot is busy — try again in a minute.' };
  return { status: 502, error: `HubSpot couldn't save the lead: ${err.message}` };
}
