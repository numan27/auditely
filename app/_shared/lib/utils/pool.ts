// app/_shared/lib/utils/pool.ts

/**
 * Runs `worker` over `items` in order, at most `concurrency` at a time.
 * `shouldStop` is asked before each item starts: once it says yes, nothing new
 * starts and the pool resolves when the running ones finish. A worker that
 * throws doesn't stop the others.
 */
export async function runPool<T>(
  items: readonly T[],
  worker: (item: T) => Promise<void>,
  concurrency: number,
  shouldStop: () => boolean = () => false
): Promise<void> {
  let next = 0;
  const lane = async () => {
    while (next < items.length && !shouldStop()) {
      const item = items[next++];
      try {
        await worker(item);
      } catch {
        /* the worker reports its own failures */
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, lane));
}
