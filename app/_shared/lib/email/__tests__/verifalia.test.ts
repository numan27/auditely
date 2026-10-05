import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TIME_LIMIT_MS, verifaliaConfigured, verifyAddress } from '@/app/_shared/lib/email/verifalia';

// Fake Verifalia SDK: records each login, the balance read and each submission
const sdk = vi.hoisted(() => {
  class VerifaliaError {
    message?: string;
    constructor(message?: string) {
      this.message = message;
    }
  }
  class AuthenticationError extends VerifaliaError {}
  class AuthorizationError extends VerifaliaError {}
  class InsufficientCreditError extends VerifaliaError {}
  class RequestThrottledError extends VerifaliaError {}
  class ServiceUnreachableError extends VerifaliaError {}
  class OperationCanceledError extends VerifaliaError {}
  class CancellationToken {
    canceled = false;
    cancel() {
      this.canceled = true;
    }
  }
  class WaitOptions {
    submissionWaitTime = 30_000;
    pollWaitTime = 30_000;
  }
  const getBalance = vi.fn();
  const submit = vi.fn();
  const logins: unknown[] = [];
  class VerifaliaRestClient {
    credits = { getBalance };
    emailValidations = { submit };
    constructor(login: unknown) {
      logins.push(login);
    }
  }
  return {
    AuthenticationError, AuthorizationError, InsufficientCreditError, RequestThrottledError, ServiceUnreachableError,
    OperationCanceledError, CancellationToken, WaitOptions, VerifaliaRestClient, getBalance, submit, logins,
  };
});
vi.mock('verifalia', () => ({
  AuthenticationError: sdk.AuthenticationError,
  AuthorizationError: sdk.AuthorizationError,
  InsufficientCreditError: sdk.InsufficientCreditError,
  RequestThrottledError: sdk.RequestThrottledError,
  OperationCanceledError: sdk.OperationCanceledError,
  CancellationToken: sdk.CancellationToken,
  WaitOptions: sdk.WaitOptions,
  VerifaliaRestClient: sdk.VerifaliaRestClient,
}));

const ADDRESS = 'office@smiledental.com';
const balance = (over: Record<string, unknown> = {}) => ({ creditPacks: 0, freeCredits: 25, freeCreditsResetIn: '09:07:53', ...over });
const validation = (entry: Record<string, unknown>, status = 'Completed') => ({
  overview: { id: 'job-1', status },
  entries: [{ index: 0, inputData: ADDRESS, ...entry }],
});
const USED_UP = "Not checked: today's free Verifalia checks are used up";

beforeEach(() => {
  vi.stubEnv('VERIFALIA_USERNAME', 'auditely-user');
  vi.stubEnv('VERIFALIA_PASSWORD', 'secret-password');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  sdk.logins.length = 0;
  sdk.getBalance.mockReset().mockResolvedValue(balance());
  sdk.submit.mockReset().mockResolvedValue(validation({ classification: 'Deliverable', status: 'Success' }));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('verifaliaConfigured', () => {
  it('needs both the username and the password', () => {
    expect(verifaliaConfigured()).toBe(true);
    vi.stubEnv('VERIFALIA_PASSWORD', '');
    expect(verifaliaConfigured()).toBe(false);
  });

  it('does not count the placeholders from .env.local.example', () => {
    vi.stubEnv('VERIFALIA_USERNAME', 'your_verifalia_username_here');
    expect(verifaliaConfigured()).toBe(false);
  });
});

describe('verifyAddress', () => {
  it('checks the one address at Standard quality and reports the verdict', async () => {
    const before = Date.now();
    const outcome = await verifyAddress(ADDRESS);
    expect(outcome).toEqual({ ok: true, check: { address: ADDRESS, verdict: 'Deliverable', status: 'Success', checked_at: expect.any(String) } });
    if (outcome.ok) expect(new Date(outcome.check.checked_at).getTime()).toBeGreaterThanOrEqual(before);
    expect(sdk.logins).toEqual([{ username: 'auditely-user', password: 'secret-password' }]);
    expect(sdk.submit).toHaveBeenCalledTimes(1);
    expect(sdk.submit).toHaveBeenCalledWith(
      { entries: [{ inputData: ADDRESS }], quality: 'Standard' },
      expect.objectContaining({ submissionWaitTime: TIME_LIMIT_MS, pollWaitTime: TIME_LIMIT_MS }),
      expect.any(sdk.CancellationToken)
    );
  });

  it('reports why an address is undeliverable', async () => {
    sdk.submit.mockResolvedValue(validation({ classification: 'Undeliverable', status: 'MailboxDoesNotExist' }));
    expect(await verifyAddress(ADDRESS)).toMatchObject({ ok: true, check: { verdict: 'Undeliverable', status: 'MailboxDoesNotExist' } });
  });

  // Free plan only: no free daily credit, no check
  it.each([[0], [null], [0.5]])('submits nothing with %j free credits left', async (freeCredits) => {
    sdk.getBalance.mockResolvedValue(balance({ freeCredits }));
    expect(await verifyAddress(ADDRESS)).toEqual({ ok: false, reason: `${USED_UP} (back in 9 h 07 min).` });
    expect(sdk.submit).not.toHaveBeenCalled();
  });

  it('never draws on a credit pack', async () => {
    sdk.getBalance.mockResolvedValue(balance({ creditPacks: 500, freeCredits: 0 }));
    expect((await verifyAddress(ADDRESS)).ok).toBe(false);
    expect(sdk.submit).not.toHaveBeenCalled();
  });

  it.each([
    ['1.02:03:04', `${USED_UP} (back in 26 h 03 min).`],
    ['00:45:10', `${USED_UP} (back in 0 h 45 min).`],
    ['soon', `${USED_UP}.`],
    [null, `${USED_UP}.`],
  ])('reads a reset time of %j', async (freeCreditsResetIn, reason) => {
    sdk.getBalance.mockResolvedValue(balance({ freeCredits: 0, freeCreditsResetIn }));
    expect(await verifyAddress(ADDRESS)).toEqual({ ok: false, reason });
  });

  it('submits nothing when the balance can not be read', async () => {
    sdk.getBalance.mockRejectedValue(new sdk.AuthorizationError());
    expect(await verifyAddress(ADDRESS)).toEqual({
      ok: false,
      reason: "Not checked: the Verifalia user isn't allowed to read the credit balance.",
    });
    expect(sdk.submit).not.toHaveBeenCalled();
  });

  it('says so when the user may read the balance but not verify', async () => {
    sdk.submit.mockRejectedValue(new sdk.AuthorizationError());
    expect(await verifyAddress(ADDRESS)).toEqual({ ok: false, reason: "Not checked: the Verifalia user isn't allowed to verify emails." });
  });

  it.each([
    [new sdk.AuthenticationError(), 'Not checked: Verifalia refused the login — check VERIFALIA_USERNAME and VERIFALIA_PASSWORD.'],
    [new sdk.RequestThrottledError(), 'Not checked: Verifalia is busy — try again in a minute.'],
    [new sdk.InsufficientCreditError(), `${USED_UP}.`],
    [new sdk.ServiceUnreachableError(), "Not checked: Verifalia couldn't be reached."],
    [new Error('socket hang up'), "Not checked: Verifalia couldn't be reached."],
  ])('turns %o into a note', async (error, reason) => {
    sdk.submit.mockRejectedValue(error);
    expect(await verifyAddress(ADDRESS)).toEqual({ ok: false, reason });
  });

  it('reads a refused login from the balance request too', async () => {
    sdk.getBalance.mockRejectedValue(new sdk.AuthenticationError());
    expect(await verifyAddress(ADDRESS)).toMatchObject({ ok: false, reason: expect.stringContaining('refused the login') });
    expect(sdk.submit).not.toHaveBeenCalled();
  });

  it.each([
    ['still in progress', validation({ classification: 'Deliverable', status: 'Success' }, 'InProgress')],
    ['no result', null],
    ['no entries', { overview: { status: 'Completed' }, entries: [] }],
    ['no classification', validation({ status: 'Success' })],
    ['a classification it does not know', validation({ classification: 'Maybe', status: 'Success' })],
  ])('counts %s as not checked', async (_name, result) => {
    sdk.submit.mockResolvedValue(result);
    expect(await verifyAddress(ADDRESS)).toEqual({ ok: false, reason: "Not checked: Verifalia didn't finish the check." });
  });

  it('gives up after the time limit and cancels the request', async () => {
    vi.useFakeTimers();
    sdk.submit.mockReturnValue(new Promise(() => {}));
    const pending = verifyAddress(ADDRESS);
    await vi.advanceTimersByTimeAsync(TIME_LIMIT_MS);
    expect(await pending).toEqual({ ok: false, reason: 'Not checked: Verifalia took too long.' });
    expect(sdk.submit.mock.calls[0][2].canceled).toBe(true);
  });

  it('counts the balance read against the same time limit', async () => {
    vi.useFakeTimers();
    sdk.getBalance.mockReturnValue(new Promise(() => {}));
    const pending = verifyAddress(ADDRESS);
    await vi.advanceTimersByTimeAsync(TIME_LIMIT_MS);
    expect(await pending).toEqual({ ok: false, reason: 'Not checked: Verifalia took too long.' });
    expect(sdk.submit).not.toHaveBeenCalled();
  });

  it('asks nothing of Verifalia when it is not set up', async () => {
    vi.stubEnv('VERIFALIA_USERNAME', '');
    expect(await verifyAddress(ADDRESS)).toEqual({ ok: false, reason: "Not checked: Verifalia isn't set up." });
    expect(sdk.logins).toEqual([]);
  });

  it('keeps the password out of the log', async () => {
    sdk.submit.mockRejectedValue(Object.assign(new sdk.ServiceUnreachableError('down'), { login: 'secret-password' }));
    await verifyAddress(ADDRESS);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('secret-password');
  });
});
