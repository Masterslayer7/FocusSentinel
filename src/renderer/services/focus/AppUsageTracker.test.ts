import { describe, test, expect, beforeEach } from 'vitest';
import { AppUsageTracker, MAX_CREDITED_GAP_MS } from './AppUsageTracker';

const T0 = 1_700_000_000_000;
const sample = (appName: string, offsetMs: number) => ({ appName, windowTitle: 'ignored', timestamp: T0 + offsetMs });

describe('AppUsageTracker', () => {
  let usage: AppUsageTracker;

  beforeEach(() => {
    usage = new AppUsageTracker();
  });

  test('the first sample credits nothing — there is no interval yet', () => {
    expect(usage.accept(sample('Code', 0))).toBeNull();
  });

  test('the time between two samples is credited to the earlier app', () => {
    usage.accept(sample('Code', 0));

    expect(usage.accept(sample('Discord', 2000))).toEqual({ appName: 'Code', ms: 2000, at: T0 + 2000 });
  });

  test('consecutive samples keep crediting the app that was in front', () => {
    usage.accept(sample('Code', 0));
    usage.accept(sample('Code', 2000));

    expect(usage.accept(sample('Code', 4000))).toEqual({ appName: 'Code', ms: 2000, at: T0 + 4000 });
  });

  test('a gap longer than the limit credits nothing, then counting resumes', () => {
    usage.accept(sample('Code', 0));

    expect(usage.accept(sample('Code', MAX_CREDITED_GAP_MS + 1))).toBeNull();
    expect(usage.accept(sample('Code', MAX_CREDITED_GAP_MS + 2001))?.ms).toBe(2000);
  });

  test('a sample older than the previous one credits nothing', () => {
    usage.accept(sample('Code', 5000));

    expect(usage.accept(sample('Code', 3000))).toBeNull();
  });

  test('reset forgets the previous sample', () => {
    usage.accept(sample('Code', 0));
    usage.reset();

    expect(usage.accept(sample('Code', 2000))).toBeNull();
  });
});
