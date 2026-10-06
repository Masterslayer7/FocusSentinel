import { describe, test, expect } from 'vitest';
import { appStateReducer, DEFAULT_STATE, fromStored } from './appState';
import type { PersistedState } from './types';

const reduce = (state: PersistedState, ...actions: Parameters<typeof appStateReducer>[1][]) =>
  actions.reduce(appStateReducer, state);

describe('fromStored', () => {
  test('nothing saved means the defaults', () => {
    expect(fromStored({})).toEqual(DEFAULT_STATE);
  });

  test('saved fields replace their defaults; missing ones keep them', () => {
    const state = fromStored({ persona: 'Drill Sergeant', goals: [{ id: 'g1', text: 'Ship it', done: false }] });

    expect(state.persona).toBe('Drill Sergeant');
    expect(state.goals).toHaveLength(1);
    expect(state.pomodoro).toEqual(DEFAULT_STATE.pomodoro);
  });

  test('an unknown persona falls back to the default one', () => {
    expect(fromStored({ persona: 'Pirate Captain' }).persona).toBe(DEFAULT_STATE.persona);
  });
});

describe('appStateReducer', () => {
  test('adds a goal with the id it was given, trimming the text', () => {
    const state = reduce(DEFAULT_STATE, { type: 'addGoal', id: 'g1', text: '  Write the ADR  ' });

    expect(state.goals).toEqual([{ id: 'g1', text: 'Write the ADR', done: false }]);
  });

  test('ignores a blank goal', () => {
    expect(reduce(DEFAULT_STATE, { type: 'addGoal', id: 'g1', text: '   ' })).toBe(DEFAULT_STATE);
  });

  test('toggles and removes goals by id', () => {
    const state = reduce(
      DEFAULT_STATE,
      { type: 'addGoal', id: 'g1', text: 'One' },
      { type: 'addGoal', id: 'g2', text: 'Two' },
      { type: 'toggleGoal', id: 'g1' },
      { type: 'removeGoal', id: 'g2' },
    );

    expect(state.goals).toEqual([{ id: 'g1', text: 'One', done: true }]);
  });

  test('clears finished goals', () => {
    const state = reduce(
      DEFAULT_STATE,
      { type: 'addGoal', id: 'g1', text: 'One' },
      { type: 'addGoal', id: 'g2', text: 'Two' },
      { type: 'toggleGoal', id: 'g1' },
      { type: 'clearDoneGoals' },
    );

    expect(state.goals.map((goal) => goal.id)).toEqual(['g2']);
  });

  test('sets one app category without touching the others', () => {
    const state = reduce(DEFAULT_STATE, { type: 'setAppCategory', appName: 'Discord', category: 'focus' });

    expect(state.rules.apps.Discord).toBe('focus');
    expect(state.rules.apps['Visual Studio Code']).toBe('focus');
  });

  test('sets the allowed browser titles, dropping blanks and duplicates', () => {
    const state = reduce(DEFAULT_STATE, { type: 'setBrowserTitles', titles: ['MDN', ' ', 'docs', 'MDN'] });

    expect(state.rules.allowedBrowserTitles).toEqual(['MDN', 'docs']);
  });

  test('sets persona, pomodoro lengths and model', () => {
    const pomodoro = { focusMinutes: 50, shortBreakMinutes: 10, longBreakMinutes: 20, longBreakEvery: 3 };
    const state = reduce(
      DEFAULT_STATE,
      { type: 'setPersona', persona: 'Sarcastic Critic' },
      { type: 'setPomodoro', settings: pomodoro },
      { type: 'setModel', modelId: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC' },
    );

    expect(state.persona).toBe('Sarcastic Critic');
    expect(state.pomodoro).toEqual(pomodoro);
    expect(state.modelId).toBe('Qwen2.5-0.5B-Instruct-q4f16_1-MLC');
  });

  test('credits usage time to an app, accumulating seconds and updating lastSeen', () => {
    const state = reduce(
      DEFAULT_STATE,
      { type: 'creditUsage', appName: 'Discord', ms: 2000, at: 1000 },
      { type: 'creditUsage', appName: 'Discord', ms: 1500, at: 3000 },
    );

    expect(state.appUsage.Discord).toEqual({ seconds: 3.5, lastSeen: 3000 });
  });

  test('clears usage history', () => {
    const state = reduce(
      DEFAULT_STATE,
      { type: 'creditUsage', appName: 'Discord', ms: 2000, at: 1000 },
      { type: 'clearUsage' },
    );

    expect(state.appUsage).toEqual({});
  });
});
