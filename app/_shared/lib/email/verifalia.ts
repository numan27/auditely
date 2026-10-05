// app/_shared/lib/email/verifalia.ts

// Checks one email address with Verifalia (https://verifalia.com) without
// sending to it. Free plan only: 25 credits a day, 1 per check at Standard
// quality. Nothing is submitted unless a free daily credit is left, so a paid
// credit pack is never drawn on. Server only: the password stays here.

import {
  AuthenticationError,
  AuthorizationError,
  CancellationToken,
  InsufficientCreditError,
  OperationCanceledError,
  RequestThrottledError,
  VerifaliaRestClient,
  WaitOptions,
} from 'verifalia';
import { isEmailVerdict, type EmailCheck } from '@/app/_shared/lib/email/emailCheck';

export type VerifyOutcome = { ok: true; check: EmailCheck } | { ok: false; reason: string };

/** The balance read and the verification together */
export const TIME_LIMIT_MS = 20_000;
// Verifalia's cheapest level, 1 credit per address. (The SDK's own constant for it isn't visible to TypeScript.)
const QUALITY = 'Standard';

const USED_UP = "Not checked: today's free Verifalia checks are used up";
const NOT_SET_UP = "Not checked: Verifalia isn't set up.";
const NO_BALANCE_ACCESS = "Not checked: the Verifalia user isn't allowed to read the credit balance.";
const NO_VERIFY_ACCESS = "Not checked: the Verifalia user isn't allowed to verify emails.";
const LOGIN_REFUSED = 'Not checked: Verifalia refused the login — check VERIFALIA_USERNAME and VERIFALIA_PASSWORD.';
const BUSY = 'Not checked: Verifalia is busy — try again in a minute.';
const TOO_LONG = 'Not checked: Verifalia took too long.';
const UNFINISHED = "Not checked: Verifalia didn't finish the check.";
const UNREACHABLE = "Not checked: Verifalia couldn't be reached.";

// Present, and not a template placeholder (`your_x_here`)
const isSet = (value: string | undefined): value is string => !!value && !/your_.*_here/i.test(value);

function login(): { username: string; password: string } | null {
  const { VERIFALIA_USERNAME: username, VERIFALIA_PASSWORD: password } = process.env;
  return isSet(username) && isSet(password) ? { username, password } : null;
}

export const verifaliaConfigured = (): boolean => login() !== null;

// Verifalia writes the wait as [d.]hh:mm:ss
function backIn(resetIn: string | null | undefined): string {
  const parts = resetIn?.match(/^(?:(\d+)\.)?(\d{1,2}):(\d{2}):\d{2}/);
  if (!parts) return '';
  return ` (back in ${Number(parts[1] ?? 0) * 24 + Number(parts[2])} h ${parts[3]} min)`;
}

function noteFor(err: unknown): string {
  if (err instanceof OperationCanceledError) return TOO_LONG;
  if (err instanceof AuthenticationError) return LOGIN_REFUSED;
  if (err instanceof AuthorizationError) return NO_VERIFY_ACCESS;
  if (err instanceof RequestThrottledError) return BUSY;
  if (err instanceof InsufficientCreditError) return `${USED_UP}.`;
  return UNREACHABLE;
}

async function check(client: VerifaliaRestClient, address: string, cancel: CancellationToken): Promise<VerifyOutcome> {
  // Free plan only: no free daily credit, no check
  const balance = await client.credits.getBalance(cancel).catch((err: unknown) => {
    if (err instanceof AuthorizationError) return null;
    throw err;
  });
  if (!balance) return { ok: false, reason: NO_BALANCE_ACCESS };
  if ((balance.freeCredits ?? 0) < 1) return { ok: false, reason: `${USED_UP}${backIn(balance.freeCreditsResetIn)}.` };

  const wait = new WaitOptions();
  wait.submissionWaitTime = TIME_LIMIT_MS;
  wait.pollWaitTime = TIME_LIMIT_MS;
  const result = await client.emailValidations.submit(
    { entries: [{ inputData: address }], quality: QUALITY },
    wait,
    cancel
  );
  const entry = result?.entries?.[0];
  if (result?.overview?.status !== 'Completed' || !entry || !isEmailVerdict(entry.classification)) {
    return { ok: false, reason: UNFINISHED };
  }
  return {
    ok: true,
    check: { address, verdict: entry.classification, status: entry.status ?? '', checked_at: new Date().toISOString() },
  };
}

/** Asks Verifalia whether mail to this address can be delivered. Never throws. */
export async function verifyAddress(address: string): Promise<VerifyOutcome> {
  const credentials = login();
  if (!credentials) return { ok: false, reason: NOT_SET_UP };

  const cancel = new CancellationToken();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeLimit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      cancel.cancel();
      reject(new OperationCanceledError());
    }, TIME_LIMIT_MS);
  });
  try {
    return await Promise.race([check(new VerifaliaRestClient(credentials), address, cancel), timeLimit]);
  } catch (err) {
    const reason = noteFor(err);
    // The SDK's errors carry the whole response: only the kind and its message are logged
    console.error('[verifalia]', reason, (err as { message?: unknown } | null)?.message ?? '');
    return { ok: false, reason };
  } finally {
    clearTimeout(timer);
  }
}
