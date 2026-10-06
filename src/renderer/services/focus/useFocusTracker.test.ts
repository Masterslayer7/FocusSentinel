import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFocusTracker } from './useFocusTracker';
import type { FocusRules, SamplerEvent } from './types';

const RULES: FocusRules = {
  apps: { Code: 'focus', chrome: 'browser' },
  allowedBrowserTitles: ['MDN'],
};

const T0 = 1_700_000_000_000;

describe('useFocusTracker', () => {
  let emit: (event: SamplerEvent) => void;
  let unsubscribe: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    unsubscribe = vi.fn<() => void>();
    vi.mocked(window.api.onFocusEvent).mockImplementation((callback) => {
      emit = callback;
      return unsubscribe;
    });
  });

  const sample = (appName: string, offsetSeconds: number): SamplerEvent => ({
    kind: 'sample',
    sample: { appName, windowTitle: 'irrelevant', timestamp: T0 + offsetSeconds * 1000 },
  });

  test('starts focused with no error, before any sample arrives', () => {
    const { result } = renderHook(() => useFocusTracker(RULES));

    expect(result.current.status).toEqual({
      isDistracted: false,
      distractionDuration: 0,
      violationCount: 0,
      currentApp: '',
    });
    expect(result.current.error).toBeNull();
  });

  test('feeds samples through the tracker and exposes the resulting status', () => {
    const { result } = renderHook(() => useFocusTracker(RULES));

    act(() => emit(sample('Discord', 0)));
    act(() => emit(sample('Discord', 4)));

    expect(result.current.status).toEqual({
      isDistracted: true,
      distractionDuration: 4,
      violationCount: 1,
      currentApp: 'Discord',
    });
  });

  test('a sampler error is surfaced and leaves the last status in place', () => {
    const { result } = renderHook(() => useFocusTracker(RULES));

    act(() => emit(sample('Discord', 0)));
    act(() => emit({ kind: 'error', error: { reason: 'addon-unavailable', message: 'no addon' } }));

    expect(result.current.error).toEqual({ reason: 'addon-unavailable', message: 'no addon' });
    expect(result.current.status.violationCount).toBe(1);
  });

  test('the next good sample clears a previous error', () => {
    const { result } = renderHook(() => useFocusTracker(RULES));

    act(() => emit({ kind: 'error', error: { reason: 'query-failed', message: 'boom' } }));
    act(() => emit(sample('Code', 2)));

    expect(result.current.error).toBeNull();
  });

  test('reset returns the status to its initial state', () => {
    const { result } = renderHook(() => useFocusTracker(RULES));

    act(() => emit(sample('Discord', 0)));
    act(() => result.current.reset());

    expect(result.current.status.violationCount).toBe(0);
    expect(result.current.status.isDistracted).toBe(false);
  });

  test('unsubscribes from focus events on unmount', () => {
    const { unmount } = renderHook(() => useFocusTracker(RULES));

    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
