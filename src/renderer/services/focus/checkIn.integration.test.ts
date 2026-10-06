import { describe, test, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Only the WebGPU engine is faked. FocusTracker, useFocusCheckIn, LlmEvaluator,
// and PromptBuilder are all real, so this proves the session reaches the model.
const create = vi.fn().mockResolvedValue({ choices: [{ message: { content: 'Back to the ADR. You have eight minutes.' } }] });

vi.mock('@mlc-ai/web-llm', () => ({
  CreateMLCEngine: vi.fn().mockResolvedValue({
    unload: vi.fn().mockResolvedValue(undefined),
    chat: { completions: { create: (...args: unknown[]) => create(...args) } },
  }),
  hasModelInCache: vi.fn().mockResolvedValue(true),
  deleteModelAllInfoInCache: vi.fn().mockResolvedValue(undefined),
}));

import { LlmEvaluator } from '../llm/LlmEvaluator';
import { FocusTracker } from './FocusTracker';
import { useFocusCheckIn } from './useFocusCheckIn';

describe('focus → LlmEvaluator plumbing', () => {
  test("a real distraction and the user's session reach the model's prompt", async () => {
    const evaluator = new LlmEvaluator();
    await evaluator.initialize('fake-model');

    const tracker = new FocusTracker({ apps: { Code: 'focus' }, allowedBrowserTitles: [] });
    const at = (appName: string, seconds: number) =>
      tracker.accept({ appName, windowTitle: '', timestamp: 1_700_000_000_000 + seconds * 1000 });

    // One earlier episode, so the count under test is 2, not a default-looking 1.
    at('Discord', 0);
    at('Code', 2);
    at('Discord', 4);

    const session = { preset: 'Drill Sergeant' as const, goals: ['Write the ADR'], timeRemainingSeconds: 8 * 60 };
    const { result, rerender } = renderHook(({ status }) => useFocusCheckIn(status, evaluator, session), {
      initialProps: { status: tracker.getStatus() },
    });
    rerender({ status: at('Discord', 10) }); // 6s into episode 2

    await waitFor(() => expect(result.current?.outcome).toBe('replied'));
    expect(result.current?.text).toBe('Back to the ADR. You have eight minutes.');

    const [system, user] = create.mock.calls[0][0].messages;
    expect(system.content).toContain('Drill Sergeant');
    for (const line of [
      '- Write the ADR',
      '[Distracting App]: Discord',
      '[Violation Count]: 2',
      '[Current Distraction Duration]: 6 seconds',
      '[Time Remaining in Pomodoro]: 8 minutes',
    ]) {
      expect(user.content).toContain(line);
    }
  });
});
