// @vitest-environment node
import { describe, test, expect } from 'vitest';
import { parseStoredState } from './storedState';

const VALID = {
  goals: [{ id: 'g1', text: 'Write the ADR', done: false }],
  rules: { apps: { 'Google Chrome': 'browser', Discord: 'distraction' }, allowedBrowserTitles: ['MDN'] },
  persona: 'Supportive Mentor',
  pomodoro: { focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, longBreakEvery: 4 },
  modelId: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
  appUsage: { Discord: { seconds: 120, lastSeen: 1_700_000_000_000 } },
};

describe('parseStoredState', () => {
  test('keeps a fully valid state as it is', () => {
    expect(parseStoredState(VALID)).toEqual(VALID);
  });

  test('anything that is not an object yields an empty state', () => {
    expect(parseStoredState(null)).toEqual({});
    expect(parseStoredState('nonsense')).toEqual({});
    expect(parseStoredState([1, 2])).toEqual({});
  });

  test('a missing or malformed field is left out, so the renderer uses its default', () => {
    const { persona, ...rest } = VALID;
    expect(parseStoredState({ ...rest, pomodoro: { focusMinutes: 'lots' } })).toEqual({
      goals: VALID.goals,
      rules: VALID.rules,
      modelId: VALID.modelId,
      appUsage: VALID.appUsage,
    });
  });

  test('bad entries inside a list are dropped one by one, not the whole list', () => {
    const parsed = parseStoredState({
      goals: [VALID.goals[0], { id: 'g2', text: 42, done: false }, 'junk'],
      rules: { apps: { Discord: 'distraction', Spotify: 'sometimes' }, allowedBrowserTitles: ['MDN', 7] },
      appUsage: { Discord: VALID.appUsage.Discord, Spotify: { seconds: -5, lastSeen: 1 } },
    });

    expect(parsed.goals).toEqual(VALID.goals);
    expect(parsed.rules).toEqual({ apps: { Discord: 'distraction' }, allowedBrowserTitles: ['MDN'] });
    expect(parsed.appUsage).toEqual(VALID.appUsage);
  });

  test('pomodoro lengths must be whole minutes in a sane range', () => {
    expect(parseStoredState({ pomodoro: { ...VALID.pomodoro, focusMinutes: 0 } }).pomodoro).toBeUndefined();
    expect(parseStoredState({ pomodoro: { ...VALID.pomodoro, focusMinutes: 2.5 } }).pomodoro).toBeUndefined();
    expect(parseStoredState({ pomodoro: { ...VALID.pomodoro, longBreakEvery: 99 } }).pomodoro).toBeUndefined();
  });

  test('modelId may be null, meaning no model chosen yet', () => {
    expect(parseStoredState({ modelId: null })).toEqual({ modelId: null });
  });

  test('fields it does not know about are not carried through', () => {
    expect(parseStoredState({ persona: 'Drill Sergeant', windowTitles: ['secret'] })).toEqual({ persona: 'Drill Sergeant' });
  });

  test('keys that could alter object prototypes are ignored', () => {
    const raw = JSON.parse('{"appUsage": {"__proto__": {"seconds": 1, "lastSeen": 1}, "Code": {"seconds": 2, "lastSeen": 2}}}');
    const parsed = parseStoredState(raw);

    expect(Object.keys(parsed.appUsage ?? {})).toEqual(['Code']);
    expect(Object.getPrototypeOf(parsed.appUsage)).toBe(Object.prototype);
  });
});
