import { useEffect, useRef } from 'react';
import { AppUsageTracker, type UsageCredit } from './AppUsageTracker';

/**
 * How often collected time is handed over. Batching keeps a sample every 2s
 * from turning into a state change, and a disk write, every 2s.
 */
export const USAGE_FLUSH_MS = 10_000;

/**
 * Tracks time per app from the sampler, whether or not a focus block is
 * running, and hands over one combined credit per app every USAGE_FLUSH_MS
 * and on unmount. App names only; titles are never kept.
 */
export function useUsageTracking(onCredits: (credits: UsageCredit[]) => void) {
  const onCreditsRef = useRef(onCredits);
  onCreditsRef.current = onCredits;

  useEffect(() => {
    const usage = new AppUsageTracker();
    let pending = new Map<string, UsageCredit>();

    const flush = () => {
      if (pending.size === 0) return;
      const credits = [...pending.values()];
      pending = new Map();
      onCreditsRef.current(credits);
    };

    const unsubscribe = window.api.onFocusEvent((event) => {
      if (event.kind !== 'sample') return;
      const credit = usage.accept(event.sample);
      if (!credit) return;
      const previous = pending.get(credit.appName);
      pending.set(credit.appName, { appName: credit.appName, ms: (previous?.ms ?? 0) + credit.ms, at: credit.at });
    });
    const timer = setInterval(flush, USAGE_FLUSH_MS);

    return () => {
      unsubscribe();
      clearInterval(timer);
      flush();
    };
  }, []);
}
