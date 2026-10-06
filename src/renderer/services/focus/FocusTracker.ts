import type { FocusRules, FocusStatus, WindowSample } from './types';

const matchesAny = (haystack: string, needles: string[]): boolean => {
  const value = haystack.toLowerCase();
  return needles.some((needle) => value.includes(needle.toLowerCase()));
};

export class FocusTracker {
  private isDistracted = false;
  private violationCount = 0;
  private distractionStart: number | null = null;
  private distractionDuration = 0;
  private currentApp = '';

  constructor(private readonly rules: FocusRules) {}

  /** Feeds one observation in and returns the resulting status. */
  public accept(sample: WindowSample): FocusStatus {
    this.currentApp = sample.appName;

    if (this.isAllowed(sample)) {
      this.isDistracted = false;
      this.distractionStart = null;
      this.distractionDuration = 0;
    } else if (!this.isDistracted) {
      // Transition into a new distraction episode.
      this.isDistracted = true;
      this.violationCount += 1;
      this.distractionStart = sample.timestamp;
      this.distractionDuration = 0;
    } else {
      // Still distracted: grow the duration from the episode's start.
      const elapsedMs = sample.timestamp - (this.distractionStart ?? sample.timestamp);
      this.distractionDuration = Math.max(0, Math.floor(elapsedMs / 1000));
    }

    return this.getStatus();
  }

  /** Returns a fresh object, so a consumer holding an earlier status never sees it change. */
  public getStatus(): FocusStatus {
    return {
      isDistracted: this.isDistracted,
      distractionDuration: this.distractionDuration,
      violationCount: this.violationCount,
      currentApp: this.currentApp,
    };
  }

  public reset(): void {
    this.isDistracted = false;
    this.violationCount = 0;
    this.distractionStart = null;
    this.distractionDuration = 0;
    this.currentApp = '';
  }

  /** Browsers are judged on window title, because the tab is the activity; everything else on app name. */
  private isAllowed(sample: WindowSample): boolean {
    if (matchesAny(sample.appName, this.rules.browsers)) {
      return matchesAny(sample.windowTitle, this.rules.allowedBrowserTitles);
    }
    return matchesAny(sample.appName, this.rules.allowedApps);
  }
}
