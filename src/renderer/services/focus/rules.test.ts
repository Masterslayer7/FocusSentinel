import { describe, test, expect } from 'vitest';
import { FocusTracker } from './FocusTracker';
import { DEFAULT_RULES } from './rules';

// get-windows reports display names, not process names. These are the real
// spellings observed on Windows; the defaults must keep matching them.
const isDistracted = (appName: string, windowTitle = '') =>
  new FocusTracker(DEFAULT_RULES).accept({ appName, windowTitle, timestamp: 0 }).isDistracted;

describe('DEFAULT_RULES', () => {
  test('allows the development tools as get-windows names them', () => {
    expect(isDistracted('Visual Studio Code')).toBe(false);
    expect(isDistracted('Windows Terminal')).toBe(false);
  });

  test("allows FocusSentinel's own window, which reports as Electron in development", () => {
    expect(isDistracted('Electron')).toBe(false);
  });

  test('treats the major browsers as browsers, judged on title', () => {
    expect(isDistracted('Google Chrome', 'Array - JavaScript | MDN')).toBe(false);
    expect(isDistracted('Google Chrome', 'Some video - YouTube')).toBe(true);
    expect(isDistracted('Microsoft Edge', 'Array - JavaScript | MDN')).toBe(false);
  });

  test('anything unlisted is a distraction', () => {
    expect(isDistracted('Discord')).toBe(true);
  });
});
