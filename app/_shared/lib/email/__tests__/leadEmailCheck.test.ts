import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkLeadEmail } from '@/app/_shared/lib/email/leadEmailCheck';
import { verifaliaConfigured, verifyAddress } from '@/app/_shared/lib/email/verifalia';
import type { Db } from '@/app/_shared/lib/supabase/client';
import type { EmailCheck } from '@/app/_shared/lib/email/emailCheck';

// Fake Supabase: every update to a business
const db = vi.hoisted(() => {
  const state = { updates: [] as { id: string; value: Record<string, unknown> }[], updateError: null as string | null };
  const from = () => ({
    update: (value: Record<string, unknown>) => ({
      eq: async (_column: string, id: string) => {
        state.updates.push({ id, value });
        return { error: state.updateError ? { message: state.updateError } : null };
      },
    }),
  });
  return { state, from };
});
vi.mock('@/app/_shared/lib/email/verifalia', () => ({ verifaliaConfigured: vi.fn(), verifyAddress: vi.fn() }));

const fakeDb = { from: db.from } as unknown as Db;
const DAY = 24 * 60 * 60 * 1000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const EMAIL = 'office@smiledental.com';
const check = (over: Partial<EmailCheck> = {}): EmailCheck => ({
  address: EMAIL,
  verdict: 'Deliverable',
  status: 'Success',
  checked_at: ago(DAY),
  ...over,
});
const lead = (email_check?: unknown) => ({ id: 'b1', email: EMAIL, email_check });
const NEW = check({ verdict: 'Risky', status: 'ServerIsCatchAll', checked_at: ago(0) });

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  db.state.updates = [];
  db.state.updateError = null;
  vi.mocked(verifaliaConfigured).mockReset().mockReturnValue(true);
  vi.mocked(verifyAddress).mockReset().mockResolvedValue({ ok: true, check: NEW });
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('checkLeadEmail', () => {
  it('uses a fresh saved result without asking Verifalia', async () => {
    const saved = check({ verdict: 'Undeliverable', status: 'MailboxDoesNotExist' });
    expect(await checkLeadEmail(fakeDb, lead(saved))).toEqual({ state: 'checked', check: saved });
    expect(verifyAddress).not.toHaveBeenCalled();
    expect(db.state.updates).toEqual([]);
  });

  it('reuses a result saved for the same address written differently', async () => {
    expect(await checkLeadEmail(fakeDb, { id: 'b1', email: ' Office@SmileDental.com', email_check: check() })).toMatchObject({ state: 'checked' });
    expect(verifyAddress).not.toHaveBeenCalled();
  });

  // An address found undeliverable stays blocked after Verifalia is switched off
  it('keeps a fresh saved result when Verifalia is not set up', async () => {
    vi.mocked(verifaliaConfigured).mockReturnValue(false);
    const saved = check({ verdict: 'Undeliverable', status: 'MailboxDoesNotExist' });
    expect(await checkLeadEmail(fakeDb, lead(saved))).toEqual({ state: 'checked', check: saved });
  });

  it('is off when Verifalia is not set up and nothing fresh is saved', async () => {
    vi.mocked(verifaliaConfigured).mockReturnValue(false);
    expect(await checkLeadEmail(fakeDb, lead())).toEqual({ state: 'off' });
    expect(await checkLeadEmail(fakeDb, lead(check({ checked_at: ago(40 * DAY) })))).toEqual({ state: 'off' });
    expect(verifyAddress).not.toHaveBeenCalled();
  });

  it.each([
    ['nothing saved', undefined],
    ['a result older than 30 days', check({ checked_at: ago(31 * DAY) })],
    ['an Unknown result older than an hour', check({ verdict: 'Unknown', checked_at: ago(2 * 60 * 60 * 1000) })],
    ['a result for another address', check({ address: 'owner@smiledental.com', verdict: 'Undeliverable' })],
    ['a saved value that is not a check', 'Undeliverable'],
  ])('checks the address when there is %s, and saves the result', async (_name, saved) => {
    expect(await checkLeadEmail(fakeDb, lead(saved))).toEqual({ state: 'checked', check: NEW });
    expect(verifyAddress).toHaveBeenCalledWith(EMAIL);
    expect(db.state.updates).toEqual([{ id: 'b1', value: { email_check: NEW } }]);
  });

  it('saves nothing when the address could not be checked', async () => {
    vi.mocked(verifyAddress).mockResolvedValue({ ok: false, reason: 'Not checked: Verifalia took too long.' });
    expect(await checkLeadEmail(fakeDb, lead())).toEqual({ state: 'unchecked', reason: 'Not checked: Verifalia took too long.' });
    expect(db.state.updates).toEqual([]);
  });

  it('still reports the result when the column is missing, and names the migration', async () => {
    db.state.updateError = "Could not find the 'email_check' column of 'businesses' in the schema cache";
    expect(await checkLeadEmail(fakeDb, lead())).toEqual({
      state: 'checked',
      check: NEW,
      warning: "Checked, but the result couldn't be saved — run docs/migrations/2026-10-05-email-check.sql in Supabase.",
    });
  });

  it("doesn't blame the migration when saving fails for another reason", async () => {
    db.state.updateError = 'upstream connect error';
    expect(await checkLeadEmail(fakeDb, lead())).toEqual({
      state: 'checked',
      check: NEW,
      warning: "Checked, but the result couldn't be saved, so it will be checked again next time.",
    });
  });
});
