import type { AppCategory, FocusRules, SamplerError, SamplerEvent, WindowSample } from '../../../shared/types';

export type { AppCategory, FocusRules, SamplerError, SamplerEvent, WindowSample };

/** What the tracker answers with. Deliberately free of window titles. */
export interface FocusStatus {
  isDistracted: boolean;
  distractionDuration: number; // consecutive SECONDS in the current distraction; 0 when focused
  violationCount: number;      // distinct distraction episodes this session
  currentApp: string;
}
