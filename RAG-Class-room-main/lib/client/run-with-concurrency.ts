/**
 * Runs a list of async tasks with a maximum number in flight at once —
 * the middle ground between fully sequential (slow, "part by part") and
 * fully unbounded parallel (fast, but a burst of N simultaneous BYOK
 * Gemini calls risks tripping the student's own key's rate limit, which
 * would surface as many materials failing at once instead of the
 * current graceful one-at-a-time degradation).
 *
 * Each task's result (or thrown error, captured rather than propagated)
 * is reported via onSettled as soon as it finishes — tasks do not wait
 * for each other, so status updates can arrive in any order, which is
 * exactly what a live per-material progress grid needs.
 */
export interface RunWithConcurrencyOptions<T> {
  tasks: (() => Promise<T>)[];
  concurrency: number;
  onSettled?: (index: number, result: { ok: true; value: T } | { ok: false; error: any }) => void;
}

export async function runWithConcurrency<T>({ tasks, concurrency, onSettled }: RunWithConcurrencyOptions<T>): Promise<({ ok: true; value: T } | { ok: false; error: any })[]> {
  const results: ({ ok: true; value: T } | { ok: false; error: any })[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex++;
      if (index >= tasks.length) return;
      let settled: { ok: true; value: T } | { ok: false; error: any };
      try {
        settled = { ok: true, value: await tasks[index]() };
      } catch (error) {
        settled = { ok: false, error };
      }
      results[index] = settled;
      onSettled?.(index, settled);
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, tasks.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
