import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useFocusCheckIn, type CheckInEvaluator, type CheckInSession } from './useFocusCheckIn';
import type { FocusStatus } from './types';

const focused: FocusStatus = { isDistracted: false, distractionDuration: 0, violationCount: 0, currentApp: 'Code' };
const distracted = (violationCount: number, distractionDuration: number): FocusStatus => ({
  isDistracted: true,
  distractionDuration,
  violationCount,
  currentApp: 'Discord',
});

describe('useFocusCheckIn', () => {
  let evaluator: CheckInEvaluator;
  let evaluate: ReturnType<typeof vi.fn<CheckInEvaluator['evaluate']>>;

  beforeEach(() => {
    evaluate = vi.fn<CheckInEvaluator['evaluate']>().mockResolvedValue('[Stub] reply');
    evaluator = { evaluate };
  });

  const SESSION: CheckInSession = {
    preset: 'Sarcastic Critic',
    goals: ['Write the persistence ADR', 'Fix the reset bug'],
    timeRemainingSeconds: 8 * 60,
  };

  const render = (initial: FocusStatus, session: CheckInSession = SESSION) =>
    renderHook(({ status }) => useFocusCheckIn(status, evaluator, session), { initialProps: { status: initial } });

  test('does nothing while focused or below the minimum distraction duration', () => {
    const { rerender } = render(focused);
    rerender({ status: distracted(1, 0) });
    rerender({ status: distracted(1, 2) });
    rerender({ status: distracted(1, 4) });

    expect(evaluate).not.toHaveBeenCalled();
  });

  test('checks in once the distraction reaches the threshold, with the session it was given', async () => {
    const { rerender, result } = render(focused);
    rerender({ status: distracted(1, 6) });

    expect(evaluate).toHaveBeenCalledTimes(1);
    const [preset, context] = evaluate.mock.calls[0];
    expect(preset).toBe('Sarcastic Critic');
    expect(context).toEqual({
      violationCount: 1,
      distractionDuration: 6,
      timeRemaining: 8 * 60,
      sessionGoals: ['Write the persistence ADR', 'Fix the reset bug'],
      distractingApp: 'Discord',
    });

    await waitFor(() => expect(result.current).toEqual({ episode: 1, outcome: 'replied', text: '[Stub] reply' }));
  });

  test('checks in only once per episode, not once per sample', () => {
    const { rerender } = render(focused);
    rerender({ status: distracted(1, 6) });
    rerender({ status: distracted(1, 8) });
    rerender({ status: distracted(1, 10) });

    expect(evaluate).toHaveBeenCalledTimes(1);
  });

  test('a new episode gets its own check-in', () => {
    const { rerender } = render(focused);
    rerender({ status: distracted(1, 6) });
    rerender({ status: focused });
    rerender({ status: distracted(2, 0) });
    rerender({ status: distracted(2, 6) });

    expect(evaluate).toHaveBeenCalledTimes(2);
  });

  test('an evaluator that declines (empty reply) is reported as skipped', async () => {
    evaluate.mockResolvedValue('');
    const { rerender, result } = render(focused);
    rerender({ status: distracted(1, 6) });

    await waitFor(() => expect(result.current?.outcome).toBe('skipped'));
  });

  test('an evaluator that throws is reported as failed, not propagated', async () => {
    evaluate.mockRejectedValue(new Error('Cannot evaluate: WebGPU engine is not initialized.'));
    const { rerender, result } = render(focused);
    rerender({ status: distracted(1, 6) });

    await waitFor(() =>
      expect(result.current).toEqual({
        episode: 1,
        outcome: 'failed',
        text: 'Cannot evaluate: WebGPU engine is not initialized.',
      }),
    );
  });

  test('after a session reset, episode numbers restart and are checked in again', () => {
    const { rerender } = render(focused);
    rerender({ status: distracted(1, 6) });
    rerender({ status: focused }); // reset: violationCount back to 0
    rerender({ status: distracted(1, 6) });

    expect(evaluate).toHaveBeenCalledTimes(2);
  });
});
