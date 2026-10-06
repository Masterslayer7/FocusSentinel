import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUsageTracking, USAGE_FLUSH_MS } from './useUsageTracking';
import type { SamplerEvent } from './types';
import type { UsageCredit } from './AppUsageTracker';

const T0 = 1_700_000_000_000;
const sample = (appName: string, offsetMs: number): SamplerEvent => ({
  kind: 'sample',
  sample: { appName, windowTitle: 'ignored', timestamp: T0 + offsetMs },
});

describe('useUsageTracking', () => {
  let emit: (event: SamplerEvent) => void;
  let onCredits: ReturnType<typeof vi.fn<(credits: UsageCredit[]) => void>>;

  beforeEach(() => {
    vi.useFakeTimers();
    onCredits = vi.fn<(credits: UsageCredit[]) => void>();
    vi.mocked(window.api.onFocusEvent).mockImplementation((callback) => {
      emit = callback;
      return () => {};
    });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test('hands over one combined credit per app on each flush', () => {
    renderHook(() => useUsageTracking(onCredits));

    act(() => {
      emit(sample('Code', 0));
      emit(sample('Code', 2000));
      emit(sample('Discord', 4000)); // closes another 2s of Code
      emit(sample('Discord', 6000));
    });
    expect(onCredits).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(USAGE_FLUSH_MS));

    expect(onCredits).toHaveBeenCalledTimes(1);
    expect(onCredits.mock.calls[0][0]).toEqual([
      { appName: 'Code', ms: 4000, at: T0 + 4000 },
      { appName: 'Discord', ms: 2000, at: T0 + 6000 },
    ]);
  });

  test('an empty flush hands over nothing', () => {
    renderHook(() => useUsageTracking(onCredits));

    act(() => vi.advanceTimersByTime(USAGE_FLUSH_MS * 2));

    expect(onCredits).not.toHaveBeenCalled();
  });

  test('pending time is handed over on unmount, not lost', () => {
    const { unmount } = renderHook(() => useUsageTracking(onCredits));
    act(() => {
      emit(sample('Code', 0));
      emit(sample('Code', 2000));
    });

    unmount();

    expect(onCredits).toHaveBeenCalledWith([{ appName: 'Code', ms: 2000, at: T0 + 2000 }]);
  });
});
