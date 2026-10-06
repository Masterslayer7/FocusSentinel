import { useEffect, useRef, useState } from 'react';
import { MIN_DISTRACTION_SECONDS, type EvaluatorContext, type LlmPreset } from '../llm/LlmEvaluator';
import type { FocusStatus } from './types';

/** The one slice of LlmEvaluator this hook needs; lets tests pass a fake. */
export interface CheckInEvaluator {
  evaluate(preset: LlmPreset, context: EvaluatorContext): Promise<string>;
}

export interface CheckIn {
  episode: number; // the violationCount it was made for
  outcome: 'replied' | 'skipped' | 'failed';
  text: string;    // the reply, or the error message; '' when skipped
}

// The only preset aligned with the supportive direction in context.md.
const PRESET: LlmPreset = 'Supportive Mentor';

// No session timer or goal input exists yet. These are stand-ins, labelled as
// such so nobody mistakes them for real values.
const PLACEHOLDER_TIME_REMAINING = 25 * 60;
const PLACEHOLDER_GOAL = '[placeholder: no goal input yet]';

/**
 * Asks the evaluator for one check-in per distraction episode, once the
 * episode reaches the evaluator's own minimum duration.
 *
 * "Once per episode" means once *attempted*: if the evaluator declines (e.g.
 * its 2-minute cooldown is active), that episode passes without a retry.
 */
export function useFocusCheckIn(status: FocusStatus, evaluator: CheckInEvaluator): CheckIn | null {
  // violationCount changes exactly once per episode, so it is the episode key.
  const handledEpisode = useRef(0);
  const [checkIn, setCheckIn] = useState<CheckIn | null>(null);

  useEffect(() => {
    // A session reset restarts the count; forget episodes from before it.
    if (status.violationCount < handledEpisode.current) {
      handledEpisode.current = 0;
    }

    // The threshold check must match evaluate()'s own gate: marking an episode
    // handled on a sample evaluate() would ignore would swallow the episode.
    if (
      !status.isDistracted ||
      status.distractionDuration < MIN_DISTRACTION_SECONDS ||
      handledEpisode.current === status.violationCount
    ) {
      return;
    }

    const episode = status.violationCount;
    handledEpisode.current = episode;

    const context: EvaluatorContext = {
      violationCount: status.violationCount,
      distractionDuration: status.distractionDuration,
      timeRemaining: PLACEHOLDER_TIME_REMAINING,
      activeSessionGoal: PLACEHOLDER_GOAL,
    };

    // evaluate() throws when the model is not loaded. That must never take the
    // tracker down with it, so every outcome becomes data.
    evaluator
      .evaluate(PRESET, context)
      .then((text) => setCheckIn({ episode, outcome: text ? 'replied' : 'skipped', text }))
      .catch((error: unknown) =>
        setCheckIn({ episode, outcome: 'failed', text: error instanceof Error ? error.message : String(error) }),
      );
  }, [status, evaluator]);

  return checkIn;
}
