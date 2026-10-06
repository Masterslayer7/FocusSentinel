import { describe, test, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Only the WebGPU engine is faked. FocusTracker, useFocusCheckIn, LlmEvaluator,
// and PromptBuilder are all real, so this proves the numbers survive the trip.
vi.mock('@mlc-ai/web-llm', () => ({
  CreateMLCEngine: vi.fn().mockResolvedValue({ unload: vi.fn().mockResolvedValue(undefined) }),
  hasModelInCache: vi.fn().mockResolvedValue(true),
  deleteModelAllInfoInCache: vi.fn().mockResolvedValue(undefined),
}));

import { LlmEvaluator } from '../llm/LlmEvaluator';
import { FocusTracker } from './FocusTracker';
import { useFocusCheckIn } from './useFocusCheckIn';

describe('focus → LlmEvaluator plumbing', () => {
  test("a real distraction's count and duration reach the evaluator's prompt", async () => {
    const evaluator = new LlmEvaluator();
    await evaluator.initialize('fake-model');

    const tracker = new FocusTracker({ apps: { Code: 'focus' }, allowedBrowserTitles: [] });
    const at = (appName: string, seconds: number) =>
      tracker.accept({ appName, windowTitle: '', timestamp: 1_700_000_000_000 + seconds * 1000 });

    // One earlier episode, so the count under test is 2, not a default-looking 1.
    at('Discord', 0);
    at('Code', 2);
    at('Discord', 4);

    const { result, rerender } = renderHook(({ status }) => useFocusCheckIn(status, evaluator), {
      initialProps: { status: tracker.getStatus() },
    });
    rerender({ status: at('Discord', 10) }); // 6s into episode 2

    await waitFor(() => expect(result.current?.outcome).toBe('replied'));
    expect(result.current?.text).toContain('[Stub] [System: Supportive Mentor]');
    expect(result.current?.text).toContain('[Violation Count]: 2');
    expect(result.current?.text).toContain('[Current Distraction Duration]: 6 seconds');
  });
});
