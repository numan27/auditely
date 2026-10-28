// app/api/__tests__/requiresAccount.test.ts

// Without a signed-in account, every app API route answers 401 before doing any
// work: each exported handler of each route is called with no session, and no
// database is touched. The devartventures.com webhook, Stripe's webhook and signed
// report links have keys of their own and aren't listed here.

import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

const serviceFrom = vi.hoisted(() => vi.fn());
vi.mock('@/app/_shared/lib/supabase/client', () => ({ serviceDb: { from: serviceFrom } }));
vi.mock('@/app/_shared/lib/supabase/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/_shared/lib/supabase/server')>()),
  getSession: async () => null,
}));

const ROUTES = {
  search: () => import('@/app/api/search/route'),
  searches: () => import('@/app/api/searches/route'),
  results: () => import('@/app/api/results/route'),
  audit: () => import('@/app/api/audit/route'),
  'audit-url': () => import('@/app/api/audit-url/route'),
  generate: () => import('@/app/api/generate/route'),
  pdf: () => import('@/app/api/pdf/route'),
  'find-emails': () => import('@/app/api/find-emails/route'),
  notifications: () => import('@/app/api/notifications/route'),
  'audit-requests': () => import('@/app/api/audit-requests/route'),
  'send-email': () => import('@/app/api/send-email/route'),
  crm: () => import('@/app/api/crm/route'),
  'verify-email': () => import('@/app/api/verify-email/route'),
  usage: () => import('@/app/api/usage/route'),
  autocomplete: () => import('@/app/api/autocomplete/route'),
  'settings/profile': () => import('@/app/api/settings/profile/route'),
  'settings/mailbox': () => import('@/app/api/settings/mailbox/route'),
  'settings/hubspot': () => import('@/app/api/settings/hubspot/route'),
  'billing/checkout': () => import('@/app/api/billing/checkout/route'),
  'billing/portal': () => import('@/app/api/billing/portal/route'),
};
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

type Handler = (request: NextRequest) => Promise<Response>;

describe.each(Object.entries(ROUTES))('/api/%s without an account', (name, load) => {
  it('answers 401 from every handler, before any database work', async () => {
    const route = (await load()) as Record<string, unknown>;
    const methods = METHODS.filter((method) => typeof route[method] === 'function');
    expect(methods.length).toBeGreaterThan(0);

    for (const method of methods) {
      // A GET can't carry a body
      const init = method === 'GET' ? { method } : { method, body: JSON.stringify({}) };
      const res = await (route[method] as Handler)(new NextRequest(`http://localhost/api/${name}`, init));
      expect(res.status, `${method} /api/${name}`).toBe(401);
      expect(await res.json()).toEqual({ error: 'Sign in to continue' });
    }
    expect(serviceFrom).not.toHaveBeenCalled();
  });
});
