import { describe, test, expect, beforeEach } from 'vitest';
import { PomodoroTimer } from './PomodoroTimer';
import type { PomodoroSettings } from './types';

const SETTINGS: PomodoroSettings = { focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, longBreakEvery: 4 };
const T0 = 1_700_000_000_000;
const at = (seconds: number) => T0 + seconds * 1000;
const MIN = 60;

describe('PomodoroTimer', () => {
  let timer: PomodoroTimer;

  beforeEach(() => {
    timer = new PomodoroTimer(SETTINGS);
  });

  test('starts paused at the beginning of a focus block', () => {
    expect(timer.getStatus(at(0))).toEqual({
      phase: 'focus',
      isRunning: false,
      remainingSeconds: 25 * MIN,
      completedFocusBlocks: 0,
      isFocusActive: false,
    });
  });

  test('counts down while running', () => {
    timer.start(at(0));

    const status = timer.tick(at(60));
    expect(status.remainingSeconds).toBe(24 * MIN);
    expect(status.isFocusActive).toBe(true);
  });

  test('pausing freezes the countdown, and starting again resumes it', () => {
    timer.start(at(0));
    timer.pause(at(60));

    expect(timer.tick(at(600)).remainingSeconds).toBe(24 * MIN);

    timer.start(at(600));
    expect(timer.tick(at(660)).remainingSeconds).toBe(23 * MIN);
  });

  test('a finished focus block counts and starts a short break automatically', () => {
    timer.start(at(0));

    const status = timer.tick(at(25 * MIN));
    expect(status).toEqual({
      phase: 'shortBreak',
      isRunning: true,
      remainingSeconds: 5 * MIN,
      completedFocusBlocks: 1,
      isFocusActive: false,
    });
  });

  test('every fourth finished focus block is followed by a long break', () => {
    let now = 0;
    for (let block = 1; block <= 4; block++) {
      timer.start(at(now));
      now += 25 * MIN;
      const status = timer.tick(at(now));
      if (block < 4) {
        expect(status.phase).toBe('shortBreak');
        now += 5 * MIN;
        timer.tick(at(now)); // break ends
      } else {
        expect(status.phase).toBe('longBreak');
        expect(status.remainingSeconds).toBe(15 * MIN);
      }
    }
  });

  test('a finished break returns to focus, paused, so it never starts while you are away', () => {
    timer.start(at(0));
    timer.tick(at(25 * MIN));

    expect(timer.tick(at(30 * MIN))).toEqual({
      phase: 'focus',
      isRunning: false,
      remainingSeconds: 25 * MIN,
      completedFocusBlocks: 1,
      isFocusActive: false,
    });
  });

  test('skipping a focus block goes to a break without counting it', () => {
    timer.start(at(0));

    const status = timer.skip(at(60));
    expect(status.phase).toBe('shortBreak');
    expect(status.completedFocusBlocks).toBe(0);
  });

  test('skipping a break returns to a paused focus block', () => {
    timer.start(at(0));
    timer.tick(at(25 * MIN));

    const status = timer.skip(at(26 * MIN));
    expect(status.phase).toBe('focus');
    expect(status.isRunning).toBe(false);
  });

  test('reset returns to the very beginning', () => {
    timer.start(at(0));
    timer.tick(at(25 * MIN));
    timer.reset();

    expect(timer.getStatus(at(26 * MIN))).toEqual({
      phase: 'focus',
      isRunning: false,
      remainingSeconds: 25 * MIN,
      completedFocusBlocks: 0,
      isFocusActive: false,
    });
  });

  test('new settings apply at once to a phase that has not started yet', () => {
    timer.setSettings({ ...SETTINGS, focusMinutes: 50 }, at(0));

    expect(timer.getStatus(at(0)).remainingSeconds).toBe(50 * MIN);
  });

  test('new settings do not change a phase already under way', () => {
    timer.start(at(0));
    timer.setSettings({ ...SETTINGS, focusMinutes: 50 }, at(60));

    expect(timer.getStatus(at(60)).remainingSeconds).toBe(24 * MIN);
  });
});
