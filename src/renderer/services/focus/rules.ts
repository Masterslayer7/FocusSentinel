import type { FocusRules } from './types';

/**
 * The starting allowlist, used until the user's own saved rules load.
 *
 * Keys are matched against get-windows display names ("Google Chrome",
 * "Visual Studio Code", "Microsoft Edge"), not process names. A short key like
 * 'Chrome' covers "Google Chrome" until the user sets that exact name.
 */
export const DEFAULT_RULES: FocusRules = {
  apps: {
    'Visual Studio Code': 'focus',
    'Windows Terminal': 'focus',
    Obsidian: 'focus',
    Electron: 'focus',      // FocusSentinel's own window, when run in development
    FocusSentinel: 'focus', // ...and once packaged under its own name
    Chrome: 'browser',
    Edge: 'browser',
    Firefox: 'browser',
    Zen: 'browser',
  },
  allowedBrowserTitles: ['MDN', 'Stack Overflow', 'GitHub', 'localhost'],
};
