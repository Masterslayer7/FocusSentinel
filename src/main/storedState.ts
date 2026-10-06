import type {
  AppCategory,
  AppUsageEntry,
  FocusRules,
  Goal,
  PomodoroSettings,
  StoredState,
} from '../shared/types';

// Validates whatever came off disk (or over IPC) into a StoredState. Each field
// is kept only if valid; bad entries inside lists are dropped one at a time.
// Knows no defaults — the renderer fills in whatever is missing.

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// JSON.parse makes these ordinary keys; assigning them would rewrite a prototype.
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const safeEntries = (record: Json): [string, unknown][] =>
  Object.entries(record).filter(([key]) => !UNSAFE_KEYS.has(key));

const CATEGORIES: readonly AppCategory[] = ['focus', 'distraction', 'browser'];

const isWholeNumberIn = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

const parseGoals = (value: unknown): Goal[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  return value.filter(
    (goal): goal is Goal =>
      isObject(goal) &&
      typeof goal.id === 'string' &&
      goal.id.length > 0 &&
      typeof goal.text === 'string' &&
      typeof goal.done === 'boolean',
  ).map(({ id, text, done }) => ({ id, text, done }));
};

const parseRules = (value: unknown): FocusRules | undefined => {
  if (!isObject(value) || !isObject(value.apps) || !Array.isArray(value.allowedBrowserTitles)) return undefined;
  const apps: Record<string, AppCategory> = {};
  for (const [name, category] of safeEntries(value.apps)) {
    if (CATEGORIES.includes(category as AppCategory)) {
      apps[name] = category as AppCategory;
    }
  }
  const allowedBrowserTitles = value.allowedBrowserTitles.filter((title): title is string => typeof title === 'string');
  return { apps, allowedBrowserTitles };
};

const parsePomodoro = (value: unknown): PomodoroSettings | undefined => {
  if (!isObject(value)) return undefined;
  const { focusMinutes, shortBreakMinutes, longBreakMinutes, longBreakEvery } = value;
  if (
    isWholeNumberIn(focusMinutes, 1, 240) &&
    isWholeNumberIn(shortBreakMinutes, 1, 240) &&
    isWholeNumberIn(longBreakMinutes, 1, 240) &&
    isWholeNumberIn(longBreakEvery, 1, 12)
  ) {
    return { focusMinutes, shortBreakMinutes, longBreakMinutes, longBreakEvery };
  }
  return undefined;
};

const parseAppUsage = (value: unknown): Record<string, AppUsageEntry> | undefined => {
  if (!isObject(value)) return undefined;
  const usage: Record<string, AppUsageEntry> = {};
  for (const [name, entry] of safeEntries(value)) {
    if (
      isObject(entry) &&
      typeof entry.seconds === 'number' &&
      Number.isFinite(entry.seconds) &&
      entry.seconds >= 0 &&
      typeof entry.lastSeen === 'number' &&
      Number.isFinite(entry.lastSeen)
    ) {
      usage[name] = { seconds: entry.seconds, lastSeen: entry.lastSeen };
    }
  }
  return usage;
};

export function parseStoredState(raw: unknown): StoredState {
  if (!isObject(raw)) return {};

  const state: StoredState = {};
  const goals = parseGoals(raw.goals);
  if (goals) state.goals = goals;
  const rules = parseRules(raw.rules);
  if (rules) state.rules = rules;
  if (typeof raw.persona === 'string') state.persona = raw.persona;
  const pomodoro = parsePomodoro(raw.pomodoro);
  if (pomodoro) state.pomodoro = pomodoro;
  if (typeof raw.modelId === 'string' || raw.modelId === null) state.modelId = raw.modelId;
  const appUsage = parseAppUsage(raw.appUsage);
  if (appUsage) state.appUsage = appUsage;
  return state;
}
