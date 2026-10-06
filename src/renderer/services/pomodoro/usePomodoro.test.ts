import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePomodoro } from './usePomodoro';
import type { PomodoroSettings } from './types';

const SETTINGS: PomodoroSettings = { focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, longBreakEvery: 4 };

describe('usePomodoro', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test('counts down once started', () => {
    const { result } = renderHook(() => usePomodoro(SETTINGS));

    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(60_000));

    expect(result.current.status.remainingSeconds).toBe(24 * 60);
    expect(result.current.status.isFocusActive).toBe(true);
  });

  test('pause stops the countdown', () => {
    const { result } = renderHook(() => usePomodoro(SETTINGS));

    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(10_000));
    act(() => result.current.pause());
    act(() => vi.advanceTimersByTime(60_000));

    expect(result.current.status.remainingSeconds).toBe(25 * 60 - 10);
  });

  test('changed settings reach the timer', () => {
    const { result, rerender } = renderHook(({ settings }) => usePomodoro(settings), {
      initialProps: { settings: SETTINGS },
    });

    rerender({ settings: { ...SETTINGS, focusMinutes: 45 } });

    expect(result.current.status.remainingSeconds).toBe(45 * 60);
  });
});
