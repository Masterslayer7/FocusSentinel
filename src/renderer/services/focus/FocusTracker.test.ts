import { describe, test, expect, beforeEach } from 'vitest';
import { FocusTracker, classifyApp } from './FocusTracker';
import type { FocusRules } from './types';

const RULES: FocusRules = {
  apps: {
    Code: 'focus',
    'Windows Terminal': 'focus',
    zen: 'browser',
    chrome: 'browser',
    msedge: 'browser',
  },
  allowedBrowserTitles: ['MDN', 'Stack Overflow', 'localhost'],
};

const T0 = 1_700_000_000_000;

// Small helper so each test reads as a sequence of events, not object literals.
const sample = (appName: string, windowTitle: string, offsetSeconds: number) => ({
  appName,
  windowTitle,
  timestamp: T0 + offsetSeconds * 1000,
});

describe('FocusTracker', () => {
  let tracker: FocusTracker;

  beforeEach(() => {
    tracker = new FocusTracker(RULES);
  });

  test('an allowed sample is not a distraction', () => {
    const status = tracker.accept(sample('Code', 'main.ts', 0));

    expect(status).toEqual({
      isDistracted: false,
      distractionDuration: 0,
      violationCount: 0,
      currentApp: 'Code',
    });
  });

  test('a disallowed sample starts a distraction and counts one violation', () => {
    const status = tracker.accept(sample('Discord', 'general', 0));

    expect(status).toEqual({
      isDistracted: true,
      distractionDuration: 0,
      violationCount: 1,
      currentApp: 'Discord',
    });
  });

  test('consecutive disallowed samples grow the duration without counting again', () => {
    tracker.accept(sample('Discord', 'general', 0));
    const status = tracker.accept(sample('Discord', 'general', 10));

    expect(status.distractionDuration).toBe(10);
    expect(status.violationCount).toBe(1);
  });

  test('returning to an allowed window ends the distraction but keeps the count', () => {
    tracker.accept(sample('Discord', 'general', 0));
    tracker.accept(sample('Discord', 'general', 10));
    const status = tracker.accept(sample('Code', 'main.ts', 12));

    expect(status.isDistracted).toBe(false);
    expect(status.distractionDuration).toBe(0);
    expect(status.violationCount).toBe(1);
  });

  test('a second distraction counts a second violation and restarts the duration', () => {
    tracker.accept(sample('Discord', 'general', 0));
    tracker.accept(sample('Discord', 'general', 10));
    tracker.accept(sample('Code', 'main.ts', 12));
    const status = tracker.accept(sample('Discord', 'general', 20));

    expect(status.violationCount).toBe(2);
    expect(status.distractionDuration).toBe(0);
  });

  test('switching between two disallowed apps is one continuous distraction', () => {
    tracker.accept(sample('Discord', 'general', 0));
    const status = tracker.accept(sample('Spotify', 'Liked Songs', 5));

    expect(status.violationCount).toBe(1);
    expect(status.distractionDuration).toBe(5);
    expect(status.currentApp).toBe('Spotify');
  });

  test('app matching is case-insensitive', () => {
    expect(tracker.accept(sample('code', 'main.ts', 0)).isDistracted).toBe(false);
    expect(tracker.accept(sample('CODE', 'main.ts', 1)).isDistracted).toBe(false);
  });

  test('reset clears every counter back to the initial state', () => {
    tracker.accept(sample('Discord', 'general', 0));
    tracker.accept(sample('Code', 'main.ts', 5));
    tracker.accept(sample('Spotify', 'Liked Songs', 10));
    tracker.accept(sample('Spotify', 'Liked Songs', 30));

    tracker.reset();

    expect(tracker.getStatus()).toEqual({
      isDistracted: false,
      distractionDuration: 0,
      violationCount: 0,
      currentApp: '',
    });
  });

  describe('rules can change and focus blocks can end', () => {
    test('new rules take effect from the next sample', () => {
      tracker.accept(sample('Discord', 'general', 0));
      tracker.setRules({ ...RULES, apps: { ...RULES.apps, Discord: 'focus' } });

      expect(tracker.accept(sample('Discord', 'general', 4)).isDistracted).toBe(false);
    });

    test('interrupt ends the current episode without touching the count', () => {
      tracker.accept(sample('Discord', 'general', 0));
      tracker.accept(sample('Discord', 'general', 10));

      tracker.interrupt();

      expect(tracker.getStatus()).toEqual({
        isDistracted: false,
        distractionDuration: 0,
        violationCount: 1,
        currentApp: 'Discord',
      });
    });

    test('a distraction after an interrupt is a new episode, timed from its own start', () => {
      tracker.accept(sample('Discord', 'general', 0));
      tracker.interrupt(); // e.g. the focus block ended and a break ran
      tracker.accept(sample('Discord', 'general', 300));
      const status = tracker.accept(sample('Discord', 'general', 304));

      expect(status.violationCount).toBe(2);
      expect(status.distractionDuration).toBe(4);
    });
  });

  describe('browsers are judged on window title', () => {
    test('a browser showing an allowed title is not a distraction', () => {
      const status = tracker.accept(sample('zen', 'MDN Web Docs — Array', 0));

      expect(status.isDistracted).toBe(false);
    });

    test('a browser showing a disallowed title is a distraction', () => {
      const status = tracker.accept(
        sample('zen', '(75) Some video - YouTube — Zen Browser', 0),
      );

      expect(status.isDistracted).toBe(true);
      expect(status.violationCount).toBe(1);
    });

    test('titles are ignored for apps that are not browsers', () => {
      const status = tracker.accept(sample('Code', 'YouTube.md', 0));

      expect(status.isDistracted).toBe(false);
    });

    test('a browser with an empty title cannot be allowed', () => {
      const status = tracker.accept(sample('chrome', '', 0));

      expect(status.isDistracted).toBe(true);
    });
  });
});

describe('classifyApp', () => {
  const rules: FocusRules = {
    apps: { Chrome: 'browser', 'Google Chrome': 'focus', Code: 'focus', Discord: 'distraction' },
    allowedBrowserTitles: [],
  };

  test('an exact name match wins over a partial one', () => {
    expect(classifyApp('Google Chrome', rules)).toBe('focus');
  });

  test('a partial match applies when there is no exact one', () => {
    expect(classifyApp('Chrome Canary', rules)).toBe('browser');
    expect(classifyApp('Visual Studio Code', rules)).toBe('focus');
  });

  test('matching ignores case', () => {
    expect(classifyApp('DISCORD', rules)).toBe('distraction');
  });

  test('an app that matches nothing is a distraction', () => {
    expect(classifyApp('Spotify', rules)).toBe('distraction');
  });

  test('the longest partial match wins, so results do not depend on key order', () => {
    const nested: FocusRules = { apps: { Code: 'distraction', 'Studio Code': 'focus' }, allowedBrowserTitles: [] };
    expect(classifyApp('Visual Studio Code', nested)).toBe('focus');
  });
});
