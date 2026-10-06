import { DEFAULT_RULES } from '../focus/rules';
import { LLM_PRESETS, type LlmPreset } from '../llm/PromptBuilder';
import type { AppStateAction, PersistedState, StoredState } from './types';

/** What a first run looks like, and what any missing saved field falls back to. */
export const DEFAULT_STATE: PersistedState = {
  goals: [],
  rules: DEFAULT_RULES,
  persona: 'Supportive Mentor',
  pomodoro: { focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, longBreakEvery: 4 },
  modelId: null,
  appUsage: {},
};

export const isPreset = (persona: string): persona is LlmPreset =>
  (LLM_PRESETS as string[]).includes(persona);

/** Saved fields over defaults. The main process has already validated shapes. */
export function fromStored(stored: StoredState): PersistedState {
  const state = { ...DEFAULT_STATE, ...stored };
  if (!isPreset(state.persona)) {
    state.persona = DEFAULT_STATE.persona;
  }
  return state;
}

export function appStateReducer(state: PersistedState, action: AppStateAction): PersistedState {
  switch (action.type) {
    case 'loaded':
      return fromStored(action.stored);

    case 'addGoal': {
      const text = action.text.trim();
      if (!text) return state;
      return { ...state, goals: [...state.goals, { id: action.id, text, done: false }] };
    }
    case 'toggleGoal':
      return {
        ...state,
        goals: state.goals.map((goal) => (goal.id === action.id ? { ...goal, done: !goal.done } : goal)),
      };
    case 'removeGoal':
      return { ...state, goals: state.goals.filter((goal) => goal.id !== action.id) };
    case 'clearDoneGoals':
      return { ...state, goals: state.goals.filter((goal) => !goal.done) };

    case 'setAppCategory':
      return {
        ...state,
        rules: { ...state.rules, apps: { ...state.rules.apps, [action.appName]: action.category } },
      };
    case 'setBrowserTitles': {
      const titles = [...new Set(action.titles.map((title) => title.trim()).filter(Boolean))];
      return { ...state, rules: { ...state.rules, allowedBrowserTitles: titles } };
    }

    case 'setPersona':
      return isPreset(action.persona) ? { ...state, persona: action.persona } : state;
    case 'setPomodoro':
      return { ...state, pomodoro: action.settings };
    case 'setModel':
      return { ...state, modelId: action.modelId };

    case 'creditUsage': {
      const previous = state.appUsage[action.appName];
      return {
        ...state,
        appUsage: {
          ...state.appUsage,
          [action.appName]: { seconds: (previous?.seconds ?? 0) + action.ms / 1000, lastSeen: action.at },
        },
      };
    }
    case 'clearUsage':
      return { ...state, appUsage: {} };
  }
}
