import type { FocusRules } from './types';

/**
 * The v1 allowlist. In memory only: persisting it would be a deliberate
 * exception to the zero-retention rule (context.md constraint 1) and needs its
 * own decision.
 *
 * Entries are case-insensitive substrings. get-windows reports display names
 * ("Google Chrome", "Visual Studio Code", "Microsoft Edge"), not process names
 * ("chrome", "Code", "msedge") — tune against what it actually reports.
 */
export const DEFAULT_RULES: FocusRules = {
  allowedApps: [
    'Visual Studio Code',
    'Windows Terminal',
    'Obsidian',
    'Electron',      // FocusSentinel's own window, when run in development
    'FocusSentinel', // ...and once packaged under its own name
  ],
  browsers: ['Chrome', 'Edge', 'Firefox', 'Zen'],
  allowedBrowserTitles: ['MDN', 'Stack Overflow', 'GitHub', 'localhost'],
};
