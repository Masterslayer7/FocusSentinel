import type {
  AppCategory,
  AppUsageEntry,
  Goal,
  PersistedState,
  PomodoroSettings,
  SpeechSettings,
  StoredState,
  TtsEngine,
} from '../../../shared/types';

export type {
  AppCategory,
  AppUsageEntry,
  Goal,
  PersistedState,
  PomodoroSettings,
  SpeechSettings,
  StoredState,
  TtsEngine,
};

export type AppStateAction =
  | { type: 'loaded'; stored: StoredState }
  | { type: 'addGoal'; id: string; text: string }
  | { type: 'toggleGoal'; id: string }
  | { type: 'removeGoal'; id: string }
  | { type: 'clearDoneGoals' }
  | { type: 'setAppCategory'; appName: string; category: AppCategory }
  | { type: 'setBrowserTitles'; titles: string[] }
  | { type: 'setPersona'; persona: string }
  | { type: 'setPomodoro'; settings: PomodoroSettings }
  | { type: 'setModel'; modelId: string | null }
  | { type: 'setSpeech'; settings: SpeechSettings }
  | { type: 'creditUsage'; appName: string; ms: number; at: number }
  | { type: 'clearUsage' };
