// Fixed-size concurrent worker pool.
// Used by expand.mjs and discovery scripts that hit external APIs.

/**
 * Process items with a fixed number of concurrent workers.
 *
 * @param {Array} items - work units
 * @param {number} workerCount - max parallelism
 * @param {(item) => Promise<any>} fn - async worker function
 * @param {(result, item) => void} [onResult] - called per success
 * @param {(error, item) => void} [onError] - called per failure
 * @returns {Promise<{ ok: number, errors: Array, wallSec: number }>}
 */
export async function runPool(items, workerCount, fn, onResult, onError) {
  const queue = items.slice();
  const errors = [];
  let okCount = 0;
  const t0 = Date.now();

  async function worker() {
    while (queue.length > 0) {
      const item = queue.shift();
      try {
        const result = await fn(item);
        okCount++;
        onResult?.(result, item);
      } catch (e) {
        errors.push({ item, error: e.message });
        onError?.(e, item);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(workerCount, items.length) }, () => worker()),
  );

  const wallSec = (Date.now() - t0) / 1000;
  return { ok: okCount, errors, wallSec };
}
