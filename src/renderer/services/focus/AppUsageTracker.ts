import type { WindowSample } from './types';

/**
 * Gaps longer than this (the PC slept, the sampler stopped) are not credited
 * to any app. Five sampler ticks: generous for jitter, short of real absence.
 */
export const MAX_CREDITED_GAP_MS = 10_000;

/** Time to add to one app's total. */
export interface UsageCredit {
  appName: string;
  ms: number;
  at: number; // timestamp of the sample that closed the interval
}

/**
 * Turns a stream of samples into per-app time. Each sample credits the time
 * since the previous one to the previous sample's app — that is where the user
 * was during the gap. Holds only the previous sample; totals live elsewhere.
 */
export class AppUsageTracker {
  private previous: WindowSample | null = null;

  public accept(sample: WindowSample): UsageCredit | null {
    const previous = this.previous;
    this.previous = sample;

    if (!previous) {
      return null;
    }
    const ms = sample.timestamp - previous.timestamp;
    if (ms <= 0 || ms > MAX_CREDITED_GAP_MS) {
      return null;
    }
    return { appName: previous.appName, ms, at: sample.timestamp };
  }

  public reset(): void {
    this.previous = null;
  }
}
