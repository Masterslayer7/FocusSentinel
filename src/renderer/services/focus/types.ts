import type { SamplerError, SamplerEvent, WindowSample } from '../../../shared/types';

export type { SamplerError, SamplerEvent, WindowSample };

/** What the tracker answers with. Deliberately free of window titles. */
export interface FocusStatus {
  isDistracted: boolean;
  distractionDuration: number; // consecutive SECONDS in the current distraction; 0 when focused
  violationCount: number;      // distinct distraction episodes this session
  currentApp: string;
}

/**
 * The hybrid allowlist.
 *
 * Ordinary apps are judged on appName alone. Apps named in `browsers` are
 * judged on their window title instead, because for a browser the app name
 * says nothing useful — the tab is the activity.
 *
 * All matching is case-insensitive substring matching.
 */
export interface FocusRules {
  allowedApps: string[];
  browsers: string[];
  allowedBrowserTitles: string[];
}
