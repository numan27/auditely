import { describe, it, expect } from 'vitest';
import { runPool } from '@/app/_shared/lib/utils/pool';

// A worker whose calls finish only when released, so the test controls the order
function gate() {
  const started: number[] = [];
  const release = new Map<number, () => void>();
  const worker = (item: number) =>
    new Promise<void>((resolve) => {
      started.push(item);
      release.set(item, resolve);
    });
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  return { started, release, worker, settle };
}

describe('runPool', () => {
  it('runs at most `concurrency` items at a time, in order', async () => {
    const { started, release, worker, settle } = gate();
    const done = runPool([1, 2, 3, 4, 5], worker, 2);
    await settle();
    expect(started).toEqual([1, 2]);

    release.get(2)!();
    await settle();
    expect(started).toEqual([1, 2, 3]);

    for (const item of [1, 3]) release.get(item)!();
    await settle();
    expect(started).toEqual([1, 2, 3, 4, 5]);
    for (const item of [4, 5]) release.get(item)!();
    await done;
  });

  it('starts nothing new once asked to stop, and waits for what is running', async () => {
    const { started, release, worker, settle } = gate();
    let stop = false;
    let finished = false;
    const done = runPool([1, 2, 3, 4], worker, 2, () => stop).then(() => (finished = true));
    await settle();
    stop = true;
    release.get(1)!();
    await settle();
    expect(started).toEqual([1, 2]);
    expect(finished).toBe(false);

    release.get(2)!();
    await done;
    expect(started).toEqual([1, 2]);
  });

  it('carries on when a worker throws', async () => {
    const seen: number[] = [];
    await runPool(
      [1, 2, 3],
      async (item) => {
        seen.push(item);
        if (item === 2) throw new Error('boom');
      },
      1
    );
    expect(seen).toEqual([1, 2, 3]);
  });

  it('does nothing for an empty list', async () => {
    await expect(runPool([], async () => {}, 3)).resolves.toBeUndefined();
  });
});
