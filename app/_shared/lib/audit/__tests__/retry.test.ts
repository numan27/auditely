import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry, RetryableError } from '@/app/_shared/lib/audit/retry';

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => vi.useRealTimers());

  const opts = { attempts: 3, baseDelayMs: 2000, deadline: 60_000, random: () => 0 };

  it('returns the first successful result', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    await expect(withRetry(fn, opts)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries RetryableError with exponential backoff (2 s, then 4 s)', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new RetryableError('503'))
      .mockRejectedValueOnce(new RetryableError('503'))
      .mockResolvedValue('ok');
    const promise = withRetry(fn, opts);
    await vi.advanceTimersByTimeAsync(1999);
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(4000);
    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry other errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('400'));
    await expect(withRetry(fn, opts)).rejects.toThrow('400');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('gives up after the last attempt', async () => {
    const fn = vi.fn().mockRejectedValue(new RetryableError('503'));
    const assertion = expect(withRetry(fn, opts)).rejects.toThrow('503');
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('honours Retry-After when it is longer than the backoff', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new RetryableError('429', 5000))
      .mockResolvedValue('ok');
    const promise = withRetry(fn, opts);
    await vi.advanceTimersByTimeAsync(4999);
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(promise).resolves.toBe('ok');
  });

  it('stops when the next wait would pass the deadline', async () => {
    const fn = vi.fn().mockRejectedValue(new RetryableError('503'));
    await expect(withRetry(fn, { ...opts, deadline: 1000 })).rejects.toThrow('503');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
