// app/_shared/lib/audit/retry.ts

/** An error worth retrying (network blip, timeout, 429, 5xx). */
export class RetryableError extends Error {
  constructor(message: string, readonly retryAfterMs?: number) {
    super(message);
    this.name = 'RetryableError';
  }
}

export interface RetryOptions {
  /** Total attempts, including the first */
  attempts: number;
  /** Wait before the 2nd attempt; doubles after each failure */
  baseDelayMs: number;
  /** Epoch ms — never wait past this */
  deadline: number;
  /** Jitter source in [0, 1); injectable for tests */
  random?: () => number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs `fn` until it succeeds, throws a non-retryable error, runs out of
 * attempts, or the next wait would pass `deadline`. Only `RetryableError`s
 * are retried; anything else is rethrown immediately.
 */
export async function withRetry<T>(fn: (attempt: number) => Promise<T>, opts: RetryOptions): Promise<T> {
  const random = opts.random ?? Math.random;
  let lastError: unknown;

  for (let attempt = 1; attempt <= opts.attempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      if (!(err instanceof RetryableError) || attempt === opts.attempts) throw err;

      const backoff = opts.baseDelayMs * 2 ** (attempt - 1) * (1 + 0.3 * random());
      const delay = Math.max(backoff, err.retryAfterMs ?? 0);
      if (Date.now() + delay >= opts.deadline) throw err;
      await sleep(delay);
    }
  }
  throw lastError;
}
