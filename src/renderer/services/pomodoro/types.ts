import type { PomodoroSettings } from '../../../shared/types';

export type { PomodoroSettings };

export type PomodoroPhase = 'focus' | 'shortBreak' | 'longBreak';

export interface PomodoroStatus {
  phase: PomodoroPhase;
  isRunning: boolean;
  remainingSeconds: number;     // whole seconds, rounded up
  completedFocusBlocks: number; // focus blocks run to the end; skipped ones don't count
  isFocusActive: boolean;       // a focus block is running — the only time distractions count
}
